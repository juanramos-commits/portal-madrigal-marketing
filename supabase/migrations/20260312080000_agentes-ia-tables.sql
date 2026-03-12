-- =====================================================
-- Agentes IA — Tablas, índices, RLS, triggers, realtime
-- Totalmente idempotente (safe to re-run)
-- =====================================================

-- 1. ia_agentes
CREATE TABLE IF NOT EXISTS ia_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('setter', 'repescadora', 'outbound_frio')),
  activo boolean NOT NULL DEFAULT false,
  system_prompt text NOT NULL DEFAULT '',
  system_prompt_b text,
  ab_test_activo boolean NOT NULL DEFAULT false,
  ab_split int NOT NULL DEFAULT 50 CHECK (ab_split BETWEEN 0 AND 100),
  config jsonb NOT NULL DEFAULT '{
    "horario": {"inicio": "08:30", "fin": "21:00", "dias": [1,2,3,4,5]},
    "delays_repesca": [7200, 86400, 259200],
    "max_conversaciones": 100,
    "max_mensajes_dia": 500,
    "umbral_score_reunion": 60,
    "umbral_calidad_minima": 6
  }'::jsonb,
  whatsapp_phone_id text,
  wa_quality_rating text DEFAULT 'GREEN' CHECK (wa_quality_rating IN ('GREEN', 'YELLOW', 'RED')),
  rate_limit_msg_hora int NOT NULL DEFAULT 60,
  rate_limit_nuevos_dia int NOT NULL DEFAULT 50,
  modo_sandbox boolean NOT NULL DEFAULT true,
  sandbox_phones text[] DEFAULT '{}',
  usuario_id uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ia_leads
CREATE TABLE IF NOT EXISTS ia_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono text NOT NULL UNIQUE,
  nombre text,
  email text,
  servicio text,
  origen text DEFAULT 'formulario' CHECK (origen IN ('formulario', 'importado', 'manual', 'crm')),
  opted_out boolean NOT NULL DEFAULT false,
  lead_score int DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  score_detalles jsonb DEFAULT '{"interes": 0, "encaje": 0, "urgencia": 0, "capacidad_inversion": 0}'::jsonb,
  sentimiento_actual text DEFAULT 'neutro',
  horas_activas jsonb DEFAULT '[]'::jsonb,
  crm_lead_id uuid,
  consentimiento boolean NOT NULL DEFAULT false,
  consentimiento_at timestamptz,
  opted_out_at timestamptz,
  datos_borrados boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. ia_conversaciones
CREATE TABLE IF NOT EXISTS ia_conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES ia_agentes(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES ia_leads(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'needs_reply' CHECK (estado IN (
    'needs_reply', 'waiting_reply', 'agendado', 'descartado',
    'scheduled_followup', 'no_response', 'handoff_humano'
  )),
  step text NOT NULL DEFAULT 'first_message' CHECK (step IN (
    'first_message', 'qualify', 'meeting_pref', 'followup'
  )),
  chatbot_activo boolean NOT NULL DEFAULT true,
  handoff_humano boolean NOT NULL DEFAULT false,
  handoff_usuario_id uuid REFERENCES usuarios(id),
  followup_count int NOT NULL DEFAULT 0,
  followup_at timestamptz,
  first_message_sent_at timestamptz,
  last_bot_message_at timestamptz,
  last_lead_message_at timestamptz,
  leida boolean NOT NULL DEFAULT false,
  favorita boolean NOT NULL DEFAULT false,
  asignado_a uuid REFERENCES usuarios(id),
  resumen text,
  ab_version text DEFAULT 'A' CHECK (ab_version IN ('A', 'B')),
  secuencia_outbound_step int DEFAULT 0,
  secuencia_outbound_next_at timestamptz,
  wa_window_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. ia_mensajes
CREATE TABLE IF NOT EXISTS ia_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES ia_conversaciones(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender text NOT NULL CHECK (sender IN ('lead', 'bot', 'humano')),
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text', 'audio', 'image', 'video', 'sticker', 'document', 'nota_interna'
  )),
  media_url text,
  transcription text,
  wa_message_id text,
  wa_status text DEFAULT 'sent' CHECK (wa_status IN ('sent', 'delivered', 'read')),
  template_name text,
  sentimiento text,
  is_repesca boolean NOT NULL DEFAULT false,
  calidad_score int CHECK (calidad_score BETWEEN 1 AND 10),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. ia_notas
CREATE TABLE IF NOT EXISTS ia_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES ia_conversaciones(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. ia_respuestas_rapidas
CREATE TABLE IF NOT EXISTS ia_respuestas_rapidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES ia_agentes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  contenido text NOT NULL,
  orden int NOT NULL DEFAULT 0
);

-- 7. ia_objeciones
CREATE TABLE IF NOT EXISTS ia_objeciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES ia_conversaciones(id) ON DELETE CASCADE,
  mensaje_id uuid NOT NULL REFERENCES ia_mensajes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('precio', 'tiempo', 'confianza', 'competencia', 'pensar', 'otro')),
  descripcion text,
  estrategia_usada text,
  resuelta boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. ia_metricas_diarias
