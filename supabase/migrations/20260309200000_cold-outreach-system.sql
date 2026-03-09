-- ============================================================================
-- 050 - Cold Outreach System (ventas_co_*)
-- Sistema completo de cold outreach con multi-step cadences, warmup agresivo,
-- rotación de inboxes, spintax, STO, A/B testing, AI reply classification,
-- reputation monitoring, blacklist tracking y suppression global.
-- Más potente que BodaLab: warmup 60 días hasta 1600/día, smart throttle,
-- send-time optimization, engagement scoring y auto-pause por reputación.
-- ============================================================================


-- ─── 1. SENDING DOMAINS ──────────────────────────────────────────────────────
-- Dominios de envío con verificación SPF/DKIM/DMARC, health score y warmup.

CREATE TABLE IF NOT EXISTS ventas_co_domains (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain              TEXT NOT NULL UNIQUE,                          -- e.g. 'em.madrigalmarketing.es'
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','verifying','active','suspended','blacklisted')),
    provider            TEXT NOT NULL DEFAULT 'resend',                -- email sending provider
    daily_limit         INT NOT NULL DEFAULT 50,
    warmup_day          INT NOT NULL DEFAULT 0,
    warmup_completed    BOOLEAN NOT NULL DEFAULT false,
    health_score        INT NOT NULL DEFAULT 100
                            CHECK (health_score BETWEEN 0 AND 100),

    -- DNS verification
    spf_verified        BOOLEAN NOT NULL DEFAULT false,
    dkim_verified       BOOLEAN NOT NULL DEFAULT false,
    dmarc_verified      BOOLEAN NOT NULL DEFAULT false,
    last_health_check   TIMESTAMPTZ,

    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas_co_domains IS 'Dominios de envío para cold outreach con seguimiento de warmup y health';


-- ─── 2. SENDING INBOXES ──────────────────────────────────────────────────────
-- Múltiples buzones por dominio para rotación inteligente.

CREATE TABLE IF NOT EXISTS ventas_co_inboxes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id           UUID NOT NULL REFERENCES ventas_co_domains(id) ON DELETE CASCADE,
    email               TEXT NOT NULL UNIQUE,                          -- e.g. 'juan@em.madrigalmarketing.es'
    display_name        TEXT NOT NULL,                                 -- e.g. 'Juan Ramos'
    daily_limit         INT NOT NULL DEFAULT 30,
    sent_today          INT NOT NULL DEFAULT 0,
    sent_today_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    warmup_mode         BOOLEAN NOT NULL DEFAULT true,
    signature_html      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas_co_inboxes IS 'Buzones de envío con rotación, límites diarios y modo warmup';


-- ─── 3. CONTACT LISTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_lists (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    description         TEXT,
    total_contacts      INT NOT NULL DEFAULT 0,
    source              TEXT CHECK (source IN ('import','manual','scrape','api')),
    tags                TEXT[] NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas_co_lists IS 'Listas de contactos para campañas de cold outreach';


-- ─── 4. CONTACTS ─────────────────────────────────────────────────────────────
-- Contactos con scoring, engagement tracking y optimización de envío.

CREATE TABLE IF NOT EXISTS ventas_co_contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id             UUID REFERENCES ventas_co_lists(id) ON DELETE SET NULL,
    email               TEXT NOT NULL,
    first_name          TEXT,
    last_name           TEXT,
    company             TEXT,
    job_title           TEXT,
    phone               TEXT,
    linkedin_url        TEXT,
    website             TEXT,
    custom_fields       JSONB NOT NULL DEFAULT '{}',

    status              TEXT NOT NULL DEFAULT 'new'
                            CHECK (status IN (
                                'new','verified','contacted','opened','clicked',
                                'replied','interested','not_interested','converted',
                                'bounced','unsubscribed','invalid'
                            )),

    -- Email verification
    email_verified      BOOLEAN NOT NULL DEFAULT false,
    email_provider      TEXT CHECK (email_provider IN ('gmail','outlook','yahoo','other')),
    is_catch_all        BOOLEAN,

    -- Scoring
    lead_score          INT NOT NULL DEFAULT 0   CHECK (lead_score BETWEEN 0 AND 100),
    engagement_score    INT NOT NULL DEFAULT 0   CHECK (engagement_score BETWEEN 0 AND 100),

    -- Activity timestamps
    last_contacted_at   TIMESTAMPTZ,
    last_opened_at      TIMESTAMPTZ,
    last_replied_at     TIMESTAMPTZ,

    -- Counters
    times_contacted     INT NOT NULL DEFAULT 0,
    times_opened        INT NOT NULL DEFAULT 0,
    times_clicked       INT NOT NULL DEFAULT 0,

    -- Send-time optimization
    timezone            TEXT,
    best_send_hour      INT CHECK (best_send_hour BETWEEN 0 AND 23),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (list_id, email)
);

COMMENT ON TABLE ventas_co_contacts IS 'Contactos de cold outreach con scoring, verificación y optimización STO';


-- ─── 5. CAMPAIGNS ────────────────────────────────────────────────────────────
-- Campañas de outreach con cadencias multi-step, A/B testing y smart throttle.

CREATE TABLE IF NOT EXISTS ventas_co_campaigns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    description             TEXT,
    status                  TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','paused','completed','archived')),
    type                    TEXT NOT NULL DEFAULT 'outreach'
                                CHECK (type IN ('outreach','follow_up','nurture','reengagement')),

    -- Targeting
    list_id                 UUID REFERENCES ventas_co_lists(id) ON DELETE SET NULL,
    inbox_ids               UUID[] NOT NULL DEFAULT '{}',              -- múltiples inboxes para rotación

    -- Schedule
    timezone                TEXT NOT NULL DEFAULT 'Europe/Madrid',
    send_window_start       INT NOT NULL DEFAULT 8   CHECK (send_window_start BETWEEN 0 AND 23),
    send_window_end         INT NOT NULL DEFAULT 19  CHECK (send_window_end BETWEEN 0 AND 23),
    send_days               INT[] NOT NULL DEFAULT '{1,2,3,4,5}',     -- 1=Monday … 7=Sunday

    -- Limits
    daily_limit             INT NOT NULL DEFAULT 50,

    -- Aggregate counters
    total_sent              INT NOT NULL DEFAULT 0,
    total_opened            INT NOT NULL DEFAULT 0,
    total_clicked           INT NOT NULL DEFAULT 0,
    total_replied           INT NOT NULL DEFAULT 0,
    total_bounced           INT NOT NULL DEFAULT 0,
    total_unsubscribed      INT NOT NULL DEFAULT 0,
    total_converted         INT NOT NULL DEFAULT 0,

    -- Safety thresholds
    bounce_threshold        NUMERIC NOT NULL DEFAULT 0.02,
    complaint_threshold     NUMERIC NOT NULL DEFAULT 0.001,
    auto_pause_enabled      BOOLEAN NOT NULL DEFAULT true,

    -- Features
    use_spintax             BOOLEAN NOT NULL DEFAULT true,
    use_smart_throttle      BOOLEAN NOT NULL DEFAULT true,
    use_sto                 BOOLEAN NOT NULL DEFAULT true,             -- send-time optimization
    ab_testing              BOOLEAN NOT NULL DEFAULT false,

    -- Ownership
    created_by              UUID REFERENCES usuarios(id) ON DELETE SET NULL,

    -- Lifecycle
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas_co_campaigns IS 'Campañas de cold outreach con cadencias, rotación de inboxes y auto-pause';


-- ─── 6. CAMPAIGN STEPS ───────────────────────────────────────────────────────
-- Pasos multi-step: email, delay, condición, tarea manual, LinkedIn.

CREATE TABLE IF NOT EXISTS ventas_co_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES ventas_co_campaigns(id) ON DELETE CASCADE,
    step_number         INT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'email'
                            CHECK (type IN ('email','delay','condition','task','linkedin')),

    -- Email content (supports spintax: {Hi|Hello|Hey} and {{variables}})
    subject             TEXT,
    body_html           TEXT,
    body_text           TEXT,

    -- Timing
    delay_days          INT NOT NULL DEFAULT 0,
    delay_hours         INT NOT NULL DEFAULT 0,

    -- Conditions (for conditional steps)
    condition_type      TEXT CHECK (condition_type IN (
                            'opened','clicked','replied',
                            'not_opened','not_clicked','not_replied'
                        )),
    condition_step_ref  INT,                                          -- step_number to check condition against

    -- A/B testing variants
    ab_variants         JSONB[] DEFAULT NULL,                         -- [{subject, body_html, body_text}, ...]

    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (campaign_id, step_number)
);

