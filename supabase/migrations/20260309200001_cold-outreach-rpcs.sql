-- ============================================================================
-- 051 - Cold Outreach: RPCs (funciones remotas)
-- Funciones de servidor para el sistema de cold outreach: claiming de envíos,
-- contadores atómicos, supresión, warmup, bounce processing, dashboard,
-- preparación de envíos, spintax y enrollment masivo.
-- ============================================================================


-- ─── 1. Reclamar próximos envíos (atómico, skip locked, round-robin inboxes) ─

-- Claims queued sends that are ready to be dispatched.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions between workers.
-- Rotates inbox assignment round-robin among the campaign's configured inboxes.
-- Respects per-inbox daily send limits and resets counters at midnight.

CREATE OR REPLACE FUNCTION co_claim_next_sends(
    p_campaign_id UUID,
    p_limit       INT DEFAULT 10
)
RETURNS TABLE(
    send_id   UUID,
    contact_id UUID,
    inbox_id  UUID,
    subject   TEXT,
    body_html TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inbox_ids   UUID[];
    v_inbox_count INT;
BEGIN
    -- Gather campaign inboxes and reset daily counters if stale
    UPDATE ventas_co_inboxes
    SET sent_today = 0,
        sent_today_reset_at = CURRENT_DATE
    WHERE campaign_id = p_campaign_id
      AND sent_today_reset_at < CURRENT_DATE;

    -- Get available inboxes (those that haven't hit their daily limit)
    SELECT array_agg(i.id ORDER BY i.id)
    INTO v_inbox_ids
    FROM ventas_co_inboxes i
    WHERE i.campaign_id = p_campaign_id
      AND i.status = 'active'
      AND i.sent_today < i.daily_limit;

    IF v_inbox_ids IS NULL OR array_length(v_inbox_ids, 1) = 0 THEN
        -- No inboxes available (all at daily limit or none active)
        RETURN;
    END IF;

    v_inbox_count := array_length(v_inbox_ids, 1);

    RETURN QUERY
    WITH candidates AS (
        SELECT s.id AS s_id
        FROM ventas_co_sends s
        WHERE s.campaign_id = p_campaign_id
          AND s.status = 'queued'
          AND s.scheduled_for <= NOW()
        ORDER BY s.scheduled_for ASC, s.created_at ASC
        LIMIT p_limit
        FOR UPDATE OF s SKIP LOCKED
    ),
    numbered AS (
        SELECT
            c.s_id,
            -- Round-robin: assign inbox based on row position modulo inbox count
            v_inbox_ids[1 + ((row_number() OVER (ORDER BY c.s_id))::INT - 1) % v_inbox_count] AS assigned_inbox_id
        FROM candidates c
    ),
    claimed AS (
        UPDATE ventas_co_sends s
        SET status     = 'sending',
            inbox_id   = n.assigned_inbox_id,
            updated_at = NOW()
        FROM numbered n
        WHERE s.id = n.s_id
        RETURNING s.id, s.contact_id, s.inbox_id, s.subject, s.body_html
    )
    SELECT
        claimed.id        AS send_id,
        claimed.contact_id,
        claimed.inbox_id,
        claimed.subject,
        claimed.body_html
    FROM claimed;

    -- Increment sent_today for each inbox that was assigned sends
    UPDATE ventas_co_inboxes ib
    SET sent_today = ib.sent_today + sub.cnt
    FROM (
        SELECT s.inbox_id, count(*) AS cnt
        FROM ventas_co_sends s
        WHERE s.campaign_id = p_campaign_id
          AND s.status = 'sending'
          AND s.updated_at >= NOW() - INTERVAL '5 seconds'
          AND s.inbox_id = ANY(v_inbox_ids)
        GROUP BY s.inbox_id
    ) sub
    WHERE ib.id = sub.inbox_id;
END;
$$;


-- ─── 2. Incrementar contador atómico (genérico, con whitelist) ──────────────

-- Atomic counter increment for allowed table/column combinations.
-- Prevents SQL injection by whitelisting valid targets.

CREATE OR REPLACE FUNCTION co_increment_counter(
    p_table  TEXT,
    p_id     UUID,
    p_column TEXT,
    p_amount INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed JSONB := '{
        "ventas_co_campaigns": ["total_sent","total_opened","total_clicked","total_replied","total_bounced","total_unsubscribed","total_converted"],
        "ventas_co_contacts":  ["times_contacted","times_opened","times_clicked"],
        "ventas_co_lists":     ["total_contacts"]
    }'::JSONB;
    v_columns JSONB;
BEGIN
    -- Validate table is in whitelist
    v_columns := v_allowed -> p_table;
    IF v_columns IS NULL THEN
        RAISE EXCEPTION 'co_increment_counter: tabla "%" no permitida. Permitidas: %',
            p_table, (SELECT string_agg(key, ', ') FROM jsonb_each(v_allowed));
    END IF;

    -- Validate column is allowed for this table
    IF NOT v_columns @> to_jsonb(p_column) THEN
        RAISE EXCEPTION 'co_increment_counter: columna "%" no permitida en tabla "%". Permitidas: %',
            p_column, p_table, v_columns;
    END IF;

    -- Perform atomic increment
    EXECUTE format(
        'UPDATE %I SET %I = COALESCE(%I, 0) + $1, updated_at = NOW() WHERE id = $2',
        p_table, p_column, p_column
    ) USING p_amount, p_id;
END;
$$;


-- ─── 3. Verificar supresión de email ────────────────────────────────────────

-- Returns TRUE if the given email address is in the suppression list.
-- Used before sending to ensure compliance with unsubscribes, bounces, etc.

CREATE OR REPLACE FUNCTION co_check_suppression(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_suppressed BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM ventas_co_suppressions
        WHERE email = lower(trim(p_email))
    ) INTO v_suppressed;

    RETURN v_suppressed;
END;
$$;


-- ─── 4. Obtener límite de warmup para hoy ──────────────────────────────────

-- Returns the maximum number of emails a domain can send today based on its
-- warmup schedule. If warmup is completed, returns the domain's full daily_limit.
-- The warmup_schedule is a JSONB array like [5, 10, 20, 40, 80, ...] where
-- each element is the daily limit for that warmup day.

CREATE OR REPLACE FUNCTION co_get_warmup_limit(p_domain_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_domain        RECORD;
    v_schedule      JSONB;
    v_schedule_len  INT;
    v_limit         INT;
BEGIN
    SELECT
        warmup_completed,
        warmup_day,
        warmup_schedule,
        daily_limit
    INTO v_domain
    FROM ventas_co_domains
    WHERE id = p_domain_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'co_get_warmup_limit: dominio % no encontrado', p_domain_id;
    END IF;

    -- If warmup is done, use full daily limit
    IF v_domain.warmup_completed THEN
        RETURN COALESCE(v_domain.daily_limit, 100);
    END IF;

    v_schedule := v_domain.warmup_schedule;

    -- If no schedule defined, return a conservative default
    IF v_schedule IS NULL OR jsonb_typeof(v_schedule) != 'array' THEN
        RETURN 5;
    END IF;

    v_schedule_len := jsonb_array_length(v_schedule);

    -- warmup_day is 1-based; array index is 0-based
    IF v_domain.warmup_day > v_schedule_len THEN
        -- Past the schedule — warmup should be marked complete
        RETURN COALESCE(v_domain.daily_limit, 100);
    END IF;

    v_limit := (v_schedule -> (v_domain.warmup_day - 1))::INT;

    RETURN COALESCE(v_limit, 5);
END;
$$;


-- ─── 5. Procesar bounce (atómico, con supresión y pausa automática) ─────────

-- Handles all bounce processing in a single atomic operation:
-- 1) Marks the send as bounced with type and reason
-- 2) For hard bounces: immediately suppresses the email and marks contact as bounced
-- 3) For soft bounces: suppresses after 3+ soft bounces for the same email
-- 4) Increments campaign bounce counter
-- 5) Checks campaign bounce rate vs threshold; pauses campaign if exceeded
-- 6) Decreases domain health score (2 for hard, 1 for soft)

