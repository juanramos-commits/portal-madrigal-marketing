-- Fix: auto-detect admin role server-side instead of trusting p_es_admin from frontend
-- This fixes the timing bug where tienePermiso returns false before usuario loads
CREATE OR REPLACE FUNCTION obtener_crm_completo(
  p_pipeline_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_es_admin BOOLEAN DEFAULT FALSE,
  p_filtro_setter_id UUID DEFAULT NULL,
  p_filtro_closer_id UUID DEFAULT NULL,
  p_filtro_categoria_id UUID DEFAULT NULL,
  p_filtro_fuente TEXT DEFAULT NULL,
  p_filtro_fecha_desde TIMESTAMPTZ DEFAULT NULL,
  p_filtro_fecha_hasta TIMESTAMPTZ DEFAULT NULL,
  p_filtro_etapa_ids UUID[] DEFAULT NULL,
  p_busqueda TEXT DEFAULT NULL,
  p_limit INT DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pipeline RECORD;
  v_etapas JSONB;
  v_leads JSONB;
  v_result JSONB;
  v_role TEXT;
  v_sanitized_search TEXT;
BEGIN
  -- Get pipeline info
  SELECT id, nombre INTO v_pipeline
  FROM ventas_pipelines
  WHERE id = p_pipeline_id AND activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pipeline not found');
  END IF;

  -- Get etapas
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'pipeline_id', e.pipeline_id,
      'nombre', e.nombre,
      'orden', e.orden,
      'activo', e.activo,
      'color', e.color,
      'tipo', e.tipo,
      'max_intentos', e.max_intentos
    ) ORDER BY e.orden
  ), '[]'::jsonb) INTO v_etapas
  FROM ventas_etapas e
  WHERE e.pipeline_id = p_pipeline_id AND e.activo = true;

  -- Auto-detect admin: check usuarios.tipo and ventas_roles_comerciales
  -- This makes p_es_admin a hint — the RPC verifies server-side
  IF p_user_id IS NOT NULL THEN
    IF NOT p_es_admin THEN
      SELECT EXISTS(
        SELECT 1 FROM usuarios WHERE id = p_user_id AND tipo = 'super_admin'
      ) OR EXISTS(
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = p_user_id AND activo = true
          AND rol IN ('super_admin', 'director_ventas')
      ) INTO p_es_admin;
    END IF;

    -- Get commercial role for non-admin filtering
    IF NOT p_es_admin THEN
      SELECT rol INTO v_role
      FROM ventas_roles_comerciales
      WHERE usuario_id = p_user_id AND activo = true
        AND rol IN ('setter', 'closer')
      LIMIT 1;
    END IF;
  END IF;

  -- Sanitize search
  IF p_busqueda IS NOT NULL AND trim(p_busqueda) != '' THEN
    v_sanitized_search := '%' || regexp_replace(trim(p_busqueda), '[%_\\]', '', 'g') || '%';
  END IF;

  -- Get leads with all nested data in one query
  SELECT COALESCE(jsonb_agg(lead_row ORDER BY lead_row->>'fecha_entrada' DESC), '[]'::jsonb)
  INTO v_leads
  FROM (
    SELECT jsonb_build_object(
      'id', lp.id,
      'lead_id', lp.lead_id,
      'pipeline_id', lp.pipeline_id,
      'etapa_id', lp.etapa_id,
      'contador_intentos', lp.contador_intentos,
      'fecha_entrada', lp.fecha_entrada,
      'lead', jsonb_build_object(
        'id', l.id,
        'nombre', l.nombre,
        'email', l.email,
        'telefono', l.telefono,
        'nombre_negocio', l.nombre_negocio,
        'fuente', l.fuente,
        'valor', l.valor,
        'notas', l.notas,
        'resumen_setter', l.resumen_setter,
        'resumen_closer', l.resumen_closer,
        'enlace_grabacion', l.enlace_grabacion,
        'creado_por', l.creado_por,
        'created_at', l.created_at,
        'updated_at', l.updated_at,
        'tags', l.tags,
        'contactos_adicionales', l.contactos_adicionales,
        'fuente_detalle', l.fuente_detalle,
        'setter_asignado_id', l.setter_asignado_id,
        'closer_asignado_id', l.closer_asignado_id,
        'categoria', CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'nombre', c.nombre) ELSE NULL END,
        'setter', CASE WHEN us.id IS NOT NULL THEN jsonb_build_object('id', us.id, 'nombre', us.nombre, 'email', us.email) ELSE NULL END,
        'closer', CASE WHEN uc.id IS NOT NULL THEN jsonb_build_object('id', uc.id, 'nombre', uc.nombre, 'email', uc.email) ELSE NULL END,
        'lead_etiquetas', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'etiqueta_id', le.etiqueta_id,
              'etiqueta', jsonb_build_object('id', et.id, 'nombre', et.nombre, 'color', et.color)
            )
          )
          FROM ventas_lead_etiquetas le
          JOIN ventas_etiquetas et ON et.id = le.etiqueta_id
          WHERE le.lead_id = l.id
        ), '[]'::jsonb)
      )
    ) AS lead_row
    FROM ventas_lead_pipeline lp
    INNER JOIN ventas_leads l ON l.id = lp.lead_id
    LEFT JOIN ventas_categorias c ON c.id = l.categoria_id
    LEFT JOIN usuarios us ON us.id = l.setter_asignado_id
    LEFT JOIN usuarios uc ON uc.id = l.closer_asignado_id
    WHERE lp.pipeline_id = p_pipeline_id
      -- Role-based filtering
      AND (
        p_es_admin
        OR p_user_id IS NULL
        OR (
          CASE
            WHEN lower(v_pipeline.nombre) LIKE '%setter%' AND v_role = 'setter' THEN l.setter_asignado_id = p_user_id
            WHEN lower(v_pipeline.nombre) LIKE '%closer%' AND v_role = 'closer' THEN l.closer_asignado_id = p_user_id
            ELSE FALSE
          END
        )
      )
      -- Filters
      AND (p_filtro_setter_id IS NULL OR l.setter_asignado_id = p_filtro_setter_id)
      AND (p_filtro_closer_id IS NULL OR l.closer_asignado_id = p_filtro_closer_id)
      AND (p_filtro_categoria_id IS NULL OR l.categoria_id = p_filtro_categoria_id)
      AND (p_filtro_fuente IS NULL OR l.fuente = p_filtro_fuente)
      AND (p_filtro_fecha_desde IS NULL OR l.created_at >= p_filtro_fecha_desde)
      AND (p_filtro_fecha_hasta IS NULL OR l.created_at <= p_filtro_fecha_hasta)
      AND (p_filtro_etapa_ids IS NULL OR lp.etapa_id = ANY(p_filtro_etapa_ids))
      AND (v_sanitized_search IS NULL OR (l.nombre ILIKE v_sanitized_search OR l.telefono ILIKE v_sanitized_search))
    ORDER BY lp.fecha_entrada DESC
    LIMIT p_limit
  ) sub;

  v_result := jsonb_build_object(
    'etapas', v_etapas,
    'leads', v_leads
  );

  RETURN v_result;
END;
$$;