COMMENT ON TABLE ventas_co_steps IS 'Pasos de cadencia: email, delay, condición, tarea o LinkedIn con spintax y A/B';


-- ─── 7. ENROLLMENTS ──────────────────────────────────────────────────────────
-- Inscripción de contactos en campañas con seguimiento de progreso.

CREATE TABLE IF NOT EXISTS ventas_co_enrollments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES ventas_co_campaigns(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES ventas_co_contacts(id) ON DELETE CASCADE,
    current_step        INT NOT NULL DEFAULT 1,
    status              TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN (
                                'active','paused','completed','replied',
                                'bounced','unsubscribed','converted','errored'
                            )),
    enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_step_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (campaign_id, contact_id)
);

COMMENT ON TABLE ventas_co_enrollments IS 'Inscripciones de contactos en campañas con progreso por step';


-- ─── 8. SENDS ────────────────────────────────────────────────────────────────
-- Cada envío individual con tracking completo de lifecycle.

CREATE TABLE IF NOT EXISTS ventas_co_sends (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID REFERENCES ventas_co_campaigns(id) ON DELETE SET NULL,
    step_id             UUID REFERENCES ventas_co_steps(id) ON DELETE SET NULL,
    enrollment_id       UUID REFERENCES ventas_co_enrollments(id) ON DELETE SET NULL,
    contact_id          UUID REFERENCES ventas_co_contacts(id) ON DELETE SET NULL,
    inbox_id            UUID REFERENCES ventas_co_inboxes(id) ON DELETE SET NULL,

    subject             TEXT NOT NULL,
    body_html           TEXT NOT NULL,

    status              TEXT NOT NULL DEFAULT 'queued'
                            CHECK (status IN (
                                'queued','sending','sent','delivered','opened',
                                'clicked','replied','bounced','complained','failed'
                            )),

    -- Provider tracking
    resend_id           TEXT,
    idempotency_key     TEXT UNIQUE,
    variant_index       INT,

    -- Lifecycle timestamps
    scheduled_for       TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    opened_at           TIMESTAMPTZ,
    clicked_at          TIMESTAMPTZ,
    replied_at          TIMESTAMPTZ,
    bounced_at          TIMESTAMPTZ,

    -- Bounce details
    bounce_type         TEXT CHECK (bounce_type IN ('hard','soft')),
    bounce_reason       TEXT,
    error_message       TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas_co_sends IS 'Envíos individuales con lifecycle completo: queued → sent → delivered → opened/clicked/replied';


-- ─── 9. CLICK TRACKING ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_clicks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_id             UUID NOT NULL REFERENCES ventas_co_sends(id) ON DELETE CASCADE,
    contact_id          UUID REFERENCES ventas_co_contacts(id) ON DELETE SET NULL,
    url                 TEXT NOT NULL,
    clicked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent          TEXT,
    ip_address          TEXT
);

