-- ==========================================================================
-- LOG DE ACTIVIDAD GLOBAL
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-02
-- ==========================================================================
-- Tabla unificada para registrar TODA la actividad de la app:
-- logins, cambios de ajustes, CRM, ventas, wallet, calendario, biblioteca.
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- 1. TABLA
-- ==========================================================================
CREATE TABLE IF NOT EXISTS ventas_log_global (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  modulo VARCHAR(30) NOT NULL,
  accion VARCHAR(50) NOT NULL,
  descripcion TEXT NOT NULL,
  entidad VARCHAR(80),
  entidad_id UUID,
  datos JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================================
-- 2. INDEXES
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_vlg_usuario ON ventas_log_global(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vlg_modulo ON ventas_log_global(modulo);
CREATE INDEX IF NOT EXISTS idx_vlg_accion ON ventas_log_global(accion);
CREATE INDEX IF NOT EXISTS idx_vlg_created ON ventas_log_global(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vlg_modulo_created ON ventas_log_global(modulo, created_at DESC);

-- ==========================================================================
-- 3. RLS
-- ==========================================================================
ALTER TABLE ventas_log_global ENABLE ROW LEVEL SECURITY;

-- Solo admin y directores pueden leer
CREATE POLICY vlg_select ON ventas_log_global FOR SELECT USING (
  ventas_es_super_admin()
  OR ventas_tiene_rol('director_ventas')
);

-- Insertar solo vía RPC (SECURITY DEFINER)
-- No se permite INSERT directo desde el cliente
CREATE POLICY vlg_insert ON ventas_log_global FOR INSERT WITH CHECK (
  false
);

-- ==========================================================================
-- 4. RPC — ventas_log()
-- ==========================================================================
CREATE OR REPLACE FUNCTION ventas_log(
  p_modulo VARCHAR,
  p_accion VARCHAR,
  p_descripcion TEXT,
  p_entidad VARCHAR DEFAULT NULL,
  p_entidad_id UUID DEFAULT NULL,
  p_datos JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO ventas_log_global (usuario_id, modulo, accion, descripcion, entidad, entidad_id, datos)
  VALUES (auth.uid(), p_modulo, p_accion, p_descripcion, p_entidad, p_entidad_id, p_datos);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ventas_log failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================================================
-- 5. SEED — Copiar logins existentes de audit_log
-- ==========================================================================
INSERT INTO ventas_log_global (usuario_id, modulo, accion, descripcion, created_at)
SELECT
  usuario_id,
  'auth',
  LOWER(accion),
  descripcion,
  created_at
FROM audit_log
WHERE categoria = 'auth'
ORDER BY created_at DESC
LIMIT 200
ON CONFLICT DO NOTHING;

COMMIT;
