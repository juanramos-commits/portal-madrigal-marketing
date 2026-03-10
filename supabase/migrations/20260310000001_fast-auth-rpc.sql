-- ============================================================================
-- 057: Fast auth RPC — loads user + all permissions in ONE round-trip
-- Instead of: 1) query usuarios 2) RPC permisos_base 3) RPC permisos_ventas
-- Now: 1 single RPC that returns everything
-- ============================================================================

CREATE OR REPLACE FUNCTION obtener_usuario_completo(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_permisos TEXT[];
  v_result JSON;
BEGIN
  -- 1. Get user with role
  SELECT u.*, row_to_json(r.*) AS rol_json
  INTO v_user
  FROM usuarios u
  LEFT JOIN roles r ON r.id = u.rol_id
  WHERE u.email = p_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('usuario', NULL, 'permisos', '[]'::json);
  END IF;

  -- 2. Get ALL permissions in one query
  IF v_user.tipo = 'super_admin' THEN
    -- Super admin gets all permissions
    SELECT array_agg(codigo) INTO v_permisos FROM permisos;
  ELSE
    -- Combine: role permissions + user overrides + ventas role permissions
    SELECT array_agg(DISTINCT codigo) INTO v_permisos
    FROM (
      -- Permissions from user's role
      SELECT p.codigo
      FROM roles_permisos rp
      JOIN permisos p ON p.id = rp.permiso_id
      WHERE rp.rol_id = v_user.rol_id

      UNION

      -- Direct user permission overrides (only active ones)
      SELECT p.codigo
      FROM usuarios_permisos up
      JOIN permisos p ON p.id = up.permiso_id
      WHERE up.usuario_id = v_user.id AND up.permitido = true

      UNION

      -- Ventas commercial role permissions
      SELECT p.codigo
      FROM ventas_roles_comerciales vrc
      JOIN ventas_roles_permisos vrp ON vrp.rol_comercial = vrc.rol
      JOIN permisos p ON p.id = vrp.permiso_id
      WHERE vrc.usuario_id = v_user.id AND vrc.activo = true
    ) all_perms;
  END IF;

  -- 3. Build JSON result with user + role + permissions
  RETURN json_build_object(
    'usuario', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'nombre', v_user.nombre,
      'tipo', v_user.tipo,
      'activo', v_user.activo,
      'rol_id', v_user.rol_id,
      'avatar_url', v_user.avatar_url,
      'cliente_id', v_user.cliente_id,
      'ultimo_acceso', v_user.ultimo_acceso,
      'created_at', v_user.created_at,
      'rol', CASE WHEN v_user.rol_id IS NOT NULL THEN v_user.rol_json ELSE NULL END
    ),
    'permisos', COALESCE(to_json(v_permisos), '[]'::json)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION obtener_usuario_completo(TEXT) TO authenticated;
