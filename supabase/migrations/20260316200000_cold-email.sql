-- ============================================================================
-- Cold Email Module (ce_*)
-- Sistema completo de cold email con warm-up, secuencias, event sourcing,
-- threading, IA clasificacion, A/B testing y auto-pausa por salud.
-- ============================================================================

-- Drop existing objects to recreate cleanly
DO $$ BEGIN
  -- Drop triggers
  DROP TRIGGER IF EXISTS trg_ce_eventos_procesar ON ce_eventos;
  DROP TRIGGER IF EXISTS trg_ce_cuentas_updated ON ce_cuentas;
  DROP TRIGGER IF EXISTS trg_ce_contactos_updated ON ce_contactos;
  DROP TRIGGER IF EXISTS trg_ce_plantillas_updated ON ce_plantillas;
  DROP TRIGGER IF EXISTS trg_ce_secuencias_updated ON ce_secuencias;
  DROP TRIGGER IF EXISTS trg_ce_enrollments_updated ON ce_enrollments;
  DROP TRIGGER IF EXISTS trg_ce_config_updated ON ce_config;
  DROP TRIGGER IF EXISTS trg_ce_pasos_updated ON ce_pasos;
  DROP TRIGGER IF EXISTS trg_ce_envios_updated ON ce_envios;
  DROP TRIGGER IF EXISTS trg_ce_respuestas_updated ON ce_respuestas;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop functions
DROP FUNCTION IF EXISTS ce_procesar_evento() CASCADE;
DROP FUNCTION IF EXISTS ce_check_auto_pausa() CASCADE;
DROP FUNCTION IF EXISTS ce_avanzar_warmup() CASCADE;
DROP FUNCTION IF EXISTS ce_secuencia_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS ce_health_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS ce_enviados_hoy_dominio(TEXT) CASCADE;
DROP FUNCTION IF EXISTS ce_enviados_hoy(UUID) CASCADE;
DROP FUNCTION IF EXISTS ce_limite_efectivo(UUID) CASCADE;
DROP FUNCTION IF EXISTS ce_set_updated_at() CASCADE;

-- Drop tables in dependency order
DROP TABLE IF EXISTS ce_respuestas CASCADE;
DROP TABLE IF EXISTS ce_eventos CASCADE;
DROP TABLE IF EXISTS ce_envios CASCADE;
DROP TABLE IF EXISTS ce_enrollments CASCADE;
DROP TABLE IF EXISTS ce_pasos CASCADE;
DROP TABLE IF EXISTS ce_secuencias_cuentas CASCADE;
DROP TABLE IF EXISTS ce_secuencias CASCADE;
DROP TABLE IF EXISTS ce_plantillas CASCADE;
DROP TABLE IF EXISTS ce_contactos_listas CASCADE;
DROP TABLE IF EXISTS ce_listas CASCADE;
DROP TABLE IF EXISTS ce_contactos CASCADE;
DROP TABLE IF EXISTS ce_cuentas CASCADE;
DROP TABLE IF EXISTS ce_blacklist CASCADE;
DROP TABLE IF EXISTS ce_config CASCADE;


-- 0. TRIGGER FUNCTION: updated_at
CREATE OR REPLACE FUNCTION ce_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 1. ce_cuentas
CREATE TABLE ce_cuentas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  dominio             TEXT GENERATED ALWAYS AS (split_part(email, '@', 2)) STORED,
  resend_api_key      TEXT NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'primed'
                        CHECK (estado IN ('primed','ramping','resting','paused')),
  warmup_dia_actual   INTEGER NOT NULL DEFAULT 0,
  warmup_inicio       INTEGER NOT NULL DEFAULT 5,
  warmup_incremento   INTEGER NOT NULL DEFAULT 3,
  warmup_max          INTEGER NOT NULL DEFAULT 50,
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ce_cuentas_updated
  BEFORE UPDATE ON ce_cuentas
  FOR EACH ROW EXECUTE FUNCTION ce_set_updated_at();