CREATE OR REPLACE FUNCTION co_process_bounce(
    p_send_id     UUID,
    p_bounce_type TEXT,
    p_reason      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_send          RECORD;
    v_contact_email TEXT;
    v_soft_count    INT;
    v_campaign      RECORD;
    v_bounce_rate   NUMERIC;
    v_health_delta  INT;
BEGIN
    -- Validate bounce type
    IF p_bounce_type NOT IN ('hard', 'soft') THEN
        RAISE EXCEPTION 'co_process_bounce: bounce_type debe ser "hard" o "soft", recibido: "%"', p_bounce_type;
    END IF;

    -- Get send details
    SELECT s.id, s.campaign_id, s.contact_id, s.inbox_id
    INTO v_send
    FROM ventas_co_sends s
    WHERE s.id = p_send_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'co_process_bounce: send % no encontrado', p_send_id;
    END IF;

    -- 1) Update send status
    UPDATE ventas_co_sends
    SET status        = 'bounced',
        bounce_type   = p_bounce_type,
        bounce_reason = p_reason,
        updated_at    = NOW()
    WHERE id = p_send_id;

    -- Get contact email
    SELECT email INTO v_contact_email
    FROM ventas_co_contacts
    WHERE id = v_send.contact_id;

    -- 2) Suppression logic
    IF p_bounce_type = 'hard' THEN
        -- Hard bounce: immediate suppression
        INSERT INTO ventas_co_suppressions (email, reason, source_send_id)
        VALUES (lower(trim(v_contact_email)), 'hard_bounce', p_send_id)
        ON CONFLICT (email) DO NOTHING;

        -- Mark contact as bounced
        UPDATE ventas_co_contacts
        SET status     = 'bounced',
            updated_at = NOW()
        WHERE id = v_send.contact_id;

    ELSIF p_bounce_type = 'soft' THEN
        -- 3) Soft bounce: check if 3+ soft bounces for this email
        SELECT count(*)
        INTO v_soft_count
        FROM ventas_co_sends s
        JOIN ventas_co_contacts c ON c.id = s.contact_id
        WHERE c.email = v_contact_email
          AND s.bounce_type = 'soft'
          AND s.status = 'bounced';

        IF v_soft_count >= 3 THEN
            INSERT INTO ventas_co_suppressions (email, reason, source_send_id)
            VALUES (lower(trim(v_contact_email)), 'repeated_soft_bounce', p_send_id)
            ON CONFLICT (email) DO NOTHING;

            UPDATE ventas_co_contacts
            SET status     = 'bounced',
                updated_at = NOW()
            WHERE id = v_send.contact_id;
        END IF;
    END IF;

    -- 4) Increment campaign bounce counter
    UPDATE ventas_co_campaigns
    SET total_bounced = COALESCE(total_bounced, 0) + 1,
        updated_at   = NOW()
    WHERE id = v_send.campaign_id;

    -- 5) Check campaign bounce rate vs threshold
    SELECT
        total_sent,
        total_bounced,
        bounce_rate_threshold,
        auto_pause_enabled,
        status
    INTO v_campaign
    FROM ventas_co_campaigns
    WHERE id = v_send.campaign_id;

    IF v_campaign.total_sent > 0 AND v_campaign.auto_pause_enabled THEN
        v_bounce_rate := (v_campaign.total_bounced::NUMERIC / v_campaign.total_sent) * 100;

        IF v_bounce_rate >= COALESCE(v_campaign.bounce_rate_threshold, 5.0) THEN
            UPDATE ventas_co_campaigns
            SET status     = 'paused',
                updated_at = NOW()
            WHERE id = v_send.campaign_id
              AND status = 'active';
        END IF;
    END IF;

    -- 6) Update domain health score
    v_health_delta := CASE WHEN p_bounce_type = 'hard' THEN 2 ELSE 1 END;

    UPDATE ventas_co_domains
    SET health_score = GREATEST(0, COALESCE(health_score, 100) - v_health_delta),
        updated_at   = NOW()
    FROM ventas_co_inboxes i
    WHERE ventas_co_domains.id = i.domain_id
      AND i.id = v_send.inbox_id;
