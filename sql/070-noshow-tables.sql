-- ==========================================================================
-- Anti No-Show System: Tables
-- ==========================================================================

-- 1. Configuración de la secuencia (qué pasos, timing, templates)
CREATE TABLE IF NOT EXISTS ventas_noshow_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paso TEXT NOT NULL UNIQUE,
  orden INT NOT NULL,
  activo BOOLEAN DEFAULT true,
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'whatsapp_email', 'whatsapp_sms')),
  timing_tipo TEXT NOT NULL CHECK (timing_tipo IN ('offset_after', 'fixed_time_before', 'fixed_time_day_before', 'offset_after_noshow')),
  timing_valor INT NOT NULL, -- minutos para offset, o hora (HHMM) para fixed_time
  descripcion TEXT NOT NULL,
  template_whatsapp TEXT, -- nombre de la plantilla WA o texto libre
  template_email_asunto TEXT,
  template_email_cuerpo TEXT,
  requiere_respuesta BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Registro de cada paso enviado por cita
CREATE TABLE IF NOT EXISTS ventas_cita_confirmaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id UUID NOT NULL REFERENCES ventas_citas(id) ON DELETE CASCADE,
  paso TEXT NOT NULL REFERENCES ventas_noshow_config(paso) ON DELETE CASCADE,
  canal TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'enviado', 'entregado', 'respondido', 'confirmado', 'reagendado', 'cancelado', 'saltado')),
  programado_at TIMESTAMPTZ NOT NULL,
  enviado_at TIMESTAMPTZ,
  respondido_at TIMESTAMPTZ,
  respuesta TEXT,
  wa_message_id TEXT,
  email_resend_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cita_confirmaciones_cita ON ventas_cita_confirmaciones(cita_id);
CREATE INDEX IF NOT EXISTS idx_cita_confirmaciones_programado ON ventas_cita_confirmaciones(estado, programado_at) WHERE estado = 'programado';
CREATE UNIQUE INDEX IF NOT EXISTS idx_cita_confirmaciones_unique ON ventas_cita_confirmaciones(cita_id, paso);

-- 3. Recursos por categoría (casos de éxito, guías, vídeos closers)
CREATE TABLE IF NOT EXISTS ventas_noshow_recursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('caso_exito', 'recurso_valor', 'video_closer')),
  categoria TEXT, -- NULL = genérico, o: fotografo, wedding_planner, dj, finca, catering, otro
  closer_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, -- solo para video_closer
  titulo TEXT NOT NULL,
  contenido TEXT, -- texto descriptivo
  media_url TEXT, -- enlace a vídeo, PDF, imagen
  dato_concreto TEXT, -- "de 8 a 22 bodas/año", "facturó 40% más"
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Score de riesgo no-show por cita
ALTER TABLE ventas_citas
  ADD COLUMN IF NOT EXISTS noshow_risk_score INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS noshow_confirmado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS noshow_confirmado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS noshow_secuencia_activa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS noshow_token TEXT;

CREATE INDEX IF NOT EXISTS idx_citas_noshow_secuencia ON ventas_citas(noshow_secuencia_activa) WHERE noshow_secuencia_activa = true;

-- RLS
ALTER TABLE ventas_noshow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_cita_confirmaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_noshow_recursos ENABLE ROW LEVEL SECURITY;

-- Policies: super_admin full access
CREATE POLICY noshow_config_all ON ventas_noshow_config FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'super_admin'));

CREATE POLICY noshow_confirmaciones_all ON ventas_cita_confirmaciones FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'super_admin'));

CREATE POLICY noshow_recursos_all ON ventas_noshow_recursos FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'super_admin'));

-- Service role needs access too (for edge functions)
CREATE POLICY noshow_config_service ON ventas_noshow_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY noshow_confirmaciones_service ON ventas_cita_confirmaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY noshow_recursos_service ON ventas_noshow_recursos FOR ALL USING (true) WITH CHECK (true);

-- ==========================================================================
-- Seed: Configuración por defecto de la secuencia
-- ==========================================================================

INSERT INTO ventas_noshow_config (paso, orden, activo, canal, timing_tipo, timing_valor, descripcion, requiere_respuesta, template_whatsapp) VALUES
  ('confirmacion',     1, true, 'whatsapp_email', 'offset_after',          0,    'Confirmación inmediata al agendar', false, 'confirmacion_cita'),
  ('micro_compromiso', 2, true, 'whatsapp',       'offset_after',          60,   'Pregunta para generar compromiso (+1h)', false, NULL),
  ('prueba_social',    3, true, 'whatsapp',       'offset_after',          180,  'Caso de éxito por categoría (+3h)', false, 'prueba_social'),
  ('video_closer',     4, true, 'whatsapp',       'offset_after',          360,  'Vídeo del closer (+6h)', false, NULL),
  ('recurso_valor',    5, true, 'email',          'offset_after',          1440, 'Mini-guía por email (+24h, solo si cita a 2+ días)', false, NULL),
  ('d1_escasez',       6, true, 'whatsapp',       'fixed_time_day_before', 1800, 'Recordatorio D-1 con escasez (18:00)', true, 'recordatorio_d1'),
  ('d1_email',         7, true, 'email',          'fixed_time_day_before', 2100, 'Email D-1 si no respondió al WA (21:00)', false, NULL),
  ('d0_2h',            8, true, 'whatsapp',       'fixed_time_before',     120,  'Recordatorio 2h antes', false, 'recordatorio_d0'),
  ('d0_15m',           9, true, 'whatsapp_sms',   'fixed_time_before',     15,   'Recordatorio 15m antes + SMS fallback', false, 'recordatorio_15m'),
  ('noshow_5m',       10, true, 'whatsapp',       'offset_after_noshow',   5,    'No-show: "todo bien?" (+5m)', false, 'noshow_5m'),
  ('noshow_30m',      11, true, 'whatsapp',       'offset_after_noshow',   30,   'No-show: enlace reagendar (+30m)', false, 'noshow_reagendar'),
  ('noshow_24h',      12, true, 'whatsapp_email', 'offset_after_noshow',   1440, 'No-show recovery (+24h)', false, 'noshow_reagendar'),
  ('post_asistencia', 13, true, 'whatsapp',       'offset_after',          10,   'Post-reunión: "qué tal ha ido?" (+10m tras fin)', false, NULL)
ON CONFLICT (paso) DO NOTHING;

-- ==========================================================================
-- Trigger: updated_at automático
-- ==========================================================================

CREATE OR REPLACE FUNCTION trg_noshow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ventas_noshow_config_updated
  BEFORE UPDATE ON ventas_noshow_config
  FOR EACH ROW EXECUTE FUNCTION trg_noshow_updated_at();

CREATE TRIGGER trg_ventas_noshow_recursos_updated
  BEFORE UPDATE ON ventas_noshow_recursos
  FOR EACH ROW EXECUTE FUNCTION trg_noshow_updated_at();