CREATE TABLE IF NOT EXISTS ia_metricas_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES ia_agentes(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  ab_version text DEFAULT 'A',
  leads_contactados int NOT NULL DEFAULT 0,
  respuestas_recibidas int NOT NULL DEFAULT 0,
  reuniones_agendadas int NOT NULL DEFAULT 0,
  leads_descartados int NOT NULL DEFAULT 0,
  mensajes_enviados int NOT NULL DEFAULT 0,
  mensajes_recibidos int NOT NULL DEFAULT 0,
  sentimiento_promedio float,
  score_calidad_promedio float,
  objeciones_detectadas int NOT NULL DEFAULT 0,
  objeciones_resueltas int NOT NULL DEFAULT 0,
  UNIQUE (agente_id, fecha, ab_version)
);

-- 9. ia_estilos_equipo
CREATE TABLE IF NOT EXISTS ia_estilos_equipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES ia_agentes(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  estilo jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensajes_analizados int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agente_id, usuario_id)
);

-- 10. ia_alertas_supervisor
CREATE TABLE IF NOT EXISTS ia_alertas_supervisor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES ia_agentes(id) ON DELETE CASCADE,
  conversacion_id uuid REFERENCES ia_conversaciones(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'lead_caliente_sin_respuesta', 'sentimiento_negativo', 'bot_bloqueado',
    'calidad_baja', 'error', 'quality_rating_warning', 'fallback_activado'
  )),
  mensaje text NOT NULL,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. ia_blacklist
CREATE TABLE IF NOT EXISTS ia_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono text NOT NULL UNIQUE,
  motivo text NOT NULL DEFAULT 'manual' CHECK (motivo IN ('competidor', 'spam', 'reportado', 'manual')),
  añadido_por uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. ia_costes
CREATE TABLE IF NOT EXISTS ia_costes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES ia_agentes(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  claude_calls int NOT NULL DEFAULT 0,
  claude_tokens_in int NOT NULL DEFAULT 0,
  claude_tokens_out int NOT NULL DEFAULT 0,
  claude_coste numeric(10,4) NOT NULL DEFAULT 0,
  haiku_calls int NOT NULL DEFAULT 0,
  haiku_coste numeric(10,4) NOT NULL DEFAULT 0,
  whisper_calls int NOT NULL DEFAULT 0,
  whisper_coste numeric(10,4) NOT NULL DEFAULT 0,
  gpt4o_calls int NOT NULL DEFAULT 0,
  gpt4o_coste numeric(10,4) NOT NULL DEFAULT 0,
  whatsapp_mensajes int NOT NULL DEFAULT 0,
  whatsapp_coste numeric(10,4) NOT NULL DEFAULT 0,
  coste_total numeric(10,4) GENERATED ALWAYS AS (
    claude_coste + haiku_coste + whisper_coste + gpt4o_coste + whatsapp_coste
  ) STORED,
  UNIQUE (agente_id, fecha)
);

-- 13. ia_logs (agente_id nullable for system-level logs)
CREATE TABLE IF NOT EXISTS ia_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid REFERENCES ia_agentes(id) ON DELETE CASCADE,
  conversacion_id uuid REFERENCES ia_conversaciones(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN (
    'info', 'error', 'warning', 'ai_call', 'whatsapp',
    'quality_check', 'sentiment', 'crm_sync', 'fallback'
  )),
  mensaje text NOT NULL,
  detalles jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fix: make ia_logs.agente_id nullable if it was created as NOT NULL
