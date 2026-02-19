-- FASE 3 - PASO 2: Sistema de alertas de seguridad
-- Ejecutado en Supabase el 2026-02-19

-- Tabla de alertas
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  severidad VARCHAR(20) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  usuario_afectado_id UUID REFERENCES usuarios(id),
  usuario_origen_id UUID REFERENCES usuarios(id),
  datos JSONB,
  resuelta BOOLEAN DEFAULT FALSE,
  resuelta_por UUID REFERENCES usuarios(id),
  resuelta_at TIMESTAMPTZ,
  notas_resolucion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_tipo ON security_alerts(tipo);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severidad ON security_alerts(severidad);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resuelta ON security_alerts(resuelta);
CREATE INDEX IF NOT EXISTS idx_security_alerts_fecha ON security_alerts(created_at DESC);

ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_alerts_select ON security_alerts FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'sistema.logs')
);

CREATE POLICY security_alerts_update ON security_alerts FOR UPDATE USING (
  tiene_permiso(auth.uid()::uuid, 'sistema.logs')
);

-- Función para generar alertas
CREATE OR REPLACE FUNCTION generar_alerta_seguridad(
  p_tipo VARCHAR(50),
  p_severidad VARCHAR(20),
  p_titulo VARCHAR(255),
  p_descripcion TEXT DEFAULT NULL,
  p_usuario_afectado UUID DEFAULT NULL,
  p_usuario_origen UUID DEFAULT NULL,
  p_datos JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO security_alerts (tipo, severidad, titulo, descripcion, usuario_afectado_id, usuario_origen_id, datos)
  VALUES (p_tipo, p_severidad, p_titulo, p_descripcion, p_usuario_afectado, p_usuario_origen, p_datos)
  RETURNING id INTO v_alert_id;
  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de alertas automáticas en cambios de usuario
CREATE OR REPLACE FUNCTION fn_alert_cambio_rol() RETURNS TRIGGER AS $$
DECLARE
  v_rol_anterior VARCHAR;
  v_rol_nuevo VARCHAR;
  v_nivel_anterior INTEGER;
  v_nivel_nuevo INTEGER;
BEGIN
  IF OLD.rol_id IS DISTINCT FROM NEW.rol_id THEN
    SELECT nombre, nivel INTO v_rol_anterior FROM roles WHERE id = OLD.rol_id;
    SELECT nombre, nivel INTO v_rol_nuevo FROM roles WHERE id = NEW.rol_id;
    IF COALESCE(v_nivel_anterior, 0) >= 70 OR COALESCE(v_nivel_nuevo, 0) >= 70 THEN
      PERFORM generar_alerta_seguridad(
        'cambio_rol_critico',
        CASE WHEN COALESCE(v_nivel_nuevo, 0) >= 90 THEN 'critica' ELSE 'alta' END,
        format('Cambio de rol crítico: %s -> %s', COALESCE(v_rol_anterior, 'ninguno'), COALESCE(v_rol_nuevo, 'ninguno')),
        format('Usuario %s cambió de rol', NEW.nombre),
        NEW.id,
        NULLIF(auth.uid()::text, '')::uuid,
        jsonb_build_object('rol_anterior', v_rol_anterior, 'rol_nuevo', v_rol_nuevo, 'nivel_anterior', v_nivel_anterior, 'nivel_nuevo', v_nivel_nuevo)
      );
    END IF;
  END IF;

  IF OLD.activo = true AND NEW.activo = false THEN
    PERFORM generar_alerta_seguridad(
      'usuario_desactivado',
      'media',
      format('Usuario desactivado: %s', NEW.nombre),
      format('El usuario %s (%s) ha sido desactivado', NEW.nombre, NEW.email),
      NEW.id,
      NULLIF(auth.uid()::text, '')::uuid
    );
  END IF;

  IF OLD.tipo IS DISTINCT FROM NEW.tipo THEN
    PERFORM generar_alerta_seguridad(
      'cambio_tipo_usuario',
      'critica',
      format('Cambio de tipo: %s -> %s para %s', OLD.tipo, NEW.tipo, NEW.nombre),
      NULL,
      NEW.id,
      NULLIF(auth.uid()::text, '')::uuid,
      jsonb_build_object('tipo_anterior', OLD.tipo, 'tipo_nuevo', NEW.tipo)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error en alerta de seguridad: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS alert_cambio_rol ON usuarios;
CREATE TRIGGER alert_cambio_rol
  AFTER UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_alert_cambio_rol();
