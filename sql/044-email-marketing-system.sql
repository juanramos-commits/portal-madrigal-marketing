-- ============================================================================
-- 044 - Email Marketing System (ventas_em_*)
-- Sistema completo de email marketing con IA, segmentación avanzada,
-- A/B testing, STO, analytics y sistema de bloques para templates.
-- ============================================================================


-- ─── 1. CORE: Contactos ─────────────────────────────────────────────────────
-- Enlaza con ventas_leads(id). Campos AI: engagement_score, lead_score,
-- best_send_hour, scored_at, preference_categories.

CREATE TABLE IF NOT EXISTS ventas_em_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES ventas_leads(id) ON DELETE SET NULL,
    email           VARCHAR NOT NULL,
    nombre          VARCHAR,
    empresa         VARCHAR,
    status          VARCHAR NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','unsubscribed','bounced','complained')),
    provider        VARCHAR DEFAULT 'other'
                        CHECK (provider IN ('gmail','outlook','yahoo','other')),

    -- AI / scoring
    engagement_score    INT DEFAULT 50 CHECK (engagement_score BETWEEN 0 AND 100),
    lead_score          INT DEFAULT 0  CHECK (lead_score BETWEEN 0 AND 100),
    best_send_hour      INT CHECK (best_send_hour BETWEEN 0 AND 23),
    scored_at           TIMESTAMPTZ,
    preference_categories TEXT[] DEFAULT '{}',

    -- Counters
    total_sent      INT DEFAULT 0,
    total_opened    INT DEFAULT 0,
    total_clicked   INT DEFAULT 0,

    -- Activity timestamps
    last_sent_at    TIMESTAMPTZ,
    last_opened_at  TIMESTAMPTZ,
    last_clicked_at TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 2. Segmentos ───────────────────────────────────────────────────────────
-- rules JSONB con operadores anidados AND/OR:
-- {"operator":"AND","conditions":[{"field":"status","op":"=","value":"active"},
--   {"operator":"OR","conditions":[...]}]}

CREATE TABLE IF NOT EXISTS ventas_em_segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    description     TEXT,
    rules           JSONB DEFAULT '{}',
    is_system       BOOLEAN DEFAULT false,
    contact_count   INT DEFAULT 0,
    last_evaluated_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 3. Templates ───────────────────────────────────────────────────────────
-- blocks: array JSONB de bloques reutilizables del catálogo ventas_em_template_blocks
-- ai_variants: variantes generadas por IA para A/B testing de contenido

CREATE TABLE IF NOT EXISTS ventas_em_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    subject         VARCHAR,
    html_body       TEXT,
    text_body       TEXT,
    blocks          JSONB DEFAULT '[]',
    ai_variants     JSONB DEFAULT '[]',
    category        VARCHAR,
    is_system       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 4. Campañas ────────────────────────────────────────────────────────────
-- A/B testing: subject_variants, winning_variant, ab_test_size, ab_test_duration

CREATE TABLE IF NOT EXISTS ventas_em_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    subject         VARCHAR,
    template_id     UUID REFERENCES ventas_em_templates(id) ON DELETE SET NULL,
    segment_id      UUID REFERENCES ventas_em_segments(id) ON DELETE SET NULL,
    status          VARCHAR NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','preparing','sending','paused','sent','cancelled')),

    -- A/B testing
    subject_variants    JSONB DEFAULT '[]',
    winning_variant     INT,
    ab_test_size        INT DEFAULT 10,
    ab_test_duration    INTERVAL DEFAULT '4 hours',

    -- Counters
    total_sent          INT DEFAULT 0,
    total_delivered     INT DEFAULT 0,
    total_opened        INT DEFAULT 0,
    total_clicked       INT DEFAULT 0,
    total_bounced       INT DEFAULT 0,
    total_complained    INT DEFAULT 0,
    total_unsubscribed  INT DEFAULT 0,
    total_converted     INT DEFAULT 0,

    -- Timestamps
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 5. Envíos individuales ─────────────────────────────────────────────────
-- STO: scheduled_for calculado por best_send_hour del contacto
-- variant_index: qué variante A/B se le envió