-- 2. ce_contactos
CREATE TABLE ce_contactos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  nombre            TEXT,
  empresa           TEXT,
  cargo             TEXT,
  telefono          TEXT,
  etiquetas         TEXT[] DEFAULT '{}',
  campos_custom     JSONB DEFAULT '{}',
  estado            TEXT NOT NULL DEFAULT 'activo'
                      CHECK (estado IN ('activo','baja','rebotado','queja')),
  mx_valido         BOOLEAN,
  mx_verificado_at  TIMESTAMPTZ,
  crm_lead_id       UUID REFERENCES ventas_leads(id),
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_ce_contactos_email_lower ON ce_contactos (lower(email));
CREATE INDEX idx_ce_contactos_estado ON ce_contactos (estado);
CREATE INDEX idx_ce_contactos_etiquetas ON ce_contactos USING gin (etiquetas);

CREATE TRIGGER trg_ce_contactos_updated
  BEFORE UPDATE ON ce_contactos
  FOR EACH ROW EXECUTE FUNCTION ce_set_updated_at();


-- 3. ce_listas
CREATE TABLE ce_listas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- 4. ce_contactos_listas
CREATE TABLE ce_contactos_listas (
  contacto_id UUID REFERENCES ce_contactos(id) ON DELETE CASCADE,
  lista_id    UUID REFERENCES ce_listas(id) ON DELETE CASCADE,
  PRIMARY KEY (contacto_id, lista_id)
);


-- 5. ce_plantillas
CREATE TABLE ce_plantillas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  asunto      TEXT NOT NULL,
  cuerpo      TEXT NOT NULL,
  variables   TEXT[] DEFAULT '{}',
  categoria   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ce_plantillas_updated
  BEFORE UPDATE ON ce_plantillas
  FOR EACH ROW EXECUTE FUNCTION ce_set_updated_at();


-- 6. ce_secuencias
CREATE TABLE ce_secuencias (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  TEXT NOT NULL,
  descripcion             TEXT,
  estado                  TEXT NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador','activa','pausada','archivada')),
  timezone                TEXT NOT NULL DEFAULT 'Europe/Madrid',
  dias_envio              INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  hora_inicio             TIME NOT NULL DEFAULT '09:00',
  hora_fin                TIME NOT NULL DEFAULT '18:00',
  ab_testing              BOOLEAN NOT NULL DEFAULT false,
  ia_personalizar_primero BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ce_secuencias_updated
  BEFORE UPDATE ON ce_secuencias
  FOR EACH ROW EXECUTE FUNCTION ce_set_updated_at();


-- 7. ce_secuencias_cuentas
CREATE TABLE ce_secuencias_cuentas (
  secuencia_id UUID REFERENCES ce_secuencias(id) ON DELETE CASCADE,
  cuenta_id    UUID REFERENCES ce_cuentas(id) ON DELETE CASCADE,
  PRIMARY KEY (secuencia_id, cuenta_id)
);


-- 8. ce_pasos
CREATE TABLE ce_pasos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secuencia_id  UUID NOT NULL REFERENCES ce_secuencias(id) ON DELETE CASCADE,
  orden         INTEGER NOT NULL,
  delay_dias    INTEGER NOT NULL DEFAULT 1,
  asunto_a      TEXT NOT NULL,
  cuerpo_a      TEXT NOT NULL,
  asunto_b      TEXT,
  cuerpo_b      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (secuencia_id, orden)
);


-- 9. ce_enrollments
CREATE TABLE ce_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id     UUID NOT NULL REFERENCES ce_contactos(id) ON DELETE CASCADE,
  secuencia_id    UUID NOT NULL REFERENCES ce_secuencias(id) ON DELETE CASCADE,
  paso_actual     INTEGER NOT NULL DEFAULT 1,
  estado          TEXT NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo','pausado','completado','respondido',
                                      'interesado','no_ahora','baja','negativo','rebotado')),
  proximo_envio_at TIMESTAMPTZ,
  followup_at      TIMESTAMPTZ,
  cuenta_id        UUID REFERENCES ce_cuentas(id),
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contacto_id, secuencia_id)
);