COMMENT ON TABLE ventas_co_clicks IS 'Tracking de clics en enlaces con URL, user agent e IP';


-- ─── 10. REPLY TRACKING & AI CLASSIFICATION ─────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_replies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_id             UUID REFERENCES ventas_co_sends(id) ON DELETE SET NULL,
    contact_id          UUID REFERENCES ventas_co_contacts(id) ON DELETE SET NULL,
    campaign_id         UUID REFERENCES ventas_co_campaigns(id) ON DELETE SET NULL,

    from_email          TEXT NOT NULL,
    subject             TEXT,
    body_text           TEXT,
    body_html           TEXT,

    -- AI classification
    classification      TEXT CHECK (classification IN (
                            'interested','not_interested','out_of_office',
                            'unsubscribe','question','referral','other'
                        )),
    sentiment           TEXT CHECK (sentiment IN ('positive','neutral','negative')),
    ai_summary          TEXT,

    -- Action tracking
    requires_action     BOOLEAN NOT NULL DEFAULT false,
    actioned            BOOLEAN NOT NULL DEFAULT false,
    actioned_by         UUID REFERENCES usuarios(id) ON DELETE SET NULL,

    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    classified_at       TIMESTAMPTZ
);

COMMENT ON TABLE ventas_co_replies IS 'Respuestas recibidas con clasificación AI: sentimiento, intención y resumen';