CREATE TABLE IF NOT EXISTS ventas_em_sends (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID REFERENCES ventas_em_campaigns(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES ventas_em_contacts(id) ON DELETE CASCADE,
    status          VARCHAR NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','sending','delivered','opened','clicked','bounced','complained','failed')),
    variant_index   INT DEFAULT 0,

    -- STO
    scheduled_for   TIMESTAMPTZ,

    -- Timestamps
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,

    -- Resend / error
    resend_message_id VARCHAR,
    error_message   TEXT,
    priority        INT DEFAULT 1,

    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 6. Clicks ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_clicks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_id         UUID REFERENCES ventas_em_sends(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    clicked_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 7. Automaciones ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_automations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    description     TEXT,
    trigger_type    VARCHAR,
    trigger_config  JSONB DEFAULT '{}',
    status          VARCHAR NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('active','paused','draft')),
    steps_count     INT DEFAULT 0,
    enrolled_count  INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 8. Pasos de automatización ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_automation_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id   UUID NOT NULL REFERENCES ventas_em_automations(id) ON DELETE CASCADE,
    step_order      INT NOT NULL,
    type            VARCHAR NOT NULL
                        CHECK (type IN ('send_email','wait','condition','update_contact','exit')),
    config          JSONB DEFAULT '{}',
    template_id     UUID REFERENCES ventas_em_templates(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 9. Enrollments de automatización ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_automation_enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id   UUID NOT NULL REFERENCES ventas_em_automations(id) ON DELETE CASCADE,
    contact_id      UUID NOT NULL REFERENCES ventas_em_contacts(id) ON DELETE CASCADE,
    current_step    INT DEFAULT 0,
    status          VARCHAR NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','exited','paused')),
    enrolled_at     TIMESTAMPTZ DEFAULT now(),
    last_step_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    UNIQUE (automation_id, contact_id)
);


-- ─── 10. Conversiones ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_conversions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID REFERENCES ventas_em_campaigns(id) ON DELETE SET NULL,
    automation_id   UUID REFERENCES ventas_em_automations(id) ON DELETE SET NULL,
    contact_id      UUID NOT NULL REFERENCES ventas_em_contacts(id) ON DELETE CASCADE,
    type            VARCHAR,
    value           DECIMAL(10,2) DEFAULT 0,
    attributed_at   TIMESTAMPTZ DEFAULT now()
);


-- ─── 11. Preferencias de contacto ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID NOT NULL REFERENCES ventas_em_contacts(id) ON DELETE CASCADE UNIQUE,
    categories      TEXT[] DEFAULT '{}',
    frequency       VARCHAR DEFAULT 'weekly'
                        CHECK (frequency IN ('daily','weekly','monthly','none')),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 12. Supresiones ────────────────────────────────────────────────────────
-- bounce_type diferencia hard vs soft para clasificación

CREATE TABLE IF NOT EXISTS ventas_em_suppressions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR NOT NULL,
    reason          VARCHAR NOT NULL
                        CHECK (reason IN ('bounce','complaint','unsubscribe','manual')),
    bounce_type     VARCHAR CHECK (bounce_type IN ('hard','soft')),
    source          VARCHAR,
    suppressed_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (email)
);


-- ─── 13. Log de reputación por proveedor ────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_reputation_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date            DATE NOT NULL,
    provider        VARCHAR NOT NULL,
    sent            INT DEFAULT 0,
    delivered       INT DEFAULT 0,
    bounced         INT DEFAULT 0,
    complained      INT DEFAULT 0,
    opened          INT DEFAULT 0,
    health_status   VARCHAR DEFAULT 'unknown',
    UNIQUE (date, provider)
);


-- ─── 14. Audit log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action          VARCHAR NOT NULL,
    entity_type     VARCHAR,
    entity_id       UUID,
    details         JSONB DEFAULT '{}',
    performed_by    UUID,
    performed_at    TIMESTAMPTZ DEFAULT now()
);