END;
$$;


-- ─── 6. Dashboard stats (resumen global) ───────────────────────────────────

-- Returns a JSON object with global cold outreach metrics:
-- contact/list/campaign counts, send totals, engagement rates,
-- and per-domain health summaries.

CREATE OR REPLACE FUNCTION co_get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats    RECORD;
    v_domains  JSON;
    v_result   JSON;
BEGIN
    -- Aggregate global stats from campaigns
    SELECT
        COALESCE((SELECT count(*) FROM ventas_co_contacts WHERE status = 'active'), 0)   AS total_contacts,
        COALESCE((SELECT count(*) FROM ventas_co_lists), 0)                                AS total_lists,
        COALESCE((SELECT count(*) FROM ventas_co_campaigns WHERE status = 'active'), 0)    AS active_campaigns,
        COALESCE(sum(c.total_sent), 0)          AS total_sent,
        COALESCE(sum(c.total_sent) - sum(c.total_bounced), 0) AS total_delivered,
        COALESCE(sum(c.total_opened), 0)        AS total_opened,
        COALESCE(sum(c.total_clicked), 0)       AS total_clicked,
        COALESCE(sum(c.total_replied), 0)       AS total_replied,
        COALESCE(sum(c.total_bounced), 0)       AS total_bounced
    INTO v_stats
    FROM ventas_co_campaigns c;

    -- Domain health summary
    SELECT json_agg(
        json_build_object(
            'domain',       d.domain,
            'health_score', COALESCE(d.health_score, 100),
            'warmup_day',   COALESCE(d.warmup_day, 0),
            'status',       d.status
        ) ORDER BY d.domain
    )
    INTO v_domains
    FROM ventas_co_domains d;

    -- Build final result with calculated rates
    v_result := json_build_object(
        'totalContacts',       v_stats.total_contacts,
        'totalLists',          v_stats.total_lists,
        'activeCampaigns',     v_stats.active_campaigns,
        'totalSent',           v_stats.total_sent,
        'totalDelivered',      v_stats.total_delivered,
        'totalOpened',         v_stats.total_opened,
        'totalClicked',        v_stats.total_clicked,
        'totalReplied',        v_stats.total_replied,
        'totalBounced',        v_stats.total_bounced,
        'overallOpenRate',     CASE WHEN v_stats.total_sent > 0
                                   THEN round((v_stats.total_opened::NUMERIC / v_stats.total_sent) * 100, 2)
                                   ELSE 0 END,
        'overallClickRate',    CASE WHEN v_stats.total_sent > 0
                                   THEN round((v_stats.total_clicked::NUMERIC / v_stats.total_sent) * 100, 2)
                                   ELSE 0 END,
        'overallReplyRate',    CASE WHEN v_stats.total_sent > 0
                                   THEN round((v_stats.total_replied::NUMERIC / v_stats.total_sent) * 100, 2)
                                   ELSE 0 END,
        'overallBounceRate',   CASE WHEN v_stats.total_sent > 0
                                   THEN round((v_stats.total_bounced::NUMERIC / v_stats.total_sent) * 100, 2)
                                   ELSE 0 END,
        'domainsHealth',       COALESCE(v_domains, '[]'::JSON)
    );

    RETURN v_result;