-- ─── 11. GLOBAL SUPPRESSION LIST ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_suppressions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT NOT NULL UNIQUE,
    reason              TEXT NOT NULL
                            CHECK (reason IN (
                                'bounce_hard','bounce_soft_repeated','complained',
                                'unsubscribed','manual','invalid','blacklisted'
                            )),
    source              TEXT,
    suppressed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes               TEXT
);

COMMENT ON TABLE ventas_co_suppressions IS 'Lista global de supresión: nunca enviar a estos emails';


-- ─── 12. WARMUP SCHEDULE (60 DAYS, AGGRESSIVE) ──────────────────────────────
-- Más agresivo que BodaLab: alcanza 1600 envíos/día en 60 días.

CREATE TABLE IF NOT EXISTS ventas_co_warmup_schedule (
    day                 INT PRIMARY KEY,
    max_sends           INT NOT NULL,
    description         TEXT
);

COMMENT ON TABLE ventas_co_warmup_schedule IS 'Plan de warmup de 60 días: más agresivo que BodaLab, hasta 1600/día';

INSERT INTO ventas_co_warmup_schedule (day, max_sends, description) VALUES
    -- Semana 1: Inicio conservador (2-18)
    ( 1,    2, 'Inicio mínimo – establecer reputación'),
    ( 2,    3, 'Incremento suave'),
    ( 3,    5, 'Primeros contactos de prueba'),
    ( 4,    7, 'Monitorizar bounces'),
    ( 5,   10, 'Primera revisión de deliverability'),
    ( 6,   14, 'Incremento si sin bounces'),
    ( 7,   18, 'Fin semana 1 – revisar métricas'),

    -- Semana 2: Aceleración (23-67)
    ( 8,   23, 'Inicio semana 2 – acelerar'),
    ( 9,   28, 'Monitorizar open rates'),
    (10,   35, 'Revisión SPF/DKIM/DMARC'),
    (11,   42, 'Incremento sostenido'),
    (12,   50, 'Hito: 50 envíos/día'),
    (13,   58, 'Verificar inbox placement'),
    (14,   67, 'Fin semana 2 – consolidar'),

    -- Semana 3: Crecimiento fuerte (77-140)
    (15,   77, 'Inicio semana 3 – crecimiento fuerte'),
    (16,   88, 'Monitorizar complaint rate'),
    (17,  100, 'Hito: 100 envíos/día'),
    (18,  112, 'Verificar blacklists'),
    (19,  125, 'Incremento agresivo'),
    (20,  140, 'Fin semana 3 – 140/día'),

    -- Semana 4: Escalada (155-325)
    (21,  155, 'Inicio semana 4 – escalada'),
    (22,  170, 'Monitorizar engagement'),
    (23,  185, 'Verificar sender reputation'),
    (24,  200, 'Hito: 200 envíos/día'),
    (25,  220, 'Incremento acelerado'),
    (26,  240, 'Revisar bounce rate < 2%'),
    (27,  260, 'Incremento sostenido'),
    (28,  280, 'Verificar inbox placement tests'),
    (29,  300, 'Hito: 300 envíos/día'),
    (30,  325, 'Fin mes 1 – 325/día'),

    -- Semana 5-6: Escala media (350-615)
    (31,  350, 'Inicio mes 2 – escala media'),
    (32,  375, 'Monitorizar deliverability'),
    (33,  400, 'Hito: 400 envíos/día'),
    (34,  430, 'Incremento constante'),
    (35,  460, 'Verificar todos los indicadores'),
    (36,  490, 'Casi 500/día'),
    (37,  520, 'Hito: 500+ envíos/día'),
    (38,  550, 'Escala media-alta'),
    (39,  580, 'Monitorizar complaints < 0.1%'),
    (40,  615, 'Fin semana 6 – 615/día'),

    -- Semana 7-8: Escala alta (650-1000)
    (41,  650, 'Inicio escala alta'),
    (42,  690, 'Incremento agresivo'),
    (43,  730, 'Verificar postmaster tools'),
    (44,  770, 'Monitorizar engagement rates'),
    (45,  810, 'Hito: 800+ envíos/día'),
    (46,  855, 'Escala alta sostenida'),
    (47,  900, 'Hito: 900 envíos/día'),
    (48,  950, 'Casi 1000/día'),
    (49, 1000, 'HITO: 1000 envíos/día'),
    (50, 1050, 'Superando 1000/día'),

    -- Semana 9-10: Máxima escala (1100-1600)
    (51, 1100, 'Escala máxima – fase final'),
    (52, 1150, 'Incremento constante'),
    (53, 1200, 'Hito: 1200 envíos/día'),
    (54, 1260, 'Monitorizar todo'),
    (55, 1320, 'Escala máxima sostenida'),
    (56, 1380, 'Verificar reputación completa'),
    (57, 1440, 'Casi máximo'),
    (58, 1500, 'Hito: 1500 envíos/día'),
    (59, 1560, 'Penúltimo día'),
    (60, 1600, 'WARMUP COMPLETO – 1600 envíos/día máximo')