-- ─── 15. Settings (key-value) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_settings (
    key             VARCHAR PRIMARY KEY,
    value           TEXT,
    description     TEXT,
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 16. Warmup schedule ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_warmup_schedule (
    day             INT PRIMARY KEY,
    max_sends       INT NOT NULL,
    description     TEXT
);


-- ─── 17. Analytics diarios por campaña ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_analytics_daily (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date            DATE NOT NULL,
    campaign_id     UUID NOT NULL REFERENCES ventas_em_campaigns(id) ON DELETE CASCADE,
    sent            INT DEFAULT 0,
    delivered       INT DEFAULT 0,
    opened          INT DEFAULT 0,
    clicked         INT DEFAULT 0,
    bounced         INT DEFAULT 0,
    complained      INT DEFAULT 0,
    unsubscribed    INT DEFAULT 0,
    converted       INT DEFAULT 0,
    UNIQUE (campaign_id, date)
);


-- ─── 18. Heatmap de horas de apertura ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_open_hours (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID NOT NULL REFERENCES ventas_em_contacts(id) ON DELETE CASCADE,
    hour_utc        INT NOT NULL CHECK (hour_utc BETWEEN 0 AND 23),
    open_count      INT DEFAULT 1,
    UNIQUE (contact_id, hour_utc)
);


-- ─── 19. Catálogo de bloques para templates ─────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_template_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,
    type            VARCHAR NOT NULL
                        CHECK (type IN ('header','text','cta','image','divider','footer')),
    content         TEXT DEFAULT '',
    styles          JSONB DEFAULT '{}',
    category        VARCHAR,
    is_system       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── 20. Resultados A/B testing ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_em_ab_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES ventas_em_campaigns(id) ON DELETE CASCADE,
    variant_index   INT NOT NULL,
    subject         TEXT,
    sends           INT DEFAULT 0,
    opens           INT DEFAULT 0,
    clicks          INT DEFAULT 0,
    open_rate       DECIMAL(5,2) DEFAULT 0,
    click_rate      DECIMAL(5,2) DEFAULT 0,
    is_winner       BOOLEAN DEFAULT false,
    UNIQUE (campaign_id, variant_index)
);


-- ============================================================================
-- ÍNDICES
-- ============================================================================

-- Contacts
CREATE INDEX IF NOT EXISTS idx_em_contacts_lead_id
    ON ventas_em_contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_em_contacts_email
    ON ventas_em_contacts(email);
CREATE INDEX IF NOT EXISTS idx_em_contacts_status
    ON ventas_em_contacts(status);
CREATE INDEX IF NOT EXISTS idx_em_contacts_engagement_score
    ON ventas_em_contacts(engagement_score);

