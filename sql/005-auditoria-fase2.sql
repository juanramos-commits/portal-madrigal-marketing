-- ==========================================================================
-- MADRIGAL CRM - FASE 2: SISTEMA DE AUDITORIA
-- Ejecutado en Supabase el 2026-02-19
-- ==========================================================================

-- 1A: Tabla audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_email VARCHAR(255),
  usuario_nombre VARCHAR(255),
  usuario_rol VARCHAR(100),
  accion VARCHAR(50) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  descripcion TEXT,
  tabla_afectada VARCHAR(100),
  registro_id UUID,
  datos_antes JSONB,
  datos_despues JSONB,
  campos_modificados TEXT[],
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_categoria ON audit_log(categoria);
CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON audit_log(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON audit_log(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_fecha ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_cat_fecha ON audit_log(categoria, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'sistema.logs')
);

CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'sistema.logs')
  OR current_user = 'postgres'
);

-- 1B: Funcion registrar_auditoria
CREATE OR REPLACE FUNCTION registrar_auditoria(
  p_usuario_id UUID,
  p_accion VARCHAR(50),
  p_categoria VARCHAR(50),
  p_descripcion TEXT,
  p_tabla VARCHAR(100) DEFAULT NULL,
  p_registro_id UUID DEFAULT NULL,
  p_datos_antes JSONB DEFAULT NULL,
  p_datos_despues JSONB DEFAULT NULL,
  p_campos_modificados TEXT[] DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_email VARCHAR(255);
  v_nombre VARCHAR(255);
  v_rol VARCHAR(100);
BEGIN
  SELECT u.email, u.nombre, r.nombre
  INTO v_email, v_nombre, v_rol
  FROM usuarios u
  LEFT JOIN roles r ON u.rol_id = r.id
  WHERE u.id = p_usuario_id;

  INSERT INTO audit_log (
    usuario_id, usuario_email, usuario_nombre, usuario_rol,
    accion, categoria, descripcion,
    tabla_afectada, registro_id,
    datos_antes, datos_despues, campos_modificados
  ) VALUES (
    p_usuario_id, v_email, v_nombre, v_rol,
    p_accion, p_categoria, p_descripcion,
    p_tabla, p_registro_id,
    p_datos_antes, p_datos_despues, p_campos_modificados
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1C: Trigger generico de auditoria
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_accion VARCHAR(50);
  v_datos_antes JSONB;
  v_datos_despues JSONB;
  v_descripcion TEXT;
  v_registro_id UUID;
  v_campos_modificados TEXT[];
BEGIN
  v_accion := TG_OP;

  IF TG_OP = 'DELETE' THEN
    v_datos_antes := to_jsonb(OLD);
    v_registro_id := OLD.id;
    v_descripcion := format('Eliminado registro de %s', TG_TABLE_NAME);
  ELSIF TG_OP = 'INSERT' THEN
    v_datos_despues := to_jsonb(NEW);
    v_registro_id := NEW.id;
    v_descripcion := format('Creado registro en %s', TG_TABLE_NAME);
  ELSIF TG_OP = 'UPDATE' THEN
    v_datos_antes := to_jsonb(OLD);
    v_datos_despues := to_jsonb(NEW);
    v_registro_id := NEW.id;
    SELECT array_agg(key) INTO v_campos_modificados
    FROM jsonb_each(to_jsonb(NEW)) AS n(key, value)
    WHERE to_jsonb(OLD) ->> key IS DISTINCT FROM to_jsonb(NEW) ->> key;
    v_descripcion := format('Actualizado %s en %s', array_to_string(v_campos_modificados, ', '), TG_TABLE_NAME);
  END IF;

  INSERT INTO audit_log (
    usuario_id, accion, categoria, descripcion,
    tabla_afectada, registro_id,
    datos_antes, datos_despues, campos_modificados
  ) VALUES (
    NULLIF(auth.uid()::text, '')::uuid, v_accion, TG_TABLE_NAME, v_descripcion,
    TG_TABLE_NAME, v_registro_id,
    v_datos_antes, v_datos_despues, v_campos_modificados
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error en auditoria: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers en tablas sensibles
CREATE TRIGGER audit_usuarios
  AFTER INSERT OR UPDATE OR DELETE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_roles
  AFTER INSERT OR UPDATE OR DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_roles_permisos
  AFTER INSERT OR DELETE ON roles_permisos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_usuarios_permisos
  AFTER INSERT OR UPDATE OR DELETE ON usuarios_permisos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_clientes
  AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Permiso sistema.logs
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('sistema.logs', 'sistema', 'Ver registro de actividad', 'Acceder al registro de auditoria', 50)
ON CONFLICT (codigo) DO NOTHING;