ON CONFLICT (day) DO NOTHING;


-- ─── 13. REPUTATION LOG ─────────────────────────────────────────────────────
-- Tracking diario de reputación por dominio.

CREATE TABLE IF NOT EXISTS ventas_co_reputation_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id           UUID NOT NULL REFERENCES ventas_co_domains(id) ON DELETE CASCADE,
    date                DATE NOT NULL,

    -- Counters
    sent                INT NOT NULL DEFAULT 0,
    delivered           INT NOT NULL DEFAULT 0,
    opened              INT NOT NULL DEFAULT 0,
    clicked             INT NOT NULL DEFAULT 0,
    bounced             INT NOT NULL DEFAULT 0,
    complained          INT NOT NULL DEFAULT 0,
    unsubscribed        INT NOT NULL DEFAULT 0,
    replied             INT NOT NULL DEFAULT 0,

    -- Calculated rates
    delivery_rate       NUMERIC,
    open_rate           NUMERIC,
    click_rate          NUMERIC,
    bounce_rate         NUMERIC,
    reply_rate          NUMERIC,

    health_status       TEXT CHECK (health_status IN ('excellent','good','warning','critical')),

    UNIQUE (domain_id, date)
);

COMMENT ON TABLE ventas_co_reputation_log IS 'Métricas diarias de reputación por dominio con rates calculados';


