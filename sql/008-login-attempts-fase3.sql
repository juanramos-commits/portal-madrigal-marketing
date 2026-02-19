-- FASE 3 - PASO 3: Login attempts y políticas de contraseñas
-- Ejecutado en Supabase el 2026-02-19

-- Tabla de tracking de intentos de login
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  exitoso BOOLEAN DEFAULT FALSE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at DESC);

-- Función para verificar si una cuenta está bloqueada
CREATE OR REPLACE FUNCTION cuenta_bloqueada(p_email VARCHAR) RETURNS BOOLEAN AS $$
DECLARE
  v_intentos_fallidos INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_intentos_fallidos
  FROM login_attempts
  WHERE email = p_email
    AND exitoso = false
    AND created_at > NOW() - INTERVAL '30 minutes';
  RETURN v_intentos_fallidos >= 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS para login_attempts
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY login_attempts_insert ON login_attempts FOR INSERT WITH CHECK (true);

CREATE POLICY login_attempts_select ON login_attempts FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'sistema.logs')
);

-- Limpieza automática de datos temporales
CREATE OR REPLACE FUNCTION limpiar_datos_temporales() RETURNS VOID AS $$
BEGIN
  DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM security_alerts WHERE resuelta = true AND resuelta_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permiso para backup
INSERT INTO permisos (modulo, codigo, descripcion)
SELECT 'sistema', 'sistema.backup', 'Exportar datos del sistema'
WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = 'sistema.backup');
