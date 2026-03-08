-- ============================================================================
-- Migration 044: Composite indexes for 13K+ leads scale
-- Run this BEFORE importing large lead batches
-- ============================================================================

-- Critical: composite index for kanban column queries
-- Query pattern: WHERE pipeline_id = ? AND etapa_id = ? ORDER BY fecha_entrada DESC LIMIT 20
CREATE INDEX IF NOT EXISTS idx_vlp_pipeline_etapa_fecha
  ON ventas_lead_pipeline (pipeline_id, etapa_id, fecha_entrada DESC);

-- Covers the lead_id lookup + pipeline filter (used by granular realtime updates)
CREATE INDEX IF NOT EXISTS idx_vlp_pipeline_lead
  ON ventas_lead_pipeline (pipeline_id, lead_id);

-- Leads table: fuente filter (used in CRM filters)
CREATE INDEX IF NOT EXISTS idx_vl_fuente
  ON ventas_leads (fuente) WHERE fuente IS NOT NULL;

-- Leads table: composite for role-based recent leads
CREATE INDEX IF NOT EXISTS idx_vl_setter_created
  ON ventas_leads (setter_asignado_id, created_at DESC) WHERE setter_asignado_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vl_closer_created
  ON ventas_leads (closer_asignado_id, created_at DESC) WHERE closer_asignado_id IS NOT NULL;

-- Lead etiquetas: composite for tag lookups per lead
CREATE INDEX IF NOT EXISTS idx_vle_lead_etiqueta
  ON ventas_lead_etiquetas (lead_id, etiqueta_id);

-- Actividad: lead timeline queries (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_va_lead_created
  ON ventas_actividad (lead_id, created_at DESC) WHERE lead_id IS NOT NULL;

-- RPC: efficient column counts in a single query (replaces 8 separate COUNT queries)
CREATE OR REPLACE FUNCTION ventas_contar_leads_por_etapa(p_pipeline_id UUID)
RETURNS TABLE(etapa_id UUID, lead_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT vlp.etapa_id, COUNT(*) AS lead_count
  FROM ventas_lead_pipeline vlp
  WHERE vlp.pipeline_id = p_pipeline_id
  GROUP BY vlp.etapa_id;
$$;