-- ─── 14. EMAIL VERIFICATIONS CACHE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_email_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT NOT NULL UNIQUE,
    is_valid            BOOLEAN,
    is_catch_all        BOOLEAN,
    provider            TEXT,
    mx_records          TEXT[],
    verified_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_result          JSONB
);

COMMENT ON TABLE ventas_co_email_verifications IS 'Caché de verificación de emails: validez, catch-all, MX records';


-- ─── 15. BLACKLIST MONITORING ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_blacklists (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id           UUID NOT NULL REFERENCES ventas_co_domains(id) ON DELETE CASCADE,
    blacklist_name      TEXT NOT NULL,
    listed              BOOLEAN NOT NULL DEFAULT false,
    listed_at           TIMESTAMPTZ,
    delisted_at         TIMESTAMPTZ,
    last_checked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (domain_id, blacklist_name)
);

COMMENT ON TABLE ventas_co_blacklists IS 'Monitorización de blacklists por dominio: Spamhaus, Barracuda, etc.';


-- ─── 16. SETTINGS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_settings (
    key                 TEXT PRIMARY KEY,
    value               TEXT NOT NULL,
    description         TEXT
);

COMMENT ON TABLE ventas_co_settings IS 'Configuración key-value del sistema de cold outreach';

-- Default settings
INSERT INTO ventas_co_settings (key, value, description) VALUES
    ('global_daily_limit',      '500',   'Límite global diario de envíos en todo el sistema'),
    ('min_delay_between_sends', '45',    'Segundos mínimos entre envíos (throttling)'),
    ('max_delay_between_sends', '120',   'Segundos máximos entre envíos (throttling)'),
    ('bounce_pause_threshold',  '0.05',  'Bounce rate que pausa automáticamente campañas'),
    ('complaint_pause_threshold','0.002','Complaint rate que pausa automáticamente campañas'),
    ('verification_required',   'true',  'Requerir verificación de email antes de enviar'),
    ('track_opens',             'true',  'Tracking de aperturas con pixel'),
    ('track_clicks',            'true',  'Tracking de clics con redirect'),
    ('unsubscribe_header',      'true',  'Incluir header List-Unsubscribe'),
    ('warmup_auto_increment',   'true',  'Incrementar warmup automáticamente cada día')
ON CONFLICT (key) DO NOTHING;


-- ─── 17. AUDIT LOG ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_co_audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    action              TEXT NOT NULL,
    entity_type         TEXT,
    entity_id           UUID,
    details             JSONB,
    performed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ventas_co_audit_log IS 'Log de auditoría: todas las acciones del sistema de cold outreach';


-- ============================================================================
-- INDEXES
-- ============================================================================

-- Domains
CREATE INDEX IF NOT EXISTS idx_co_domains_status ON ventas_co_domains(status);

-- Inboxes
CREATE INDEX IF NOT EXISTS idx_co_inboxes_domain_id ON ventas_co_inboxes(domain_id);
CREATE INDEX IF NOT EXISTS idx_co_inboxes_is_active ON ventas_co_inboxes(is_active) WHERE is_active = true;