CREATE INDEX idx_ce_enrollments_secuencia_estado ON ce_enrollments (secuencia_id, estado);
CREATE INDEX idx_ce_enrollments_contacto ON ce_enrollments (contacto_id);
CREATE INDEX idx_ce_enrollments_proximo_envio ON ce_enrollments (proximo_envio_at)
  WHERE estado = 'activo';

CREATE TRIGGER trg_ce_enrollments_updated
  BEFORE UPDATE ON ce_enrollments
  FOR EACH ROW EXECUTE FUNCTION ce_set_updated_at();


-- 10. ce_envios
CREATE TABLE ce_envios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES ce_enrollments(id) ON DELETE CASCADE,
  paso_id         UUID NOT NULL REFERENCES ce_pasos(id) ON DELETE CASCADE,
  cuenta_id       UUID NOT NULL REFERENCES ce_cuentas(id),
  contacto_id     UUID NOT NULL REFERENCES ce_contactos(id),
  variante        CHAR(1) DEFAULT 'a' CHECK (variante IN ('a','b')),
  message_id      TEXT,
  thread_key      TEXT,
  in_reply_to     TEXT,
  resend_id       TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','enviado','entregado','abierto',
                                      'respondido','rebotado','queja','error')),
  error_detalle   TEXT,
  enviado_at      TIMESTAMPTZ,
  entregado_at    TIMESTAMPTZ,
  abierto_at      TIMESTAMPTZ,
  respondido_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ce_envios_enrollment ON ce_envios (enrollment_id);
