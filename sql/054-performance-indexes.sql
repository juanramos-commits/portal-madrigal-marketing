-- ============================================================
-- 054: Performance indexes for slow queries
-- ============================================================

-- Composite index for ventas_etapas: used in pipeline stage lookups
CREATE INDEX IF NOT EXISTS idx_ve_pipeline_tipo_activo
  ON ventas_etapas (pipeline_id, tipo) WHERE activo = true;

-- Composite index for ventas_citas: calendar range queries
CREATE INDEX IF NOT EXISTS idx_vc_fecha_hora_closer
  ON ventas_citas (fecha_hora, closer_id) WHERE estado != 'cancelada';

-- Composite index for ventas_citas: lead-based lookups in RLS
CREATE INDEX IF NOT EXISTS idx_vc_lead_id
  ON ventas_citas (lead_id);

-- Trigram index for lead text search (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_vl_nombre_trgm
  ON ventas_leads USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vl_email_trgm
  ON ventas_leads USING gin (email gin_trgm_ops);

-- Email marketing: contacts search
CREATE INDEX IF NOT EXISTS idx_em_contacts_nombre_trgm
  ON ventas_em_contacts USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_em_contacts_email_trgm
  ON ventas_em_contacts USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_em_contacts_status
  ON ventas_em_contacts (status);

-- Email marketing: sends by campaign + status (used in send worker)
CREATE INDEX IF NOT EXISTS idx_em_sends_campaign_status
  ON ventas_em_sends (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_em_sends_scheduled
  ON ventas_em_sends (scheduled_for) WHERE status = 'queued';

-- Cold outreach: contacts search
CREATE INDEX IF NOT EXISTS idx_co_contacts_email_trgm
  ON ventas_co_contacts USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_co_contacts_list_status
  ON ventas_co_contacts (list_id, status);

-- Cold outreach: sends by campaign + status
CREATE INDEX IF NOT EXISTS idx_co_sends_campaign_status
  ON ventas_co_sends (campaign_id, status);

-- Cold outreach: replies by campaign
CREATE INDEX IF NOT EXISTS idx_co_replies_campaign
  ON ventas_co_replies (campaign_id);

CREATE INDEX IF NOT EXISTS idx_co_replies_classification
  ON ventas_co_replies (classification) WHERE classification IS NULL;

-- Analytics daily: lookup by campaign + date
CREATE INDEX IF NOT EXISTS idx_em_analytics_campaign_date
  ON ventas_em_analytics_daily (campaign_id, date DESC);

-- Reputation log: lookup by date
CREATE INDEX IF NOT EXISTS idx_em_reputation_date
  ON ventas_em_reputation_log (date DESC);