-- Lists
CREATE INDEX IF NOT EXISTS idx_co_lists_tags ON ventas_co_lists USING GIN(tags);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_co_contacts_list_id ON ventas_co_contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_co_contacts_email ON ventas_co_contacts(email);
CREATE INDEX IF NOT EXISTS idx_co_contacts_status ON ventas_co_contacts(status);
CREATE INDEX IF NOT EXISTS idx_co_contacts_lead_score ON ventas_co_contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_co_contacts_engagement ON ventas_co_contacts(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_co_contacts_company ON ventas_co_contacts(company) WHERE company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_co_contacts_custom_fields ON ventas_co_contacts USING GIN(custom_fields);
CREATE INDEX IF NOT EXISTS idx_co_contacts_last_contacted ON ventas_co_contacts(last_contacted_at);

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_co_campaigns_status ON ventas_co_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_co_campaigns_type ON ventas_co_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_co_campaigns_list_id ON ventas_co_campaigns(list_id);
CREATE INDEX IF NOT EXISTS idx_co_campaigns_created_by ON ventas_co_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_co_campaigns_started_at ON ventas_co_campaigns(started_at);

-- Steps
CREATE INDEX IF NOT EXISTS idx_co_steps_campaign_id ON ventas_co_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_co_steps_type ON ventas_co_steps(type);

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_co_enrollments_campaign_id ON ventas_co_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_co_enrollments_contact_id ON ventas_co_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_co_enrollments_status ON ventas_co_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_co_enrollments_next_step ON ventas_co_enrollments(next_step_at)
    WHERE status = 'active';

-- Sends
CREATE INDEX IF NOT EXISTS idx_co_sends_campaign_id ON ventas_co_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_co_sends_step_id ON ventas_co_sends(step_id);
CREATE INDEX IF NOT EXISTS idx_co_sends_enrollment_id ON ventas_co_sends(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_co_sends_contact_id ON ventas_co_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_co_sends_inbox_id ON ventas_co_sends(inbox_id);
CREATE INDEX IF NOT EXISTS idx_co_sends_status ON ventas_co_sends(status);
CREATE INDEX IF NOT EXISTS idx_co_sends_scheduled_for ON ventas_co_sends(scheduled_for)
    WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_co_sends_sent_at ON ventas_co_sends(sent_at);
CREATE INDEX IF NOT EXISTS idx_co_sends_resend_id ON ventas_co_sends(resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_co_sends_created_at ON ventas_co_sends(created_at);

-- Clicks
CREATE INDEX IF NOT EXISTS idx_co_clicks_send_id ON ventas_co_clicks(send_id);
CREATE INDEX IF NOT EXISTS idx_co_clicks_contact_id ON ventas_co_clicks(contact_id);
CREATE INDEX IF NOT EXISTS idx_co_clicks_clicked_at ON ventas_co_clicks(clicked_at);

-- Replies
CREATE INDEX IF NOT EXISTS idx_co_replies_send_id ON ventas_co_replies(send_id);
CREATE INDEX IF NOT EXISTS idx_co_replies_contact_id ON ventas_co_replies(contact_id);
CREATE INDEX IF NOT EXISTS idx_co_replies_campaign_id ON ventas_co_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_co_replies_classification ON ventas_co_replies(classification);
CREATE INDEX IF NOT EXISTS idx_co_replies_requires_action ON ventas_co_replies(requires_action)
    WHERE requires_action = true AND actioned = false;
CREATE INDEX IF NOT EXISTS idx_co_replies_received_at ON ventas_co_replies(received_at);

-- Suppressions
CREATE INDEX IF NOT EXISTS idx_co_suppressions_reason ON ventas_co_suppressions(reason);

-- Reputation log
CREATE INDEX IF NOT EXISTS idx_co_reputation_domain_id ON ventas_co_reputation_log(domain_id);
CREATE INDEX IF NOT EXISTS idx_co_reputation_date ON ventas_co_reputation_log(date);
CREATE INDEX IF NOT EXISTS idx_co_reputation_health ON ventas_co_reputation_log(health_status);

-- Email verifications
CREATE INDEX IF NOT EXISTS idx_co_verifications_is_valid ON ventas_co_email_verifications(is_valid);

-- Blacklists
CREATE INDEX IF NOT EXISTS idx_co_blacklists_domain_id ON ventas_co_blacklists(domain_id);
CREATE INDEX IF NOT EXISTS idx_co_blacklists_listed ON ventas_co_blacklists(listed) WHERE listed = true;

-- Audit log
CREATE INDEX IF NOT EXISTS idx_co_audit_user_id ON ventas_co_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_co_audit_action ON ventas_co_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_co_audit_entity ON ventas_co_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_co_audit_performed_at ON ventas_co_audit_log(performed_at);


-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION co_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    -- Domains
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_domains_updated_at') THEN
        CREATE TRIGGER trg_co_domains_updated_at
            BEFORE UPDATE ON ventas_co_domains
            FOR EACH ROW EXECUTE FUNCTION co_set_updated_at();
    END IF;

    -- Inboxes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_inboxes_updated_at') THEN
        CREATE TRIGGER trg_co_inboxes_updated_at
            BEFORE UPDATE ON ventas_co_inboxes
            FOR EACH ROW EXECUTE FUNCTION co_set_updated_at();
    END IF;

    -- Lists
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_lists_updated_at') THEN
        CREATE TRIGGER trg_co_lists_updated_at
            BEFORE UPDATE ON ventas_co_lists
            FOR EACH ROW EXECUTE FUNCTION co_set_updated_at();
    END IF;

    -- Contacts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_contacts_updated_at') THEN
        CREATE TRIGGER trg_co_contacts_updated_at
            BEFORE UPDATE ON ventas_co_contacts
            FOR EACH ROW EXECUTE FUNCTION co_set_updated_at();
    END IF;

    -- Campaigns
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_campaigns_updated_at') THEN
        CREATE TRIGGER trg_co_campaigns_updated_at
            BEFORE UPDATE ON ventas_co_campaigns
            FOR EACH ROW EXECUTE FUNCTION co_set_updated_at();
    END IF;

    -- Steps
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_steps_updated_at') THEN
        CREATE TRIGGER trg_co_steps_updated_at
            BEFORE UPDATE ON ventas_co_steps
            FOR EACH ROW EXECUTE FUNCTION co_set_updated_at();
    END IF;

    -- Enrollments
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_enrollments_updated_at') THEN
        CREATE TRIGGER trg_co_enrollments_updated_at
            BEFORE UPDATE ON ventas_co_enrollments
            FOR EACH ROW EXECUTE FUNCTION co_set_updated_at();
    END IF;
END $$;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE ventas_co_domains             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_inboxes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_lists               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_steps               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_enrollments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_sends               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_clicks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_replies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_suppressions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_warmup_schedule     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_reputation_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_blacklists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_co_audit_log           ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users have full access
-- (In production, refine these per role via the RBAC system)

CREATE POLICY co_domains_all ON ventas_co_domains
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_inboxes_all ON ventas_co_inboxes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_lists_all ON ventas_co_lists
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_contacts_all ON ventas_co_contacts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_campaigns_all ON ventas_co_campaigns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_steps_all ON ventas_co_steps
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_enrollments_all ON ventas_co_enrollments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_sends_all ON ventas_co_sends
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_clicks_all ON ventas_co_clicks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_replies_all ON ventas_co_replies
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_suppressions_all ON ventas_co_suppressions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_warmup_all ON ventas_co_warmup_schedule
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_reputation_all ON ventas_co_reputation_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_verifications_all ON ventas_co_email_verifications
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_blacklists_all ON ventas_co_blacklists
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_settings_all ON ventas_co_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY co_audit_all ON ventas_co_audit_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- DONE
-- ============================================================================
-- Sistema de cold outreach completo con:
--  • 17 tablas con prefijo ventas_co_
--  • Warmup agresivo de 60 días (2 → 1600 envíos/día)
--  • Multi-step cadences con condiciones y delays
--  • Rotación de inboxes con límites diarios
--  • Spintax, A/B testing y send-time optimization
--  • AI reply classification (sentimiento + intención)
--  • Reputation tracking diario por dominio
--  • Blacklist monitoring y suppression global
--  • Email verification cache
--  • Auto-pause por bounce/complaint thresholds
--  • Audit log completo
--  • RLS + políticas para authenticated users
--  • 50+ índices optimizados para queries frecuentes
-- ============================================================================