-- Sends
CREATE INDEX IF NOT EXISTS idx_em_sends_campaign_status
    ON ventas_em_sends(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_em_sends_contact_id
    ON ventas_em_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_em_sends_scheduled_for
    ON ventas_em_sends(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_em_sends_status
    ON ventas_em_sends(status)
    WHERE status = 'queued';

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_em_campaigns_status
    ON ventas_em_campaigns(status);

-- Analytics daily
CREATE INDEX IF NOT EXISTS idx_em_analytics_daily_campaign_date
    ON ventas_em_analytics_daily(campaign_id, date);

-- Clicks
CREATE INDEX IF NOT EXISTS idx_em_clicks_send_id
    ON ventas_em_clicks(send_id);

-- Audit log
CREATE INDEX IF NOT EXISTS idx_em_audit_log_entity
    ON ventas_em_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_em_audit_log_performed_at
    ON ventas_em_audit_log(performed_at);

-- Automation enrollments
CREATE INDEX IF NOT EXISTS idx_em_enrollments_automation_status
    ON ventas_em_automation_enrollments(automation_id, status);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- ─── Trigger 1: Sincronizar nuevo lead → contacto EM ────────────────────────
-- Cuando se crea un lead en ventas_leads, auto-crear el contacto de email marketing.

CREATE OR REPLACE FUNCTION trg_fn_em_sync_lead_to_contact()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo crear si el lead tiene email
    IF NEW.email IS NOT NULL AND NEW.email != '' THEN
        INSERT INTO ventas_em_contacts (lead_id, email, nombre, empresa)
        VALUES (NEW.id, NEW.email, NEW.nombre, NEW.nombre_negocio)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_em_sync_lead_to_contact ON ventas_leads;
CREATE TRIGGER trg_em_sync_lead_to_contact
    AFTER INSERT ON ventas_leads
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_em_sync_lead_to_contact();


-- ─── Trigger 2: Sincronizar update de lead → contacto EM ────────────────────
-- Cuando se actualiza nombre, email o nombre_negocio en ventas_leads,
-- propagar cambios al contacto EM vinculado.

CREATE OR REPLACE FUNCTION trg_fn_em_update_lead_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.email IS DISTINCT FROM NEW.email
       OR OLD.nombre IS DISTINCT FROM NEW.nombre
       OR OLD.nombre_negocio IS DISTINCT FROM NEW.nombre_negocio THEN

        UPDATE ventas_em_contacts
        SET email   = COALESCE(NEW.email, email),
            nombre  = COALESCE(NEW.nombre, nombre),
            empresa = COALESCE(NEW.nombre_negocio, empresa)
        WHERE lead_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_em_update_lead_sync ON ventas_leads;
CREATE TRIGGER trg_em_update_lead_sync
    AFTER UPDATE ON ventas_leads
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_em_update_lead_sync();


-- ─── Trigger 3: Registrar hora de apertura en heatmap ───────────────────────
-- Cuando un send se marca como opened por primera vez, registrar la hora UTC
-- en ventas_em_open_hours para alimentar el heatmap de STO.

CREATE OR REPLACE FUNCTION trg_fn_em_record_open_hour()
RETURNS TRIGGER AS $$
DECLARE
    v_hour INT;
BEGIN
    IF NEW.opened_at IS NOT NULL AND OLD.opened_at IS NULL THEN
        v_hour := EXTRACT(HOUR FROM NEW.opened_at AT TIME ZONE 'UTC');

        INSERT INTO ventas_em_open_hours (contact_id, hour_utc, open_count)
        VALUES (NEW.contact_id, v_hour, 1)
        ON CONFLICT (contact_id, hour_utc)
        DO UPDATE SET open_count = ventas_em_open_hours.open_count + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_em_record_open_hour ON ventas_em_sends;
CREATE TRIGGER trg_em_record_open_hour
    AFTER UPDATE ON ventas_em_sends
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_em_record_open_hour();


-- ─── Trigger 4: Auto updated_at en tablas principales ───────────────────────
-- Usa la función existente update_updated_at_column()

DROP TRIGGER IF EXISTS trg_em_contacts_updated_at ON ventas_em_contacts;
CREATE TRIGGER trg_em_contacts_updated_at
    BEFORE UPDATE ON ventas_em_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_em_segments_updated_at ON ventas_em_segments;
CREATE TRIGGER trg_em_segments_updated_at
    BEFORE UPDATE ON ventas_em_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_em_templates_updated_at ON ventas_em_templates;
CREATE TRIGGER trg_em_templates_updated_at
    BEFORE UPDATE ON ventas_em_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_em_campaigns_updated_at ON ventas_em_campaigns;
CREATE TRIGGER trg_em_campaigns_updated_at
    BEFORE UPDATE ON ventas_em_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_em_automations_updated_at ON ventas_em_automations;
CREATE TRIGGER trg_em_automations_updated_at
    BEFORE UPDATE ON ventas_em_automations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_em_preferences_updated_at ON ventas_em_preferences;
CREATE TRIGGER trg_em_preferences_updated_at
    BEFORE UPDATE ON ventas_em_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_em_settings_updated_at ON ventas_em_settings;
CREATE TRIGGER trg_em_settings_updated_at
    BEFORE UPDATE ON ventas_em_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Habilitar RLS en todas las tablas. Política permisiva para usuarios
-- autenticados — el control granular se hace a nivel de aplicación (tienePermiso).

ALTER TABLE ventas_em_contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_segments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_campaigns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_sends                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_clicks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_automations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_automation_steps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_conversions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_preferences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_suppressions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_reputation_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_warmup_schedule       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_analytics_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_open_hours            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_template_blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_em_ab_results            ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para authenticated
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'ventas_em_contacts',
        'ventas_em_segments',
        'ventas_em_templates',
        'ventas_em_campaigns',
        'ventas_em_sends',
        'ventas_em_clicks',
        'ventas_em_automations',
        'ventas_em_automation_steps',
        'ventas_em_automation_enrollments',
        'ventas_em_conversions',
        'ventas_em_preferences',
        'ventas_em_suppressions',
        'ventas_em_reputation_log',
        'ventas_em_audit_log',
        'ventas_em_settings',
        'ventas_em_warmup_schedule',
        'ventas_em_analytics_daily',
        'ventas_em_open_hours',
        'ventas_em_template_blocks',
        'ventas_em_ab_results'
    ] LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I',
            'pol_em_' || replace(t, 'ventas_em_', '') || '_auth',
            t
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            'pol_em_' || replace(t, 'ventas_em_', '') || '_auth',
            t
        );
    END LOOP;
END;
$$;


-- ============================================================================
-- DATOS INICIALES: Warmup schedule
-- ============================================================================

INSERT INTO ventas_em_warmup_schedule (day, max_sends, description) VALUES
    ( 1,   50,  'Día 1 — arranque conservador'),
    ( 2,  100,  'Día 2 — duplicar'),
    ( 3,  200,  'Día 3'),
    ( 4,  400,  'Día 4'),
    ( 5,  700,  'Día 5'),
    ( 6, 1000,  'Día 6'),
    ( 7, 1500,  'Día 7 — fin primera semana'),
    (14, 3000,  'Día 14 — fin segunda semana'),
    (21, 5000,  'Día 21 — fin tercera semana'),
    (30, 10000, 'Día 30 — capacidad plena')
ON CONFLICT (day) DO NOTHING;


-- ============================================================================
-- FIN 044
-- ============================================================================