END;
$$;


-- ─── 7. Preparar envíos de campaña (genera sends desde enrollments) ─────────

-- Processes active campaign enrollments and generates queued sends:
-- 1) Finds enrolled contacts whose next_step_at has arrived
-- 2) Checks suppression and frequency cap (24h)
-- 3) Looks up the current sequence step for subject/body
-- 4) Handles A/B variant selection, send-time optimization, and spintax
-- 5) Inserts queued sends and advances enrollment to the next step

CREATE OR REPLACE FUNCTION co_prepare_campaign_sends(p_campaign_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_campaign       RECORD;
    v_enrollment     RECORD;
    v_step           RECORD;
    v_contact        RECORD;
    v_subject        TEXT;
    v_body           TEXT;
    v_variant_index  INT;
    v_scheduled_for  TIMESTAMPTZ;
    v_next_step      RECORD;
    v_sends_created  INT := 0;
    v_is_suppressed  BOOLEAN;
    v_has_recent     BOOLEAN;
BEGIN
    -- Get campaign details
    SELECT *
    INTO v_campaign
    FROM ventas_co_campaigns
    WHERE id = p_campaign_id
      AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'co_prepare_campaign_sends: campaña % no encontrada o no está activa', p_campaign_id;
    END IF;

    -- Iterate over enrollments ready for next step
    FOR v_enrollment IN
        SELECT e.*
        FROM ventas_co_enrollments e
        WHERE e.campaign_id = p_campaign_id
          AND e.status = 'active'
          AND e.next_step_at <= NOW()
        FOR UPDATE OF e SKIP LOCKED
    LOOP
        -- Get contact details
        SELECT *
        INTO v_contact
        FROM ventas_co_contacts
        WHERE id = v_enrollment.contact_id;

        IF NOT FOUND OR v_contact.status != 'active' THEN
            CONTINUE;
        END IF;

        -- Check suppression
        v_is_suppressed := co_check_suppression(v_contact.email);
        IF v_is_suppressed THEN
            UPDATE ventas_co_enrollments
            SET status = 'suppressed', updated_at = NOW()
            WHERE id = v_enrollment.id;
            CONTINUE;
        END IF;

        -- Frequency cap: don't re-send within 24 hours
        SELECT EXISTS(
            SELECT 1
            FROM ventas_co_sends
            WHERE contact_id = v_enrollment.contact_id
              AND status NOT IN ('failed', 'bounced')
              AND created_at >= NOW() - INTERVAL '24 hours'
        ) INTO v_has_recent;

        IF v_has_recent THEN
            CONTINUE;
        END IF;

        -- Get current step
        SELECT *
        INTO v_step
        FROM ventas_co_steps
        WHERE campaign_id = p_campaign_id
          AND step_order = v_enrollment.current_step
        LIMIT 1;

        IF NOT FOUND THEN
            -- No more steps — mark enrollment as completed
            UPDATE ventas_co_enrollments
            SET status = 'completed', updated_at = NOW()
            WHERE id = v_enrollment.id;
            CONTINUE;
        END IF;

        -- Handle A/B variants
        v_variant_index := NULL;
        IF v_step.ab_variants IS NOT NULL AND jsonb_array_length(v_step.ab_variants) > 0 THEN
            -- Randomly pick a variant
            v_variant_index := floor(random() * jsonb_array_length(v_step.ab_variants))::INT;
            v_subject := v_step.ab_variants -> v_variant_index ->> 'subject';
            v_body    := v_step.ab_variants -> v_variant_index ->> 'body_html';
        ELSE
            v_subject := v_step.subject;
            v_body    := v_step.body_html;
        END IF;

        -- Process spintax if enabled
        IF v_campaign.use_spintax THEN
            v_subject := co_resolve_spintax(v_subject);
            v_body    := co_resolve_spintax(v_body);
        END IF;

        -- Determine scheduled_for
        IF v_campaign.use_sto AND v_contact.best_send_hour IS NOT NULL THEN
            -- Send-time optimization: schedule for contact's best hour today or tomorrow
            v_scheduled_for := date_trunc('day', NOW()) + make_interval(hours => v_contact.best_send_hour);
            IF v_scheduled_for <= NOW() THEN
                -- Best hour already passed today, schedule for tomorrow
                v_scheduled_for := v_scheduled_for + INTERVAL '1 day';
            END IF;
        ELSE
            v_scheduled_for := NOW();
        END IF;

        -- Insert the queued send
        INSERT INTO ventas_co_sends (
            campaign_id, contact_id, step_id, enrollment_id,
            subject, body_html, variant_index,
            status, scheduled_for, created_at, updated_at
        ) VALUES (
            p_campaign_id, v_enrollment.contact_id, v_step.id, v_enrollment.id,
            v_subject, v_body, v_variant_index,
            'queued', v_scheduled_for, NOW(), NOW()
        );

        v_sends_created := v_sends_created + 1;

        -- Advance enrollment to next step
        SELECT *
        INTO v_next_step
        FROM ventas_co_steps
        WHERE campaign_id = p_campaign_id
          AND step_order = v_enrollment.current_step + 1
        LIMIT 1;

        IF FOUND THEN
            UPDATE ventas_co_enrollments
            SET current_step = v_enrollment.current_step + 1,
                next_step_at = NOW() + make_interval(hours => COALESCE(v_next_step.delay_hours, 24)),
                updated_at   = NOW()
            WHERE id = v_enrollment.id;
        ELSE
            -- No more steps after this — will complete after send
            UPDATE ventas_co_enrollments
            SET current_step = v_enrollment.current_step + 1,
                next_step_at = NULL,
                status       = 'completed',
                updated_at   = NOW()
            WHERE id = v_enrollment.id;
        END IF;
    END LOOP;

    RETURN v_sends_created;
END;
$$;


-- ─── 8. Resolver spintax (recursivo, soporta anidamiento) ──────────────────

-- Resolves spintax patterns like {Hello|Hi|Hey} by randomly selecting one option.
-- Supports nested spintax: {Good {morning|afternoon}|Hey}
-- Uses a recursive approach: resolves innermost patterns first, then works outward.

CREATE OR REPLACE FUNCTION co_resolve_spintax(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result    TEXT := p_text;
    v_start     INT;
    v_end       INT;
    v_inner     TEXT;
    v_options   TEXT[];
    v_chosen    TEXT;
    v_max_iter  INT := 1000;  -- Safety limit against infinite loops
    v_iter      INT := 0;
BEGIN
    IF v_result IS NULL THEN
        RETURN NULL;
    END IF;

    -- Iteratively resolve innermost spintax groups first (handles nesting)
    LOOP
        -- Find the innermost { } pair (one with no { inside it)
        -- Look for a '{' that is followed by content with no '{' before the next '}'
        v_start := NULL;
        v_end   := NULL;

        -- Find last '{' before the first '}'
        v_end := position('}' IN v_result);
        IF v_end = 0 THEN
            EXIT; -- No more closing braces
        END IF;

        -- Find the matching opening brace (the last '{' before v_end)
        v_start := 0;
        FOR i IN REVERSE (v_end - 1)..1 LOOP
            IF substr(v_result, i, 1) = '{' THEN
                v_start := i;
                EXIT;
            END IF;
        END LOOP;

        IF v_start = 0 THEN
            EXIT; -- No matching opening brace
        END IF;

        -- Extract the inner content (without braces)
        v_inner := substr(v_result, v_start + 1, v_end - v_start - 1);

        -- Split by pipe and randomly choose one option
        v_options := string_to_array(v_inner, '|');

        IF array_length(v_options, 1) > 0 THEN
            v_chosen := v_options[1 + floor(random() * array_length(v_options, 1))::INT];
        ELSE
            v_chosen := v_inner;
        END IF;

        -- Replace the {options} block with the chosen option
        v_result := substr(v_result, 1, v_start - 1) || v_chosen || substr(v_result, v_end + 1);

        v_iter := v_iter + 1;
        IF v_iter >= v_max_iter THEN
            RAISE WARNING 'co_resolve_spintax: límite de iteraciones alcanzado (%), posible spintax malformado', v_max_iter;
            EXIT;
        END IF;
    END LOOP;

    RETURN v_result;
END;
$$;


-- ─── 9. Resumen de reputación de dominio ───────────────────────────────────

-- Returns a JSON object with daily send/bounce/open stats for a domain
-- over the specified number of days, plus aggregate metrics.

CREATE OR REPLACE FUNCTION co_get_reputation_summary(
    p_domain_id UUID,
    p_days      INT DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_domain      RECORD;
    v_daily_stats JSON;
    v_aggregates  RECORD;
    v_result      JSON;
BEGIN
    -- Get domain info
    SELECT id, domain, health_score, warmup_day, warmup_completed, status
    INTO v_domain
    FROM ventas_co_domains
    WHERE id = p_domain_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'co_get_reputation_summary: dominio % no encontrado', p_domain_id;
    END IF;

    -- Daily stats for the period
    SELECT json_agg(
        json_build_object(
            'date',     day_date,
            'sent',     day_sent,
            'bounced',  day_bounced,
            'opened',   day_opened,
            'clicked',  day_clicked,
            'replied',  day_replied
        ) ORDER BY day_date
    )
    INTO v_daily_stats
    FROM (
        SELECT
            date_trunc('day', s.created_at)::DATE AS day_date,
            count(*)                                                          AS day_sent,
            count(*) FILTER (WHERE s.status = 'bounced')                      AS day_bounced,
            count(*) FILTER (WHERE s.opened_at IS NOT NULL)                   AS day_opened,
            count(*) FILTER (WHERE s.clicked_at IS NOT NULL)                  AS day_clicked,
            count(*) FILTER (WHERE s.replied_at IS NOT NULL)                  AS day_replied
        FROM ventas_co_sends s
        JOIN ventas_co_inboxes i ON i.id = s.inbox_id
        WHERE i.domain_id = p_domain_id
          AND s.created_at >= NOW() - make_interval(days => p_days)
        GROUP BY day_date
    ) daily;

    -- Aggregate metrics for the period
    SELECT
        COALESCE(count(*), 0)                                              AS total_sent,
        COALESCE(count(*) FILTER (WHERE s.status = 'bounced'), 0)          AS total_bounced,
        COALESCE(count(*) FILTER (WHERE s.opened_at IS NOT NULL), 0)       AS total_opened,
        COALESCE(count(*) FILTER (WHERE s.clicked_at IS NOT NULL), 0)      AS total_clicked,
        COALESCE(count(*) FILTER (WHERE s.replied_at IS NOT NULL), 0)      AS total_replied
    INTO v_aggregates
    FROM ventas_co_sends s
    JOIN ventas_co_inboxes i ON i.id = s.inbox_id
    WHERE i.domain_id = p_domain_id
      AND s.created_at >= NOW() - make_interval(days => p_days);

    v_result := json_build_object(
        'domain',             v_domain.domain,
        'healthScore',        COALESCE(v_domain.health_score, 100),
        'warmupDay',          COALESCE(v_domain.warmup_day, 0),
        'warmupCompleted',    COALESCE(v_domain.warmup_completed, FALSE),
        'status',             v_domain.status,
        'period',             json_build_object('days', p_days),
        'aggregates',         json_build_object(
            'totalSent',      v_aggregates.total_sent,
            'totalBounced',   v_aggregates.total_bounced,
            'totalOpened',    v_aggregates.total_opened,
            'totalClicked',   v_aggregates.total_clicked,
            'totalReplied',   v_aggregates.total_replied,
            'bounceRate',     CASE WHEN v_aggregates.total_sent > 0
                                  THEN round((v_aggregates.total_bounced::NUMERIC / v_aggregates.total_sent) * 100, 2)
                                  ELSE 0 END,
            'openRate',       CASE WHEN v_aggregates.total_sent > 0
                                  THEN round((v_aggregates.total_opened::NUMERIC / v_aggregates.total_sent) * 100, 2)
                                  ELSE 0 END,
            'replyRate',      CASE WHEN v_aggregates.total_sent > 0
                                  THEN round((v_aggregates.total_replied::NUMERIC / v_aggregates.total_sent) * 100, 2)
                                  ELSE 0 END
        ),
        'dailyStats',         COALESCE(v_daily_stats, '[]'::JSON)
    );

    RETURN v_result;
END;
$$;


-- ─── 10. Enrollment masivo de contactos en campaña ─────────────────────────

-- Bulk enrolls contacts into a campaign:
-- - Skips contacts already enrolled, suppressed, or bounced
-- - Sets next_step_at based on first step's delay + campaign send window
-- - Returns count of newly enrolled contacts

CREATE OR REPLACE FUNCTION co_enroll_contacts(
    p_campaign_id UUID,
    p_contact_ids UUID[]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_campaign      RECORD;
    v_first_step    RECORD;
    v_enrolled      INT := 0;
    v_next_step_at  TIMESTAMPTZ;
BEGIN
    -- Validate campaign exists
    SELECT *
    INTO v_campaign
    FROM ventas_co_campaigns
    WHERE id = p_campaign_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'co_enroll_contacts: campaña % no encontrada', p_campaign_id;
    END IF;

    -- Get first step to determine initial delay
    SELECT *
    INTO v_first_step
    FROM ventas_co_steps
    WHERE campaign_id = p_campaign_id
    ORDER BY step_order ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'co_enroll_contacts: campaña % no tiene steps configurados', p_campaign_id;
    END IF;

    -- Calculate next_step_at based on first step delay and campaign send window
    v_next_step_at := NOW() + make_interval(hours => COALESCE(v_first_step.delay_hours, 0));

    -- If campaign has a send window, adjust to fit within it
    IF v_campaign.send_window_start IS NOT NULL AND v_campaign.send_window_end IS NOT NULL THEN
        -- If next_step_at falls outside send window, push to next window start
        IF EXTRACT(HOUR FROM v_next_step_at) < v_campaign.send_window_start THEN
            v_next_step_at := date_trunc('day', v_next_step_at)
                + make_interval(hours => v_campaign.send_window_start);
        ELSIF EXTRACT(HOUR FROM v_next_step_at) >= v_campaign.send_window_end THEN
            v_next_step_at := date_trunc('day', v_next_step_at)
                + INTERVAL '1 day'
                + make_interval(hours => v_campaign.send_window_start);
        END IF;
    END IF;

    -- Bulk insert enrollments, skipping already enrolled / suppressed / bounced
    WITH eligible AS (
        SELECT c.id AS contact_id
        FROM unnest(p_contact_ids) AS cid(id)
        JOIN ventas_co_contacts c ON c.id = cid.id
        WHERE c.status = 'active'
          -- Not already enrolled in this campaign
          AND NOT EXISTS (
              SELECT 1
              FROM ventas_co_enrollments e
              WHERE e.campaign_id = p_campaign_id
                AND e.contact_id = c.id
          )
          -- Not suppressed
          AND NOT EXISTS (
              SELECT 1
              FROM ventas_co_suppressions sup
              WHERE sup.email = lower(trim(c.email))
          )
    ),
    inserted AS (
        INSERT INTO ventas_co_enrollments (
            campaign_id, contact_id, status, current_step, next_step_at,
            created_at, updated_at
        )
        SELECT
            p_campaign_id,
            eligible.contact_id,
            'active',
            1,
            v_next_step_at,
            NOW(),
            NOW()
        FROM eligible
        RETURNING id
    )
    SELECT count(*) INTO v_enrolled FROM inserted;

    RETURN v_enrolled;
END;
$$;


-- ============================================================================
-- FIN 051
-- ============================================================================
