-- ==========================================================================
-- PATCH: Excluir leads descartados (No Lead, Teléfono Erróneo) de métricas
-- ==========================================================================

-- ═══ KPIs por rol (actualizado) ═══
CREATE OR REPLACE FUNCTION ventas_dashboard_kpis(
  p_usuario_id UUID,
  p_fecha_inicio DATE,
  p_fecha_fin DATE
) RETURNS JSONB AS $$
DECLARE
  v_rol TEXT;
  v_es_admin BOOLEAN;
  v_result JSONB;
  v_setters_pipeline UUID := 'a0000000-0000-0000-0000-000000000001';
  v_por_contactar_etapa UUID := '86426696-28a8-492f-85e6-6857fce68f3f';
  v_realizada_estado UUID := '6fd26c34-a2f8-4569-9795-9343ab5818d7';
  v_cancelada_estado UUID := '29cc3d56-a06c-4c63-b4ef-58f3c21b1647';
  v_no_show_estado UUID := '59c42d73-7ac1-4e38-a465-722ceb2bb6aa';
BEGIN
  SELECT u.tipo = 'super_admin' INTO v_es_admin FROM usuarios u WHERE u.id = p_usuario_id;

  IF NOT v_es_admin THEN
    SELECT r.rol INTO v_rol FROM ventas_roles_comerciales r
    WHERE r.usuario_id = p_usuario_id AND r.activo = true
    ORDER BY CASE r.rol WHEN 'director_ventas' THEN 1 WHEN 'closer' THEN 2 WHEN 'setter' THEN 3 END
    LIMIT 1;
  END IF;

  IF v_es_admin OR v_rol = 'director_ventas' THEN
    SELECT jsonb_build_object(
      'rol', COALESCE(v_rol, 'admin'),
      'leads_nuevos', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(id)),
      'citas_agendadas', (SELECT COUNT(*) FROM ventas_citas WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin),
      'ventas_cerradas', (SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin),
      'facturacion_total', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin), 0),
      'llamadas_realizadas', (SELECT COUNT(*) FROM ventas_citas WHERE fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin AND estado_reunion_id = v_realizada_estado),
      'contactados', (SELECT COUNT(DISTINCT lp.lead_id) FROM ventas_lead_pipeline lp JOIN ventas_leads l ON l.id = lp.lead_id WHERE lp.pipeline_id = v_setters_pipeline AND lp.etapa_id != v_por_contactar_etapa AND l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(l.id))
    ) INTO v_result;
  ELSIF v_rol = 'closer' THEN
    SELECT jsonb_build_object(
      'rol', 'closer',
      'citas_recibidas', (SELECT COUNT(*) FROM ventas_citas WHERE closer_id = p_usuario_id AND fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin),
      'llamadas_realizadas', (SELECT COUNT(*) FROM ventas_citas WHERE closer_id = p_usuario_id AND fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin AND estado_reunion_id IS NOT NULL AND estado_reunion_id != v_cancelada_estado AND estado_reunion_id != v_no_show_estado),
      'ventas_cerradas', (SELECT COUNT(*) FROM ventas_ventas WHERE closer_id = p_usuario_id AND estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin),
      'facturacion_total', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE closer_id = p_usuario_id AND estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin), 0)
    ) INTO v_result;
  ELSIF v_rol = 'setter' THEN
    SELECT jsonb_build_object(
      'rol', 'setter',
      'leads_asignados', (SELECT COUNT(*) FROM ventas_leads WHERE setter_asignado_id = p_usuario_id AND created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(id)),
      'contactados', (SELECT COUNT(DISTINCT lp.lead_id) FROM ventas_lead_pipeline lp JOIN ventas_leads l ON l.id = lp.lead_id WHERE lp.pipeline_id = v_setters_pipeline AND l.setter_asignado_id = p_usuario_id AND lp.etapa_id != v_por_contactar_etapa AND l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(l.id)),
      'citas_agendadas', (SELECT COUNT(*) FROM ventas_citas WHERE setter_origen_id = p_usuario_id AND created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin)
    ) INTO v_result;
  ELSE
    v_result := jsonb_build_object('rol', 'none');
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ Embudo de conversion (actualizado) ═══
CREATE OR REPLACE FUNCTION ventas_dashboard_funnel(
  p_fecha_inicio DATE,
  p_fecha_fin DATE
) RETURNS JSONB AS $$
DECLARE
  v_leads BIGINT;
  v_contactados BIGINT;
  v_citas BIGINT;
  v_llamadas BIGINT;
  v_ventas BIGINT;
  v_setters_pipeline UUID := 'a0000000-0000-0000-0000-000000000001';
  v_por_contactar_etapa UUID := '86426696-28a8-492f-85e6-6857fce68f3f';
  v_realizada_estado UUID := '6fd26c34-a2f8-4569-9795-9343ab5818d7';
BEGIN
  SELECT COUNT(*) INTO v_leads FROM ventas_leads WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(id);
  SELECT COUNT(DISTINCT lp.lead_id) INTO v_contactados
  FROM ventas_lead_pipeline lp JOIN ventas_leads l ON l.id = lp.lead_id
  WHERE lp.pipeline_id = v_setters_pipeline AND lp.etapa_id != v_por_contactar_etapa AND l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(l.id);
  SELECT COUNT(*) INTO v_citas FROM ventas_citas WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin;
  SELECT COUNT(*) INTO v_llamadas FROM ventas_citas WHERE fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin AND estado_reunion_id = v_realizada_estado;
  SELECT COUNT(*) INTO v_ventas FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin;

  RETURN jsonb_build_object('leads', v_leads, 'contactados', v_contactados, 'citas', v_citas, 'llamadas', v_llamadas, 'ventas', v_ventas);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ Ranking de equipo (actualizado) ═══
CREATE OR REPLACE FUNCTION ventas_dashboard_ranking(
  p_fecha_inicio DATE,
  p_fecha_fin DATE
) RETURNS JSONB AS $$
DECLARE
  v_setters JSONB;
  v_closers JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.citas DESC), '[]'::jsonb) INTO v_setters
  FROM (
    SELECT u.id as usuario_id, u.nombre, u.email, u.avatar_url,
      COUNT(c.id) as citas,
      (SELECT COUNT(*) FROM ventas_leads l2 WHERE l2.setter_asignado_id = u.id AND l2.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(l2.id)) as leads_asignados
    FROM usuarios u
    JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'setter' AND rc.activo = true
    LEFT JOIN ventas_citas c ON c.setter_origen_id = u.id AND c.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY u.id, u.nombre, u.email, u.avatar_url
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.facturacion DESC), '[]'::jsonb) INTO v_closers
  FROM (
    SELECT u.id as usuario_id, u.nombre, u.email, u.avatar_url,
      COUNT(v.id) as ventas,
      COALESCE(SUM(v.importe), 0) as facturacion,
      (SELECT COUNT(*) FROM ventas_citas c2 WHERE c2.closer_id = u.id AND c2.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin) as citas_recibidas
    FROM usuarios u
    JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'closer' AND rc.activo = true
    LEFT JOIN ventas_ventas v ON v.closer_id = u.id AND v.estado = 'aprobada' AND v.es_devolucion = false AND v.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY u.id, u.nombre, u.email, u.avatar_url
  ) t;

  RETURN jsonb_build_object('setters', v_setters, 'closers', v_closers);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
