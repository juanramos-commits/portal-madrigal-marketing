-- ============================================================================
-- 011 - Buscador Ultra Potente para CRM Ventas
-- ============================================================================
-- Búsqueda en TODOS los campos del lead: nombre, teléfono, email, negocio,
-- categoría, fuente, setter, closer, etapa, etiquetas, notas, etc.
-- Insensible a acentos y mayúsculas. Soporte multi-palabra (AND).
-- ============================================================================

-- 1. Función de normalización: quita acentos + lowercase
CREATE OR REPLACE FUNCTION public.normalize_text(input TEXT)
RETURNS TEXT AS $fn$
BEGIN
  RETURN LOWER(
    translate(
      COALESCE(input, ''),
      'áàâãäéèêëíìîïóòôõöúùûüñçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇ',
      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
    )
  );
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Función de búsqueda completa con relevancia
CREATE OR REPLACE FUNCTION public.ventas_buscar_leads(
  p_query TEXT,
  p_pipeline_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  lead_id UUID,
  relevancia INTEGER
) AS $fn$
DECLARE
  v_terms TEXT[];
  v_normalized_query TEXT;
BEGIN
  v_normalized_query := public.normalize_text(TRIM(COALESCE(p_query, '')));

  -- Empty query: return all leads with RBAC
  IF v_normalized_query = '' THEN
    RETURN QUERY
      SELECT l.id AS lead_id, 0::INTEGER AS relevancia
      FROM public.ventas_leads l
      WHERE (p_pipeline_id IS NULL OR EXISTS (
        SELECT 1 FROM public.ventas_lead_pipeline lp2
        WHERE lp2.lead_id = l.id AND lp2.pipeline_id = p_pipeline_id
      ))
      AND (
        COALESCE(p_user_role, '') IN ('super_admin', 'director_ventas')
        OR l.setter_asignado_id = p_user_id
        OR l.closer_asignado_id = p_user_id
      )
      ORDER BY l.created_at DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Split query into individual terms
  v_terms := array_remove(string_to_array(v_normalized_query, ' '), '');

  RETURN QUERY
    SELECT
      sub.id AS lead_id,
      sub.score::INTEGER AS relevancia
    FROM (
      SELECT
        l.id,
        -- Concatenated searchable text (all fields normalized)
        (
          public.normalize_text(COALESCE(l.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(l.email, '')) || ' ' ||
          public.normalize_text(COALESCE(l.nombre_negocio, '')) || ' ' ||
          public.normalize_text(COALESCE(cat.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(l.fuente, '')) || ' ' ||
          public.normalize_text(COALESCE(setter_u.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(closer_u.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(etapa.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(l.notas, '')) || ' ' ||
          public.normalize_text(COALESCE(l.contactos_adicionales, '')) || ' ' ||
          public.normalize_text(COALESCE(l.resumen_setter, '')) || ' ' ||
          public.normalize_text(COALESCE(l.resumen_closer, '')) || ' ' ||
          public.normalize_text(COALESCE(l.enlace_grabacion, '')) || ' ' ||
          COALESCE((
            SELECT string_agg(public.normalize_text(et.nombre), ' ')
            FROM public.ventas_lead_etiquetas le
            JOIN public.ventas_etiquetas et ON et.id = le.etiqueta_id
            WHERE le.lead_id = l.id
          ), '')
        ) AS search_text,
        -- Phone digits only (for phone-specific matching)
        regexp_replace(COALESCE(l.telefono, ''), '[^0-9]', '', 'g') AS phone_digits,
        -- Relevance score based on which field matches the full query
        (
          CASE WHEN public.normalize_text(COALESCE(l.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 100 ELSE 0 END +
          CASE WHEN regexp_replace(v_normalized_query, '[^0-9]', '', 'g') != ''
               AND regexp_replace(COALESCE(l.telefono, ''), '[^0-9]', '', 'g')
                   LIKE '%' || regexp_replace(v_normalized_query, '[^0-9]', '', 'g') || '%'
               THEN 90 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.email, '')) LIKE '%' || v_normalized_query || '%' THEN 80 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.nombre_negocio, '')) LIKE '%' || v_normalized_query || '%' THEN 70 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(cat.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 60 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.fuente, '')) LIKE '%' || v_normalized_query || '%' THEN 50 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(setter_u.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 40 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(closer_u.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 40 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(etapa.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 30 ELSE 0 END +
          CASE WHEN EXISTS (
            SELECT 1 FROM public.ventas_lead_etiquetas le
            JOIN public.ventas_etiquetas et ON et.id = le.etiqueta_id
            WHERE le.lead_id = l.id AND public.normalize_text(et.nombre) LIKE '%' || v_normalized_query || '%'
          ) THEN 30 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.notas, '')) LIKE '%' || v_normalized_query || '%' THEN 20 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.contactos_adicionales, '')) LIKE '%' || v_normalized_query || '%' THEN 20 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.resumen_setter, '')) LIKE '%' || v_normalized_query || '%' THEN 10 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.resumen_closer, '')) LIKE '%' || v_normalized_query || '%' THEN 10 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.enlace_grabacion, '')) LIKE '%' || v_normalized_query || '%' THEN 5 ELSE 0 END
        ) AS score,
        l.created_at
      FROM public.ventas_leads l
      LEFT JOIN public.ventas_categorias cat ON cat.id = l.categoria_id
      LEFT JOIN public.usuarios setter_u ON setter_u.id = l.setter_asignado_id
      LEFT JOIN public.usuarios closer_u ON closer_u.id = l.closer_asignado_id
      LEFT JOIN public.ventas_lead_pipeline lp ON lp.lead_id = l.id AND lp.pipeline_id = p_pipeline_id
      LEFT JOIN public.ventas_etapas etapa ON etapa.id = lp.etapa_id
      WHERE
        -- Pipeline filter
        (p_pipeline_id IS NULL OR lp.pipeline_id IS NOT NULL)
        -- RBAC: admins see all, others see only their assigned leads
        AND (
          COALESCE(p_user_role, '') IN ('super_admin', 'director_ventas')
          OR l.setter_asignado_id = p_user_id
          OR l.closer_asignado_id = p_user_id
        )
    ) sub
    -- Multi-word AND: ALL terms must match in at least one field
    WHERE COALESCE((
      SELECT bool_and(
        sub.search_text LIKE '%' || t || '%'
        OR (
          regexp_replace(t, '[^0-9]', '', 'g') != ''
          AND sub.phone_digits LIKE '%' || regexp_replace(t, '[^0-9]', '', 'g') || '%'
        )
      )
      FROM unnest(v_terms) AS t
    ), FALSE)
    ORDER BY sub.score DESC, sub.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_ventas_leads_nombre_lower ON ventas_leads (LOWER(nombre));
CREATE INDEX IF NOT EXISTS idx_ventas_leads_telefono ON ventas_leads (telefono);
CREATE INDEX IF NOT EXISTS idx_ventas_leads_email_lower ON ventas_leads (LOWER(email));

-- 4. Permisos
GRANT EXECUTE ON FUNCTION public.normalize_text(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_buscar_leads(TEXT, UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