ALTER TABLE ia_logs ALTER COLUMN agente_id DROP NOT NULL;

-- =====================================================
-- Índices
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ia_leads_telefono ON ia_leads(telefono);
CREATE INDEX IF NOT EXISTS idx_ia_leads_crm_lead_id ON ia_leads(crm_lead_id) WHERE crm_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ia_leads_opted_out ON ia_leads(opted_out) WHERE opted_out = false;

CREATE INDEX IF NOT EXISTS idx_ia_conv_agente ON ia_conversaciones(agente_id);
CREATE INDEX IF NOT EXISTS idx_ia_conv_lead ON ia_conversaciones(lead_id);
CREATE INDEX IF NOT EXISTS idx_ia_conv_estado ON ia_conversaciones(agente_id, estado);
CREATE INDEX IF NOT EXISTS idx_ia_conv_followup ON ia_conversaciones(estado, followup_at)
  WHERE estado = 'scheduled_followup' AND followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ia_conv_repesca ON ia_conversaciones(agente_id, estado, chatbot_activo, followup_count)
  WHERE estado = 'waiting_reply' AND chatbot_activo = true;
CREATE INDEX IF NOT EXISTS idx_ia_conv_secuencia ON ia_conversaciones(agente_id, secuencia_outbound_next_at)
  WHERE secuencia_outbound_next_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ia_conv_no_leida ON ia_conversaciones(agente_id, leida)
  WHERE leida = false;

CREATE INDEX IF NOT EXISTS idx_ia_msg_conv ON ia_mensajes(conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ia_msg_wa_id ON ia_mensajes(wa_message_id) WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ia_alertas_no_leidas ON ia_alertas_supervisor(leida, created_at)
  WHERE leida = false;

CREATE INDEX IF NOT EXISTS idx_ia_logs_agente ON ia_logs(agente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_logs_tipo ON ia_logs(tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ia_metricas_agente_fecha ON ia_metricas_diarias(agente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ia_costes_agente_fecha ON ia_costes(agente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ia_blacklist_telefono ON ia_blacklist(telefono);

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE ia_agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_respuestas_rapidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_objeciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_metricas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_estilos_equipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_alertas_supervisor ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_costes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_logs ENABLE ROW LEVEL SECURITY;

-- Drop + create policies to be idempotent
DO $$ BEGIN
  -- ia_agentes
  DROP POLICY IF EXISTS ia_agentes_select ON ia_agentes;
  DROP POLICY IF EXISTS ia_agentes_insert ON ia_agentes;
  DROP POLICY IF EXISTS ia_agentes_update ON ia_agentes;
  DROP POLICY IF EXISTS ia_agentes_delete ON ia_agentes;

  -- ia_leads
  DROP POLICY IF EXISTS ia_leads_select ON ia_leads;
  DROP POLICY IF EXISTS ia_leads_all ON ia_leads;

  -- ia_conversaciones
  DROP POLICY IF EXISTS ia_conversaciones_select ON ia_conversaciones;
  DROP POLICY IF EXISTS ia_conversaciones_all ON ia_conversaciones;

  -- ia_mensajes
  DROP POLICY IF EXISTS ia_mensajes_select ON ia_mensajes;
  DROP POLICY IF EXISTS ia_mensajes_insert ON ia_mensajes;

  -- ia_notas
  DROP POLICY IF EXISTS ia_notas_select ON ia_notas;
  DROP POLICY IF EXISTS ia_notas_insert ON ia_notas;

  -- ia_respuestas_rapidas
  DROP POLICY IF EXISTS ia_respuestas_rapidas_select ON ia_respuestas_rapidas;
  DROP POLICY IF EXISTS ia_respuestas_rapidas_all ON ia_respuestas_rapidas;

  -- ia_objeciones
  DROP POLICY IF EXISTS ia_objeciones_select ON ia_objeciones;
  DROP POLICY IF EXISTS ia_objeciones_insert ON ia_objeciones;

  -- ia_metricas_diarias
  DROP POLICY IF EXISTS ia_metricas_select ON ia_metricas_diarias;
  DROP POLICY IF EXISTS ia_metricas_all ON ia_metricas_diarias;

  -- ia_estilos_equipo
  DROP POLICY IF EXISTS ia_estilos_select ON ia_estilos_equipo;
  DROP POLICY IF EXISTS ia_estilos_all ON ia_estilos_equipo;

  -- ia_alertas_supervisor
  DROP POLICY IF EXISTS ia_alertas_select ON ia_alertas_supervisor;
  DROP POLICY IF EXISTS ia_alertas_all ON ia_alertas_supervisor;

  -- ia_blacklist
  DROP POLICY IF EXISTS ia_blacklist_select ON ia_blacklist;
  DROP POLICY IF EXISTS ia_blacklist_all ON ia_blacklist;

  -- ia_costes
  DROP POLICY IF EXISTS ia_costes_select ON ia_costes;
  DROP POLICY IF EXISTS ia_costes_all ON ia_costes;

  -- ia_logs
  DROP POLICY IF EXISTS ia_logs_select ON ia_logs;
  DROP POLICY IF EXISTS ia_logs_insert ON ia_logs;
END $$;

CREATE POLICY ia_agentes_select ON ia_agentes FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_agentes_insert ON ia_agentes FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.crear'));
CREATE POLICY ia_agentes_update ON ia_agentes FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.editar'));
CREATE POLICY ia_agentes_delete ON ia_agentes FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.eliminar'));

CREATE POLICY ia_leads_select ON ia_leads FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_leads_all ON ia_leads FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.editar'));

CREATE POLICY ia_conversaciones_select ON ia_conversaciones FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_conversaciones_all ON ia_conversaciones FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.editar'));

CREATE POLICY ia_mensajes_select ON ia_mensajes FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_mensajes_insert ON ia_mensajes FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));

CREATE POLICY ia_notas_select ON ia_notas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_notas_insert ON ia_notas FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));

CREATE POLICY ia_respuestas_rapidas_select ON ia_respuestas_rapidas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_respuestas_rapidas_all ON ia_respuestas_rapidas FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.editar'));

CREATE POLICY ia_objeciones_select ON ia_objeciones FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_objeciones_insert ON ia_objeciones FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));

