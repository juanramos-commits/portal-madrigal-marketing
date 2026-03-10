CREATE OR REPLACE FUNCTION _diag_users()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_agg(row_to_json(t)) FROM (
    SELECT r.usuario_id, r.rol, u.nombre, u.email
    FROM ventas_roles_comerciales r
    JOIN usuarios u ON u.id = r.usuario_id
    WHERE r.activo = true
    LIMIT 10
  ) t;
$$;
GRANT EXECUTE ON FUNCTION _diag_users TO anon;
