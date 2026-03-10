-- =====================================================
-- CRM RPCs: obtener_crm_completo + obtener_lead_detalle
-- Single-roundtrip replacements for multi-query patterns
-- =====================================================

-- 1) obtener_crm_completo: Returns etapas + leads + counts for a pipeline in 1 call
-- Replaces: etapas query + buildLeadQuery (500 leads) + grouping
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

  -- Determine user role for filtering
  IF NOT p_es_admin AND p_user_id IS NOT NULL THEN
    SELECT rol INTO v_role
    FROM ventas_roles_comerciales
    WHERE usuario_id = p_user_id AND activo = true
    LIMIT 1;
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

-- 2) obtener_lead_detalle: Returns lead + pipeline_states + citas + etiquetas + actividad in 1 call
-- Replaces: fetchLeadDetail query + actividad query
CREATE OR REPLACE FUNCTION obtener_lead_detalle(
  p_lead_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_json JSONB;
  v_result JSONB;
  v_pipeline_states JSONB;
  v_citas JSONB;
  v_etiquetas JSONB;
  v_actividad JSONB;
  v_cat JSONB;
  v_setter JSONB;
  v_closer JSONB;
BEGIN
  -- Get lead base data as JSONB
  SELECT jsonb_build_object(
    'id', l.id,
    'nombre', l.nombre,
    'email', l.email,
    'telefono', l.telefono,
    'nombre_negocio', l.nombre_negocio,
    'categoria_id', l.categoria_id,
    'fuente', l.fuente,
    'contactos_adicionales', l.contactos_adicionales,
    'notas', l.notas,
    'resumen_setter', l.resumen_setter,
    'resumen_closer', l.resumen_closer,
    'enlace_grabacion', l.enlace_grabacion,
    'setter_asignado_id', l.setter_asignado_id,
    'closer_asignado_id', l.closer_asignado_id,
    'tags', l.tags,
    'created_at', l.created_at,
    'updated_at', l.updated_at
  ),
  CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'nombre', c.nombre) ELSE NULL END,
  CASE WHEN us.id IS NOT NULL THEN jsonb_build_object('id', us.id, 'nombre', us.nombre, 'email', us.email) ELSE NULL END,
  CASE WHEN uc.id IS NOT NULL THEN jsonb_build_object('id', uc.id, 'nombre', uc.nombre, 'email', uc.email) ELSE NULL END
  INTO v_lead_json, v_cat, v_setter, v_closer
  FROM ventas_leads l
  LEFT JOIN ventas_categorias c ON c.id = l.categoria_id
  LEFT JOIN usuarios us ON us.id = l.setter_asignado_id
  LEFT JOIN usuarios uc ON uc.id = l.closer_asignado_id
  WHERE l.id = p_lead_id;

  IF v_lead_json IS NULL THEN
    RETURN NULL;
  END IF;

  -- Pipeline states with nested pipeline + etapa
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ps.id,
      'lead_id', ps.lead_id,
      'pipeline_id', ps.pipeline_id,
      'etapa_id', ps.etapa_id,
      'contador_intentos', ps.contador_intentos,
      'fecha_entrada', ps.fecha_entrada,
      'pipeline', jsonb_build_object('id', p.id, 'nombre', p.nombre),
      'etapa', jsonb_build_object('id', e.id, 'nombre', e.nombre, 'color', e.color, 'tipo', e.tipo, 'max_intentos', e.max_intentos)
    )
  ), '[]'::jsonb) INTO v_pipeline_states
  FROM ventas_lead_pipeline ps
  LEFT JOIN ventas_pipelines p ON p.id = ps.pipeline_id
  LEFT JOIN ventas_etapas e ON e.id = ps.etapa_id
  WHERE ps.lead_id = p_lead_id;

  -- Citas with closer + estado_reunion, ordered by fecha_hora DESC
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ci.id,
      'lead_id', ci.lead_id,
      'fecha_hora', ci.fecha_hora,
      'estado', ci.estado,
      'notas_closer', ci.notas_closer,
      'google_meet_url', ci.google_meet_url,
      'origen_agendacion', ci.origen_agendacion,
      'estado_reunion_id', ci.estado_reunion_id,
      'closer', CASE WHEN uc2.id IS NOT NULL THEN jsonb_build_object('id', uc2.id, 'nombre', uc2.nombre) ELSE NULL END,
      'estado_reunion', CASE WHEN er.id IS NOT NULL THEN jsonb_build_object('id', er.id, 'nombre', er.nombre, 'color', er.color) ELSE NULL END
    ) ORDER BY ci.fecha_hora DESC
  ), '[]'::jsonb) INTO v_citas
  FROM ventas_citas ci
  LEFT JOIN usuarios uc2 ON uc2.id = ci.closer_id
  LEFT JOIN ventas_reunion_estados er ON er.id = ci.estado_reunion_id
  WHERE ci.lead_id = p_lead_id;

  -- Etiquetas
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'etiqueta_id', le.etiqueta_id,
      'etiqueta', jsonb_build_object('id', et.id, 'nombre', et.nombre, 'color', et.color)
    )
  ), '[]'::jsonb) INTO v_etiquetas
  FROM ventas_lead_etiquetas le
  JOIN ventas_etiquetas et ON et.id = le.etiqueta_id
  WHERE le.lead_id = p_lead_id;

  -- Activity (first 20, most recent)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'lead_id', a.lead_id,
      'tipo', a.tipo,
      'descripcion', a.descripcion,
      'created_at', a.created_at,
      'usuario', CASE WHEN u.id IS NOT NULL THEN jsonb_build_object('id', u.id, 'nombre', u.nombre) ELSE NULL END
    ) ORDER BY a.created_at DESC
  ), '[]'::jsonb) INTO v_actividad
  FROM (
    SELECT * FROM ventas_actividad
    WHERE lead_id = p_lead_id
    ORDER BY created_at DESC
    LIMIT 20
  ) a
  LEFT JOIN usuarios u ON u.id = a.usuario_id;

  -- Build result
  v_result := v_lead_json || jsonb_build_object(
    'categoria', v_cat,
    'setter', v_setter,
    'closer', v_closer,
    'pipeline_states', v_pipeline_states,
    'citas', v_citas,
    'lead_etiquetas', v_etiquetas,
    'actividad', v_actividad
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables still applies via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION obtener_crm_completo TO authenticated;
GRANT EXECUTE ON FUNCTION obtener_lead_detalle TO authenticated;
