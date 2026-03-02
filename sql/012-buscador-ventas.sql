CREATE OR REPLACE FUNCTION public.ventas_buscar_ventas(
  p_query TEXT,
  p_estado TEXT DEFAULT NULL,
  p_es_devolucion BOOLEAN DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  venta_id UUID,
  relevancia INTEGER,
  total_count BIGINT
) AS $fn$
DECLARE
  v_normalized_query TEXT;
  v_terms TEXT[];
BEGIN
  v_normalized_query := public.normalize_text(TRIM(COALESCE(p_query, '')));

  IF v_normalized_query = '' THEN
    RETURN QUERY
      SELECT
        v.id,
        0::INTEGER,
        COUNT(*) OVER ()
      FROM public.ventas_ventas v
      WHERE
        (p_estado IS NULL OR v.estado = p_estado)
        AND (p_es_devolucion IS NULL OR v.es_devolucion = p_es_devolucion)
        AND (
          COALESCE(p_user_role, '') IN ('super_admin', 'director_ventas')
          OR v.setter_id = p_user_id
          OR v.closer_id = p_user_id
        )
      ORDER BY v.fecha_venta DESC, v.created_at DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  v_terms := array_remove(string_to_array(v_normalized_query, ' '), '');

  RETURN QUERY
    WITH base AS (
      SELECT
        v.id AS vid,
        (
          public.normalize_text(COALESCE(lead.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(lead.email, '')) || ' ' ||
          public.normalize_text(COALESCE(lead.nombre_negocio, '')) || ' ' ||
          public.normalize_text(COALESCE(paq.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(v.metodo_pago, '')) || ' ' ||
          public.normalize_text(COALESCE(v.estado, '')) || ' ' ||
          public.normalize_text(COALESCE(setter.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(closer.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(v.notas, '')) || ' ' ||
          CAST(v.importe AS TEXT) || ' ' ||
          TO_CHAR(v.fecha_venta, 'DD/MM/YYYY')
        ) AS search_text,
        regexp_replace(COALESCE(lead.telefono, ''), '[^0-9]', '', 'g') AS phone_digits,
        -- Per-term relevance scoring (works for both single and multi-word)
        COALESCE((
          SELECT SUM(
            CASE WHEN public.normalize_text(COALESCE(lead.nombre, '')) LIKE '%' || t || '%' THEN 100 ELSE 0 END
            + CASE WHEN regexp_replace(t, '[^0-9]', '', 'g') != ''
                 AND regexp_replace(COALESCE(lead.telefono, ''), '[^0-9]', '', 'g')
                     LIKE '%' || regexp_replace(t, '[^0-9]', '', 'g') || '%'
                 THEN 90 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(lead.email, '')) LIKE '%' || t || '%' THEN 80 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(lead.nombre_negocio, '')) LIKE '%' || t || '%' THEN 70 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(paq.nombre, '')) LIKE '%' || t || '%' THEN 60 ELSE 0 END
            + CASE WHEN CAST(v.importe AS TEXT) LIKE '%' || t || '%' THEN 50 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(v.metodo_pago, '')) LIKE '%' || t || '%' THEN 40 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(v.estado, '')) LIKE '%' || t || '%' THEN 30 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(setter.nombre, '')) LIKE '%' || t || '%' THEN 30 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(closer.nombre, '')) LIKE '%' || t || '%' THEN 30 ELSE 0 END
            + CASE WHEN TO_CHAR(v.fecha_venta, 'DD/MM/YYYY') LIKE '%' || t || '%' THEN 20 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(v.notas, '')) LIKE '%' || t || '%' THEN 10 ELSE 0 END
          )
          FROM unnest(v_terms) AS t
        ), 0)::INTEGER AS rel
      FROM public.ventas_ventas v
      LEFT JOIN public.ventas_leads lead ON lead.id = v.lead_id
      LEFT JOIN public.ventas_paquetes paq ON paq.id = v.paquete_id
      LEFT JOIN public.usuarios setter ON setter.id = v.setter_id
      LEFT JOIN public.usuarios closer ON closer.id = v.closer_id
      WHERE
        (p_estado IS NULL OR v.estado = p_estado)
        AND (p_es_devolucion IS NULL OR v.es_devolucion = p_es_devolucion)
        AND (
          COALESCE(p_user_role, '') IN ('super_admin', 'director_ventas')
          OR v.setter_id = p_user_id
          OR v.closer_id = p_user_id
        )
    ),
    filtered AS (
      SELECT b.vid, b.rel FROM base b
      WHERE COALESCE((
        SELECT bool_and(
          b.search_text LIKE '%' || t || '%'
          OR (
            regexp_replace(t, '[^0-9]', '', 'g') != ''
            AND b.phone_digits LIKE '%' || regexp_replace(t, '[^0-9]', '', 'g') || '%'
          )
        )
        FROM unnest(v_terms) AS t
      ), FALSE)
    )
    SELECT
      f.vid,
      f.rel,
      COUNT(*) OVER () AS total_count
    FROM filtered f
    ORDER BY f.rel DESC
    LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ventas_buscar_ventas(TEXT, TEXT, BOOLEAN, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