CREATE INDEX idx_ce_envios_cuenta_enviado ON ce_envios (cuenta_id, enviado_at);
CREATE INDEX idx_ce_envios_message_id ON ce_envios (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_ce_envios_thread_key ON ce_envios (thread_key) WHERE thread_key IS NOT NULL;


-- 11. ce_eventos
CREATE TABLE ce_eventos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL,
  envio_id        UUID REFERENCES ce_envios(id) ON DELETE SET NULL,
  cuenta_id       UUID REFERENCES ce_cuentas(id),
  contacto_id     UUID REFERENCES ce_contactos(id),
  payload         JSONB DEFAULT '{}',
  resend_event_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ce_eventos_envio ON ce_eventos (envio_id);
CREATE INDEX idx_ce_eventos_created ON ce_eventos (created_at);


-- 12. ce_respuestas
CREATE TABLE ce_respuestas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id            UUID REFERENCES ce_envios(id),
  contacto_id         UUID NOT NULL REFERENCES ce_contactos(id),
  enrollment_id       UUID REFERENCES ce_enrollments(id),
  thread_key          TEXT,
  de                  TEXT NOT NULL,
  para                TEXT NOT NULL,
  asunto              TEXT,
  cuerpo              TEXT NOT NULL,
  clasificacion       TEXT DEFAULT 'pendiente'
                        CHECK (clasificacion IN ('pendiente','interesado','no_ahora',
                                                  'baja','negativo','irrelevante')),
  clasificacion_ia_raw JSONB,
  crm_lead_id         UUID REFERENCES ventas_leads(id),
  leida               BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ce_respuestas_thread ON ce_respuestas (thread_key) WHERE thread_key IS NOT NULL;
CREATE INDEX idx_ce_respuestas_clasificacion_no_leida ON ce_respuestas (clasificacion)
  WHERE NOT leida;


-- 13. ce_blacklist
CREATE TABLE ce_blacklist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL CHECK (tipo IN ('dominio','email')),
  valor       TEXT NOT NULL,
  motivo      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_ce_blacklist_tipo_valor ON ce_blacklist (tipo, lower(valor));


-- 14. ce_config
CREATE TABLE ce_config (
  clave       TEXT PRIMARY KEY,
  valor       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ce_config_updated
  BEFORE UPDATE ON ce_config
  FOR EACH ROW EXECUTE FUNCTION ce_set_updated_at();

-- Default config
INSERT INTO ce_config (clave, valor) VALUES
  ('pausa_global', 'false'::jsonb),
  ('bounce_threshold', '3'::jsonb),
  ('complaint_threshold', '0.3'::jsonb),
  ('delay_min_segundos', '60'::jsonb),
  ('delay_max_segundos', '180'::jsonb),
  ('max_diario_por_dominio', '200'::jsonb)
ON CONFLICT (clave) DO NOTHING;


-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- F1. ce_limite_efectivo
CREATE OR REPLACE FUNCTION ce_limite_efectivo(p_cuenta_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_cuenta ce_cuentas%ROWTYPE;
BEGIN
  SELECT * INTO v_cuenta FROM ce_cuentas WHERE id = p_cuenta_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  CASE v_cuenta.estado
    WHEN 'paused' THEN RETURN 0;
    WHEN 'primed' THEN RETURN v_cuenta.warmup_inicio;
    WHEN 'ramping' THEN
      RETURN LEAST(
        v_cuenta.warmup_inicio + (v_cuenta.warmup_dia_actual * v_cuenta.warmup_incremento),
        v_cuenta.warmup_max
      );
    WHEN 'resting' THEN RETURN v_cuenta.warmup_max;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;


-- F2. ce_enviados_hoy
CREATE OR REPLACE FUNCTION ce_enviados_hoy(p_cuenta_id UUID)
RETURNS INTEGER AS $$
  SELECT count(*)::integer
  FROM ce_envios
  WHERE cuenta_id = p_cuenta_id
    AND enviado_at >= (now() AT TIME ZONE 'Europe/Madrid')::date::timestamptz;
$$ LANGUAGE sql STABLE;


-- F3. ce_enviados_hoy_dominio
CREATE OR REPLACE FUNCTION ce_enviados_hoy_dominio(p_dominio TEXT)
RETURNS INTEGER AS $$
  SELECT count(*)::integer
  FROM ce_envios e
  JOIN ce_cuentas c ON c.id = e.cuenta_id
  WHERE c.dominio = p_dominio
    AND e.enviado_at >= (now() AT TIME ZONE 'Europe/Madrid')::date::timestamptz;
$$ LANGUAGE sql STABLE;


-- F4. ce_health_score
CREATE OR REPLACE FUNCTION ce_health_score(p_cuenta_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total INTEGER;
  v_delivered INTEGER;
  v_opened INTEGER;
  v_bounced INTEGER;
  v_complained INTEGER;
  v_since TIMESTAMPTZ := now() - interval '7 days';
BEGIN
  SELECT count(*) INTO v_total
  FROM ce_envios WHERE cuenta_id = p_cuenta_id AND enviado_at >= v_since;

  SELECT count(*) INTO v_delivered
  FROM ce_envios WHERE cuenta_id = p_cuenta_id AND enviado_at >= v_since AND estado = 'entregado';

  SELECT count(*) INTO v_opened
  FROM ce_envios WHERE cuenta_id = p_cuenta_id AND enviado_at >= v_since AND abierto_at IS NOT NULL;

  SELECT count(*) INTO v_bounced
  FROM ce_envios WHERE cuenta_id = p_cuenta_id AND enviado_at >= v_since AND estado = 'rebotado';

  SELECT count(*) INTO v_complained
  FROM ce_envios WHERE cuenta_id = p_cuenta_id AND enviado_at >= v_since AND estado = 'queja';

  RETURN jsonb_build_object(
    'total', v_total,
    'delivered', v_delivered,
    'opened', v_opened,
    'bounced', v_bounced,
    'complained', v_complained,
    'bounce_rate', CASE WHEN v_total > 0 THEN round((v_bounced::numeric / v_total) * 100, 2) ELSE 0 END,
    'complaint_rate', CASE WHEN v_total > 0 THEN round((v_complained::numeric / v_total) * 100, 2) ELSE 0 END,
    'open_rate', CASE WHEN v_total > 0 THEN round((v_opened::numeric / v_total) * 100, 2) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- F5. ce_secuencia_stats
CREATE OR REPLACE FUNCTION ce_secuencia_stats(p_secuencia_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total INTEGER;
  v_activos INTEGER;
  v_completados INTEGER;
  v_respondidos INTEGER;
  v_interesados INTEGER;
  v_enviados INTEGER;
  v_abiertos INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM ce_enrollments WHERE secuencia_id = p_secuencia_id;
  SELECT count(*) INTO v_activos FROM ce_enrollments WHERE secuencia_id = p_secuencia_id AND estado = 'activo';
  SELECT count(*) INTO v_completados FROM ce_enrollments WHERE secuencia_id = p_secuencia_id AND estado = 'completado';
  SELECT count(*) INTO v_respondidos FROM ce_enrollments WHERE secuencia_id = p_secuencia_id AND estado = 'respondido';
  SELECT count(*) INTO v_interesados FROM ce_enrollments WHERE secuencia_id = p_secuencia_id AND estado = 'interesado';

  SELECT count(*) INTO v_enviados
  FROM ce_envios e JOIN ce_enrollments en ON en.id = e.enrollment_id
  WHERE en.secuencia_id = p_secuencia_id AND e.estado != 'pendiente';

  SELECT count(*) INTO v_abiertos
  FROM ce_envios e JOIN ce_enrollments en ON en.id = e.enrollment_id
  WHERE en.secuencia_id = p_secuencia_id AND e.abierto_at IS NOT NULL;

  RETURN jsonb_build_object(
    'total_enrollments', v_total,
    'activos', v_activos,
    'completados', v_completados,
    'respondidos', v_respondidos,
    'interesados', v_interesados,
    'tasa_respuesta', CASE WHEN v_enviados > 0 THEN round((v_respondidos::numeric / v_enviados) * 100, 2) ELSE 0 END,
    'tasa_apertura', CASE WHEN v_enviados > 0 THEN round((v_abiertos::numeric / v_enviados) * 100, 2) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- F6. ce_procesar_evento — trigger function for ce_eventos
CREATE OR REPLACE FUNCTION ce_procesar_evento()
RETURNS TRIGGER AS $$
BEGIN
  -- Update ce_envios timestamps
  IF NEW.envio_id IS NOT NULL THEN
    CASE NEW.tipo
      WHEN 'sent' THEN
        UPDATE ce_envios SET estado = 'enviado', enviado_at = COALESCE(NEW.created_at, now()) WHERE id = NEW.envio_id;
      WHEN 'delivered' THEN
        UPDATE ce_envios SET estado = 'entregado', entregado_at = COALESCE(NEW.created_at, now()) WHERE id = NEW.envio_id;
      WHEN 'opened' THEN
        UPDATE ce_envios SET estado = 'abierto', abierto_at = COALESCE(abierto_at, NEW.created_at, now()) WHERE id = NEW.envio_id;
      WHEN 'bounced' THEN
        UPDATE ce_envios SET estado = 'rebotado', error_detalle = NEW.payload->>'reason' WHERE id = NEW.envio_id;
      WHEN 'complained' THEN
        UPDATE ce_envios SET estado = 'queja' WHERE id = NEW.envio_id;
      WHEN 'replied' THEN
        UPDATE ce_envios SET estado = 'respondido', respondido_at = COALESCE(NEW.created_at, now()) WHERE id = NEW.envio_id;
      ELSE NULL;
    END CASE;
  END IF;

  -- Update ce_contactos on bounce/complaint
  IF NEW.contacto_id IS NOT NULL THEN
    CASE NEW.tipo
      WHEN 'bounced' THEN
        UPDATE ce_contactos SET estado = 'rebotado' WHERE id = NEW.contacto_id;
      WHEN 'complained' THEN
        UPDATE ce_contactos SET estado = 'queja' WHERE id = NEW.contacto_id;
      ELSE NULL;
    END CASE;
  END IF;

  -- Update ce_enrollments on reply/bounce
  IF NEW.envio_id IS NOT NULL THEN
    CASE NEW.tipo
      WHEN 'replied' THEN
        UPDATE ce_enrollments SET estado = 'respondido'
        WHERE id = (SELECT enrollment_id FROM ce_envios WHERE id = NEW.envio_id)
          AND estado = 'activo';
      WHEN 'bounced' THEN
        UPDATE ce_enrollments SET estado = 'rebotado'
        WHERE id = (SELECT enrollment_id FROM ce_envios WHERE id = NEW.envio_id)
          AND estado = 'activo';
      ELSE NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ce_eventos_procesar
  AFTER INSERT ON ce_eventos
  FOR EACH ROW EXECUTE FUNCTION ce_procesar_evento();


-- F7. ce_check_auto_pausa
CREATE OR REPLACE FUNCTION ce_check_auto_pausa()
RETURNS void AS $$
DECLARE
  v_bounce_threshold NUMERIC;
  v_complaint_threshold NUMERIC;
  r RECORD;
  v_health JSONB;
BEGIN
  SELECT (valor)::numeric INTO v_bounce_threshold FROM ce_config WHERE clave = 'bounce_threshold';
  SELECT (valor)::numeric INTO v_complaint_threshold FROM ce_config WHERE clave = 'complaint_threshold';

  FOR r IN
    SELECT id FROM ce_cuentas WHERE estado IN ('ramping','resting')
  LOOP
    v_health := ce_health_score(r.id);
    IF (v_health->>'bounce_rate')::numeric > v_bounce_threshold
       OR (v_health->>'complaint_rate')::numeric > v_complaint_threshold THEN
      UPDATE ce_cuentas SET estado = 'paused' WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- F8. ce_avanzar_warmup
CREATE OR REPLACE FUNCTION ce_avanzar_warmup()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, warmup_dia_actual, warmup_inicio, warmup_incremento, warmup_max
    FROM ce_cuentas WHERE estado = 'ramping'
  LOOP
    UPDATE ce_cuentas
    SET warmup_dia_actual = r.warmup_dia_actual + 1,
        estado = CASE
          WHEN (r.warmup_inicio + ((r.warmup_dia_actual + 1) * r.warmup_incremento)) >= r.warmup_max
          THEN 'resting'
          ELSE 'ramping'
        END
    WHERE id = r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- RLS: Enable on all tables (no policies — service role only)
-- ============================================================================

ALTER TABLE ce_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_listas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_contactos_listas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_secuencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_secuencias_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_pasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_config ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- PERMISSIONS
-- ============================================================================

INSERT INTO permisos (codigo, modulo, nombre, descripcion) VALUES
  ('cold_email.ver', 'Cold Email', 'Ver modulo', 'Ver modulo Cold Email'),
  ('cold_email.contactos.ver', 'Cold Email', 'Ver contactos', 'Ver contactos'),
  ('cold_email.contactos.editar', 'Cold Email', 'Editar contactos', 'Editar contactos'),
  ('cold_email.secuencias.ver', 'Cold Email', 'Ver secuencias', 'Ver secuencias'),
  ('cold_email.secuencias.editar', 'Cold Email', 'Editar secuencias', 'Editar secuencias'),
  ('cold_email.envios.ver', 'Cold Email', 'Ver envios', 'Ver envios'),
  ('cold_email.respuestas.ver', 'Cold Email', 'Ver respuestas', 'Ver respuestas'),
  ('cold_email.respuestas.clasificar', 'Cold Email', 'Clasificar respuestas', 'Clasificar respuestas'),
  ('cold_email.plantillas.ver', 'Cold Email', 'Ver plantillas', 'Ver plantillas'),
  ('cold_email.plantillas.editar', 'Cold Email', 'Editar plantillas', 'Editar plantillas'),
  ('cold_email.config.ver', 'Cold Email', 'Ver configuracion', 'Ver configuracion'),
  ('cold_email.config.editar', 'Cold Email', 'Editar configuracion', 'Editar configuracion')
ON CONFLICT (codigo) DO NOTHING;


-- ============================================================================
-- DONE: Cold Email module ce_* ready
-- ============================================================================