CREATE POLICY ia_metricas_select ON ia_metricas_diarias FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_metricas_all ON ia_metricas_diarias FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));

CREATE POLICY ia_estilos_select ON ia_estilos_equipo FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_estilos_all ON ia_estilos_equipo FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.editar'));

CREATE POLICY ia_alertas_select ON ia_alertas_supervisor FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_alertas_all ON ia_alertas_supervisor FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));

CREATE POLICY ia_blacklist_select ON ia_blacklist FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_blacklist_all ON ia_blacklist FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.editar'));

CREATE POLICY ia_costes_select ON ia_costes FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_costes_all ON ia_costes FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));

CREATE POLICY ia_logs_select ON ia_logs FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'ventas.agentes_ia.ver'));
CREATE POLICY ia_logs_insert ON ia_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- Triggers (idempotent with OR REPLACE + DROP IF EXISTS)
-- =====================================================

CREATE OR REPLACE FUNCTION ia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ia_agentes_updated_at ON ia_agentes;
CREATE TRIGGER ia_agentes_updated_at BEFORE UPDATE ON ia_agentes
  FOR EACH ROW EXECUTE FUNCTION ia_updated_at();

DROP TRIGGER IF EXISTS ia_leads_updated_at ON ia_leads;
CREATE TRIGGER ia_leads_updated_at BEFORE UPDATE ON ia_leads
  FOR EACH ROW EXECUTE FUNCTION ia_updated_at();

DROP TRIGGER IF EXISTS ia_conversaciones_updated_at ON ia_conversaciones;
CREATE TRIGGER ia_conversaciones_updated_at BEFORE UPDATE ON ia_conversaciones
  FOR EACH ROW EXECUTE FUNCTION ia_updated_at();

-- =====================================================
-- Realtime (idempotent — ignores if already added)
-- =====================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ia_mensajes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ia_alertas_supervisor;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ia_conversaciones;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ia_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
