-- ============================================================================
-- 045 - Email Marketing: RPCs (funciones remotas)
-- Funciones de servidor para contadores, segmentación dinámica, frequency cap,
-- envío atómico, funnel, cohortes y heatmap.
-- ============================================================================


-- ─── 1. Incrementar contador de campaña ───────────────────────────────────────

CREATE OR REPLACE FUNCTION em_increment_campaign_counter(
    p_campaign_id UUID,
    p_counter     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed TEXT[] := ARRAY[
        'total_sent','total_delivered','total_opened','total_clicked',
        'total_bounced','total_complained','total_unsubscribed','total_converted'
    ];
BEGIN
    IF NOT (p_counter = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Counter "%" no permitido. Permitidos: %', p_counter, v_allowed;
    END IF;

    EXECUTE format(
        'UPDATE ventas_em_campaigns SET %I = %I + 1, updated_at = now() WHERE id = $1',
        p_counter, p_counter
    ) USING p_campaign_id;
END;
$$;


-- ─── 2. Incrementar contador de contacto ──────────────────────────────────────

CREATE OR REPLACE FUNCTION em_increment_contact_counter(
    p_contact_id UUID,
    p_counter    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed TEXT[] := ARRAY['total_sent','total_opened','total_clicked'];
    v_ts_col  TEXT;
BEGIN
    IF NOT (p_counter = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Counter "%" no permitido. Permitidos: %', p_counter, v_allowed;
    END IF;

    -- Determinar columna de timestamp asociada
    CASE p_counter
        WHEN 'total_sent'    THEN v_ts_col := 'last_sent_at';
        WHEN 'total_opened'  THEN v_ts_col := 'last_opened_at';
        WHEN 'total_clicked' THEN v_ts_col := 'last_clicked_at';
    END CASE;

    EXECUTE format(
        'UPDATE ventas_em_contacts SET %I = %I + 1, %I = now(), updated_at = now() WHERE id = $1',
        p_counter, p_counter, v_ts_col
    ) USING p_contact_id;
END;
$$;


-- ─── 3. Helper: construir WHERE recursivo para segmentos ──────────────────────

CREATE OR REPLACE FUNCTION em_build_segment_where(p_rules JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator   TEXT;
    v_conditions JSONB;
    v_cond       JSONB;
    v_parts      TEXT[] := '{}';
    v_field      TEXT;
    v_op         TEXT;
    v_value      TEXT;
    v_sql_op     TEXT;
    v_clause     TEXT;
BEGIN
    -- Si el nodo tiene "operator" es un grupo AND/OR
    v_operator := p_rules ->> 'operator';

    IF v_operator IS NOT NULL THEN
        v_conditions := p_rules -> 'conditions';

        IF v_conditions IS NULL OR jsonb_array_length(v_conditions) = 0 THEN
            RETURN 'TRUE';
        END IF;

        FOR i IN 0 .. jsonb_array_length(v_conditions) - 1 LOOP
            v_cond := v_conditions -> i;
            v_parts := array_append(v_parts, '(' || em_build_segment_where(v_cond) || ')');
        END LOOP;

        IF upper(v_operator) = 'AND' THEN
            RETURN array_to_string(v_parts, ' AND ');
        ELSIF upper(v_operator) = 'OR' THEN
            RETURN array_to_string(v_parts, ' OR ');
        ELSE
            RETURN 'TRUE';
        END IF;
    END IF;

    -- Nodo hoja: {field, op, value}
    v_field := p_rules ->> 'field';
    v_op    := p_rules ->> 'op';
    v_value := p_rules ->> 'value';

    IF v_field IS NULL OR v_op IS NULL THEN
        RETURN 'TRUE';
    END IF;

    -- Mapear operadores
    CASE v_op
        WHEN '='        THEN v_sql_op := '=';
        WHEN '!='       THEN v_sql_op := '!=';
        WHEN 'eq'       THEN v_sql_op := '=';
        WHEN 'gt'       THEN v_sql_op := '>';
        WHEN 'lt'       THEN v_sql_op := '<';
        WHEN 'gte'      THEN v_sql_op := '>=';
        WHEN 'lte'      THEN v_sql_op := '<=';
        WHEN 'contains' THEN
            -- Para tags (array) o campos texto
            IF v_field = 'tags' THEN
                RETURN format('c.preference_categories @> ARRAY[%L]', v_value);
            ELSE
                RETURN format('%s ILIKE %L',
                    CASE v_field
                        WHEN 'fuente' THEN 'l.fuente'
                        WHEN 'empresa' THEN 'c.empresa'
                        ELSE 'c.' || quote_ident(v_field)
                    END,
                    '%' || v_value || '%');
            END IF;
        ELSE v_sql_op := '=';
    END CASE;

    -- Determinar tabla según campo
    CASE v_field
        WHEN 'status'           THEN v_clause := format('c.status %s %L', v_sql_op, v_value);
        WHEN 'provider'         THEN v_clause := format('c.provider %s %L', v_sql_op, v_value);
        WHEN 'engagement_score' THEN v_clause := format('c.engagement_score %s %s', v_sql_op, v_value::INT);
        WHEN 'lead_score'       THEN v_clause := format('c.lead_score %s %s', v_sql_op, v_value::INT);
        WHEN 'total_sent'       THEN v_clause := format('c.total_sent %s %s', v_sql_op, v_value::INT);
        WHEN 'total_opened'     THEN v_clause := format('c.total_opened %s %s', v_sql_op, v_value::INT);
        WHEN 'total_clicked'    THEN v_clause := format('c.total_clicked %s %s', v_sql_op, v_value::INT);
        WHEN 'empresa'          THEN v_clause := format('c.empresa %s %L', v_sql_op, v_value);
        WHEN 'fuente'           THEN v_clause := format('l.fuente %s %L', v_sql_op, v_value);
        ELSE v_clause := 'TRUE';
    END CASE;

    RETURN v_clause;
END;
$$;


-- ─── 3b. Evaluar segmento ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION em_evaluate_segment(p_segment_id UUID)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rules  JSONB;
    v_where  TEXT;
    v_sql    TEXT;
BEGIN
    SELECT rules INTO v_rules
    FROM ventas_em_segments
    WHERE id = p_segment_id;

    IF v_rules IS NULL OR v_rules = '{}'::JSONB OR v_rules = 'null'::JSONB THEN
        -- Sin reglas → devolver todos los contactos activos
        RETURN QUERY SELECT c.id FROM ventas_em_contacts c WHERE c.status = 'active';
        RETURN;
    END IF;

    v_where := em_build_segment_where(v_rules);

    v_sql := format(
        'SELECT c.id FROM ventas_em_contacts c '
        'LEFT JOIN ventas_leads l ON l.id = c.lead_id '
        'WHERE c.status = ''active'' AND (%s)',
        v_where
    );

    RETURN QUERY EXECUTE v_sql;

    -- Actualizar conteo y timestamp
    UPDATE ventas_em_segments
    SET contact_count   = (SELECT count(*) FROM ventas_em_contacts c
                           LEFT JOIN ventas_leads l ON l.id = c.lead_id
                           WHERE c.status = 'active'
                           AND (SELECT em_build_segment_where(v_rules)) IS NOT NULL),
        last_evaluated_at = now()
    WHERE id = p_segment_id;
END;
$$;


-- ─── 4. Verificar frequency cap ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION em_check_frequency_cap(
    p_contact_id UUID,
    p_hours      INT DEFAULT 72
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM ventas_em_sends
        WHERE contact_id = p_contact_id
          AND status != 'failed'
          AND created_at >= now() - make_interval(hours => p_hours)
    ) INTO v_exists;

    RETURN v_exists;
END;
$$;


-- ─── 5. Reclamar próximos envíos (atómico, skip locked) ──────────────────────

CREATE OR REPLACE FUNCTION em_claim_next_send(
    p_campaign_id UUID,
    p_limit       INT DEFAULT 50
)
RETURNS SETOF ventas_em_sends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT s.id
        FROM ventas_em_sends s
        WHERE s.campaign_id = p_campaign_id
          AND s.status = 'queued'
          AND (s.scheduled_for IS NULL OR s.scheduled_for <= now())
        ORDER BY s.priority ASC, s.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE ventas_em_sends
    SET status = 'sending'
    FROM claimed
    WHERE ventas_em_sends.id = claimed.id
    RETURNING ventas_em_sends.*;
END;
$$;


-- ─── 6. Datos de funnel de una campaña ────────────────────────────────────────

CREATE OR REPLACE FUNCTION em_get_funnel_data(p_campaign_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'sent',      COALESCE(total_sent, 0),
        'delivered',  COALESCE(total_delivered, 0),
        'opened',     COALESCE(total_opened, 0),
        'clicked',    COALESCE(total_clicked, 0),
        'converted',  COALESCE(total_converted, 0)
    ) INTO v_result
    FROM ventas_em_campaigns
    WHERE id = p_campaign_id;

    RETURN COALESCE(v_result, '{"sent":0,"delivered":0,"opened":0,"clicked":0,"converted":0}'::JSON);
END;
$$;


-- ─── 7. Datos de cohortes ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION em_get_cohort_data(p_days INT DEFAULT 90)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    WITH cohorts AS (
        SELECT
            date_trunc('week', c.created_at)::DATE AS cohort_week,
            c.id AS contact_id
        FROM ventas_em_contacts c
        WHERE c.created_at >= now() - make_interval(days => p_days)
    ),
    activity AS (
        SELECT
            co.cohort_week,
            date_trunc('week', s.opened_at)::DATE AS activity_week,
            co.contact_id
        FROM cohorts co
        JOIN ventas_em_sends s ON s.contact_id = co.contact_id
        WHERE s.opened_at IS NOT NULL
    ),
    cohort_totals AS (
        SELECT cohort_week, count(DISTINCT contact_id) AS total_count
        FROM cohorts
        GROUP BY cohort_week
    ),
    weekly_activity AS (
        SELECT
            a.cohort_week,
            a.activity_week,
            count(DISTINCT a.contact_id) AS active_count
        FROM activity a
        GROUP BY a.cohort_week, a.activity_week
    ),
    combined AS (
        SELECT
            ct.cohort_week,
            ct.total_count,
            json_agg(
                json_build_object(
                    'week', wa.activity_week,
                    'active_count', wa.active_count,
                    'total_count', ct.total_count
                ) ORDER BY wa.activity_week
            ) AS weeks
        FROM cohort_totals ct
        LEFT JOIN weekly_activity wa ON wa.cohort_week = ct.cohort_week
        GROUP BY ct.cohort_week, ct.total_count
    )
    SELECT json_agg(
        json_build_object(
            'cohort_week', combined.cohort_week,
            'weeks', combined.weeks
        ) ORDER BY combined.cohort_week
    ) INTO v_result
    FROM combined;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;


-- ─── 8. Heatmap de horas de apertura ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION em_get_open_heatmap()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'hour', oh.hour_utc,
            'count', oh.total_opens
        ) ORDER BY oh.hour_utc
    ) INTO v_result
    FROM (
        SELECT hour_utc, sum(open_count) AS total_opens
        FROM ventas_em_open_hours
        GROUP BY hour_utc
    ) oh;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;


-- ============================================================================
-- FIN 045
-- ============================================================================
