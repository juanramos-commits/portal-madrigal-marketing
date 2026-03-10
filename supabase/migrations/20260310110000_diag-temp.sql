CREATE OR REPLACE FUNCTION _diag_pipelines()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_agg(row_to_json(t)) FROM (
    SELECT id, nombre FROM ventas_pipelines WHERE activo = true LIMIT 5
  ) t;
$$;
GRANT EXECUTE ON FUNCTION _diag_pipelines TO anon;
