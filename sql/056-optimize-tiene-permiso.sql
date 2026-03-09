-- ============================================================
-- 056: Optimize tiene_permiso() with per-transaction caching
-- ============================================================
-- The original tiene_permiso() runs 2-3 queries PER ROW in RLS policies.
-- For a table with 100 rows, that's 200-300 extra queries per SELECT.
-- This version caches user type/role on first call and reuses it
-- for the entire transaction via a temp table.

-- Step 1: Create helper function to get/cache user info
CREATE OR REPLACE FUNCTION _get_user_info(p_usuario_id UUID)
RETURNS TABLE(tipo VARCHAR, rol_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Try to read from session cache first
  BEGIN
    RETURN QUERY SELECT ui.tipo, ui.rol_id
      FROM _user_info_cache ui
      WHERE ui.usuario_id = p_usuario_id;
    IF FOUND THEN RETURN; END IF;
  EXCEPTION WHEN undefined_table THEN
    -- Cache table doesn't exist yet, create it
    CREATE TEMP TABLE IF NOT EXISTS _user_info_cache (
      usuario_id UUID PRIMARY KEY,
      tipo VARCHAR,
      rol_id UUID
    ) ON COMMIT DROP;
  END;

  -- Cache miss: query and store
  INSERT INTO _user_info_cache (usuario_id, tipo, rol_id)
  SELECT u.id, u.tipo, u.rol_id FROM usuarios u WHERE u.id = p_usuario_id
  ON CONFLICT (usuario_id) DO NOTHING;

  RETURN QUERY SELECT ui.tipo, ui.rol_id
    FROM _user_info_cache ui
    WHERE ui.usuario_id = p_usuario_id;
END;
$$;

-- Step 2: Replace tiene_permiso with optimized version
CREATE OR REPLACE FUNCTION tiene_permiso(p_usuario_id UUID, p_codigo VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_tipo VARCHAR;
    v_rol_id UUID;
    v_override BOOLEAN;
    v_rol_tiene BOOLEAN;
BEGIN
    -- Get user info (cached per transaction)
    SELECT ui.tipo, ui.rol_id INTO v_tipo, v_rol_id
    FROM _get_user_info(p_usuario_id) ui;

    -- Super Admin siempre tiene permiso
    IF v_tipo = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- If user not found, deny
    IF v_tipo IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Buscar override específico
    SELECT up.permitido INTO v_override
    FROM usuarios_permisos up
    JOIN permisos p ON p.id = up.permiso_id
    WHERE up.usuario_id = p_usuario_id AND p.codigo = p_codigo;

    -- Si hay override, usarlo
    IF v_override IS NOT NULL THEN
        RETURN v_override;
    END IF;

    -- Si no hay override, verificar permiso del rol
    SELECT EXISTS(
        SELECT 1 FROM roles_permisos rp
        JOIN permisos p ON p.id = rp.permiso_id
        WHERE rp.rol_id = v_rol_id AND p.codigo = p_codigo
    ) INTO v_rol_tiene;

    RETURN COALESCE(v_rol_tiene, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Add indexes to speed up permission lookups (if not exist)
CREATE INDEX IF NOT EXISTS idx_usuarios_permisos_usuario
  ON usuarios_permisos (usuario_id);

CREATE INDEX IF NOT EXISTS idx_roles_permisos_rol
  ON roles_permisos (rol_id);

CREATE INDEX IF NOT EXISTS idx_permisos_codigo
  ON permisos (codigo);
