-- ==========================================================================
-- Dashboard: Desglose por Closer y Desglose por Setter
-- Adds two new widget data keys to ventas_dashboard_widget_data:
--   - desglose_closers: breakdown per closer by call date
--   - desglose_setters: breakdown per setter by lead creation date
-- ==========================================================================

CREATE OR REPLACE FUNCTION ventas_dashboard_widget_data(
  p_usuario_id UUID,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_widgets TEXT[]
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_rol TEXT;
  v_es_admin BOOLEAN;
  v_fecha_prev_inicio DATE;
  v_fecha_prev_fin DATE;
  v_diff INTEGER;
BEGIN
  -- Determine role
  SELECT u.tipo = 'super_admin' INTO v_es_admin FROM usuarios u WHERE u.id = p_usuario_id;
  IF NOT v_es_admin THEN
    SELECT r.rol INTO v_rol FROM ventas_roles_comerciales r
    WHERE r.usuario_id = p_usuario_id AND r.activo = true
    ORDER BY CASE r.rol WHEN 'director_ventas' THEN 1 WHEN 'closer' THEN 2 WHEN 'setter' THEN 3 END
    LIMIT 1;
  END IF;

  -- Previous period for trend comparisons
  v_diff := p_fecha_fin - p_fecha_inicio;
  v_fecha_prev_fin := p_fecha_inicio - 1;
  v_fecha_prev_inicio := v_fecha_prev_fin - v_diff;

  -- ══════════════════════════════════════════════════════════════════════
  -- EXISTING WIDGETS (unchanged) — included via full function replacement
  -- ══════════════════════════════════════════════════════════════════════

  -- ── KPIs ──
  IF 'total_leads' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_leads', jsonb_build_object(
      'valor', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0),
      'anterior', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0)
    ));
  END IF;

  IF 'leads_hoy' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_hoy', jsonb_build_object(
      'valor', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date = CURRENT_DATE AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0),
      'anterior', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date = CURRENT_DATE - 1 AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0)
    ));
  END IF;

  IF 'leads_esta_semana' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_esta_semana', jsonb_build_object(
      'valor', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= date_trunc('week', CURRENT_DATE)::date AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0),
      'anterior', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= (date_trunc('week', CURRENT_DATE) - interval '7 days')::date AND created_at::date < date_trunc('week', CURRENT_DATE)::date AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0)
    ));
  END IF;

  IF 'leads_este_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_este_mes', jsonb_build_object(
      'valor', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0),
      'anterior', COALESCE((SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AND created_at::date < date_trunc('month', CURRENT_DATE)::date AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id) AND NOT ventas_lead_descartado(id)), 0)
    ));
  END IF;

  IF 'total_ventas' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_ventas', jsonb_build_object(
      'valor', COALESCE((SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  IF 'ventas_pendientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_pendientes', jsonb_build_object(
      'valor', COALESCE((SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'pendiente' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'pendiente' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  IF 'ventas_aprobadas' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_aprobadas', jsonb_build_object(
      'valor', COALESCE((SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  IF 'ingresos_totales' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_totales', jsonb_build_object(
      'valor', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  IF 'ingresos_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_mes', jsonb_build_object(
      'valor', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta >= date_trunc('month', CURRENT_DATE)::date AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AND fecha_venta < date_trunc('month', CURRENT_DATE)::date AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  IF 'ticket_medio' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ticket_medio', jsonb_build_object(
      'valor', COALESCE((SELECT ROUND(AVG(importe), 2) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT ROUND(AVG(importe), 2) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  -- ── Wallet KPIs ──
  IF 'mi_saldo' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('mi_saldo', jsonb_build_object(
      'valor', COALESCE((SELECT saldo FROM ventas_wallets WHERE usuario_id = p_usuario_id), 0), 'anterior', NULL
    ));
  END IF;
  IF 'mi_saldo_disponible' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('mi_saldo_disponible', jsonb_build_object(
      'valor', COALESCE((SELECT saldo_disponible FROM ventas_wallets WHERE usuario_id = p_usuario_id), 0), 'anterior', NULL
    ));
  END IF;
  IF 'total_ganado' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_ganado', jsonb_build_object(
      'valor', COALESCE((SELECT total_ganado FROM ventas_wallets WHERE usuario_id = p_usuario_id), 0), 'anterior', NULL
    ));
  END IF;
  IF 'total_retirado' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_retirado', jsonb_build_object(
      'valor', COALESCE((SELECT total_retirado FROM ventas_wallets WHERE usuario_id = p_usuario_id), 0), 'anterior', NULL
    ));
  END IF;
  IF 'comisiones_pendientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('comisiones_pendientes', jsonb_build_object(
      'valor', COALESCE((
        SELECT SUM(importe) FROM ventas_comisiones
        WHERE usuario_id = p_usuario_id AND estado = 'pendiente'
      ), 0), 'anterior', NULL
    ));
  END IF;
  IF 'retiros_pendientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('retiros_pendientes', jsonb_build_object(
      'valor', COALESCE((
        SELECT SUM(importe) FROM ventas_retiros
        WHERE usuario_id = p_usuario_id AND estado = 'pendiente'
      ), 0), 'anterior', NULL
    ));
  END IF;

  -- ── Charts ──
  IF 'leads_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT created_at::date as fecha, COUNT(*) as total
        FROM ventas_leads
        WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(id)
        GROUP BY created_at::date
      ) t
    ));
  END IF;

  IF 'ventas_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT fecha_venta as fecha, COUNT(*) as total
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY fecha_venta
      ) t
    ));
  END IF;

  IF 'leads_por_semana' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_semana', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('week', created_at)::date as fecha, COUNT(*) as total
        FROM ventas_leads
        WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(id)
        GROUP BY date_trunc('week', created_at)::date
      ) t
    ));
  END IF;

  IF 'ventas_por_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('month', fecha_venta)::date as fecha, COUNT(*) as total
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY date_trunc('month', fecha_venta)::date
      ) t
    ));
  END IF;

  IF 'ingresos_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT fecha_venta as fecha, COALESCE(SUM(importe), 0) as total
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY fecha_venta
      ) t
    ));
  END IF;

  IF 'ingresos_por_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('month', fecha_venta)::date as fecha, COALESCE(SUM(importe), 0) as total
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY date_trunc('month', fecha_venta)::date
      ) t
    ));
  END IF;

  IF 'comisiones_por_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('comisiones_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('month', created_at)::date as fecha, COALESCE(SUM(importe), 0) as total
        FROM ventas_comisiones
        WHERE usuario_id = p_usuario_id
          AND estado IN ('pendiente', 'disponible', 'retirada')
          AND created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY date_trunc('month', created_at)::date
      ) t
    ));
  END IF;

  IF 'conversion_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('conversion_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT d.fecha,
          COALESCE(l.total, 0) as leads,
          COALESCE(v.total, 0) as ventas,
          CASE WHEN COALESCE(l.total, 0) > 0 THEN ROUND((COALESCE(v.total, 0)::numeric / l.total::numeric) * 100, 1) ELSE 0 END as total
        FROM generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval) d(fecha)
        LEFT JOIN (
          SELECT created_at::date as fecha, COUNT(*) as total
          FROM ventas_leads
          WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
            AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
            AND NOT ventas_lead_descartado(id)
          GROUP BY created_at::date
        ) l ON l.fecha = d.fecha::date
        LEFT JOIN (
          SELECT fecha_venta as fecha, COUNT(*) as total
          FROM ventas_ventas
          WHERE estado = 'aprobada' AND es_devolucion = false
            AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
            AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
          GROUP BY fecha_venta
        ) v ON v.fecha = d.fecha::date
      ) t
    ));
  END IF;

  -- ── Distribution ──
  IF 'leads_por_fuente' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_fuente', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(fuente, 'Sin fuente') as nombre, COUNT(*) as valor
        FROM ventas_leads
        WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(id)
        GROUP BY fuente ORDER BY valor DESC
      ) t
    ));
  END IF;

  IF 'leads_por_categoria' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_categoria', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(c.nombre, 'Sin categoría') as nombre, COUNT(*) as valor, COALESCE(c.color, 'var(--text-muted)') as color
        FROM ventas_leads l
        LEFT JOIN ventas_categorias c ON c.id = l.categoria_id
        WHERE l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(l.id)
        GROUP BY c.nombre, c.color ORDER BY valor DESC
      ) t
    ));
  END IF;

  IF 'ventas_por_paquete' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_paquete', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(p.nombre, 'Sin paquete') as nombre, COUNT(*) as valor
        FROM ventas_ventas vv
        LEFT JOIN ventas_paquetes p ON p.id = vv.paquete_id
        WHERE vv.estado = 'aprobada' AND vv.es_devolucion = false
          AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR vv.closer_id = p_usuario_id OR vv.setter_id = p_usuario_id)
        GROUP BY p.nombre ORDER BY valor DESC
      ) t
    ));
  END IF;

  IF 'ventas_por_metodo_pago' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_metodo_pago', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(metodo_pago, 'Sin definir') as nombre, COUNT(*) as valor
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY metodo_pago ORDER BY valor DESC
      ) t
    ));
  END IF;

  IF 'leads_por_etapa' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_etapa', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT e.nombre, e.color, COALESCE(COUNT(lp.id), 0) as valor, e.orden
        FROM ventas_etapas e
        LEFT JOIN ventas_lead_pipeline lp ON lp.etapa_id = e.id
        LEFT JOIN ventas_leads l ON l.id = lp.lead_id
        WHERE e.activo = true
          AND (lp.id IS NULL OR (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id))
          AND (lp.id IS NULL OR NOT ventas_lead_descartado(l.id))
        GROUP BY e.nombre, e.color, e.orden ORDER BY e.orden
      ) t
    ));
  END IF;

  IF 'ventas_por_estado' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_estado', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT estado as nombre, COUNT(*) as valor
        FROM ventas_ventas
        WHERE es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY estado ORDER BY valor DESC
      ) t
    ));
  END IF;

  -- ── Tables ──
  IF 'leads_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT l.id, l.nombre as lead_nombre, l.telefono, COALESCE(c.nombre, '') as categoria, l.fuente, l.created_at
        FROM ventas_leads l
        LEFT JOIN ventas_categorias c ON c.id = l.categoria_id
        WHERE l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(l.id)
        ORDER BY l.created_at DESC LIMIT 10
      ) t
    ));
  END IF;

  IF 'ventas_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT vv.id, COALESCE(l.nombre, '') as lead_nombre, vv.importe, vv.estado, vv.fecha_venta,
          COALESCE(p.nombre, '') as paquete, COALESCE(uc.nombre, '') as closer_nombre
        FROM ventas_ventas vv
        LEFT JOIN ventas_leads l ON l.id = vv.lead_id
        LEFT JOIN ventas_paquetes p ON p.id = vv.paquete_id
        LEFT JOIN usuarios uc ON uc.id = vv.closer_id
        WHERE vv.es_devolucion = false
          AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR vv.closer_id = p_usuario_id OR vv.setter_id = p_usuario_id)
        ORDER BY vv.fecha_venta DESC, vv.created_at DESC LIMIT 10
      ) t
    ));
  END IF;

  IF 'comisiones_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('comisiones_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT co.id, co.importe, co.estado, co.tipo_comision, co.created_at,
          COALESCE(l.nombre, '') as lead_nombre
        FROM ventas_comisiones co
        LEFT JOIN ventas_ventas vv ON vv.id = co.venta_id
        LEFT JOIN ventas_leads l ON l.id = vv.lead_id
        WHERE co.usuario_id = p_usuario_id
          AND co.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        ORDER BY co.created_at DESC LIMIT 10
      ) t
    ));
  END IF;

  IF 'retiros_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('retiros_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT r.id, r.importe, r.estado, r.metodo, r.created_at
        FROM ventas_retiros r
        WHERE r.usuario_id = p_usuario_id
          AND r.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        ORDER BY r.created_at DESC LIMIT 10
      ) t
    ));
  END IF;

  IF 'leads_sin_contactar' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_sin_contactar', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT l.id, l.nombre as lead_nombre, l.telefono, l.created_at
        FROM ventas_leads l
        JOIN ventas_lead_pipeline lp ON lp.lead_id = l.id
        JOIN ventas_etapas e ON e.id = lp.etapa_id
        JOIN ventas_pipelines pip ON pip.id = lp.pipeline_id
        WHERE pip.nombre ILIKE '%setter%'
          AND e.orden = 1
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(l.id)
        ORDER BY l.created_at ASC LIMIT 10
      ) t
    ));
  END IF;

  IF 'citas_proximas' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('citas_proximas', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT ci.id, ci.fecha_hora, COALESCE(l.nombre, '') as lead_nombre,
          COALESCE(uc.nombre, '') as closer_nombre, ci.google_meet_url
        FROM ventas_citas ci
        LEFT JOIN ventas_leads l ON l.id = ci.lead_id
        LEFT JOIN usuarios uc ON uc.id = ci.closer_id
        WHERE ci.fecha_hora >= NOW()
          AND ci.estado != 'cancelada'
          AND (v_es_admin OR v_rol = 'director_ventas' OR ci.closer_id = p_usuario_id OR ci.setter_origen_id = p_usuario_id)
        ORDER BY ci.fecha_hora ASC LIMIT 10
      ) t
    ));
  END IF;

  -- ── Team ──
  IF 'ranking_closers' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ranking_closers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT u.nombre, u.email,
          COALESCE(COUNT(vv.id), 0) as ventas,
          COALESCE(SUM(vv.importe), 0) as facturacion
        FROM usuarios u
        JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'closer' AND rc.activo = true
        LEFT JOIN ventas_ventas vv ON vv.closer_id = u.id
          AND vv.estado = 'aprobada' AND vv.es_devolucion = false
          AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY u.id, u.nombre, u.email
        ORDER BY facturacion DESC
      ) t
    ));
  END IF;

  IF 'ranking_setters' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ranking_setters', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT u.nombre, u.email,
          COALESCE(COUNT(DISTINCT ci.id), 0) as citas,
          (SELECT COUNT(*) FROM ventas_leads l2 WHERE l2.setter_asignado_id = u.id AND l2.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(l2.id)) as leads_asignados
        FROM usuarios u
        JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'setter' AND rc.activo = true
        LEFT JOIN ventas_citas ci ON ci.setter_origen_id = u.id
          AND ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY u.id, u.nombre, u.email
        ORDER BY citas DESC
      ) t
    ));
  END IF;

  IF 'actividad_reciente' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('actividad_reciente', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT a.id, a.tipo, a.descripcion, a.created_at,
          COALESCE(u.nombre, 'Sistema') as usuario_nombre,
          COALESCE(l.nombre, 'N/A') as lead_nombre
        FROM ventas_actividad a
        LEFT JOIN usuarios u ON u.id = a.usuario_id
        LEFT JOIN ventas_leads l ON l.id = a.lead_id
        WHERE (v_es_admin OR v_rol = 'director_ventas' OR a.usuario_id = p_usuario_id)
        ORDER BY a.created_at DESC
        LIMIT 15
      ) t
    ));
  END IF;

  IF 'conversion_por_closer' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('conversion_por_closer', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT u.nombre,
          COALESCE(ci_count.total, 0) as citas,
          COALESCE(vv_count.total, 0) as ventas,
          CASE WHEN COALESCE(ci_count.total, 0) > 0
            THEN ROUND((COALESCE(vv_count.total, 0)::numeric / ci_count.total::numeric) * 100, 2)
            ELSE 0
          END as tasa
        FROM usuarios u
        JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'closer' AND rc.activo = true
        LEFT JOIN (
          SELECT ci.closer_id, COUNT(*) as total
          FROM ventas_citas ci
          WHERE ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
          GROUP BY ci.closer_id
        ) ci_count ON ci_count.closer_id = u.id
        LEFT JOIN (
          SELECT vv.closer_id, COUNT(*) as total
          FROM ventas_ventas vv
          WHERE vv.estado = 'aprobada' AND vv.es_devolucion = false
            AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          GROUP BY vv.closer_id
        ) vv_count ON vv_count.closer_id = u.id
        ORDER BY tasa DESC
      ) t
    ));
  END IF;

  IF 'conversion_por_setter' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('conversion_por_setter', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT u.nombre,
          COALESCE(l_count.total, 0) as leads,
          COALESCE(ci_count.total, 0) as citas,
          CASE WHEN COALESCE(l_count.total, 0) > 0
            THEN ROUND((COALESCE(ci_count.total, 0)::numeric / l_count.total::numeric) * 100, 2)
            ELSE 0
          END as tasa
        FROM usuarios u
        JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'setter' AND rc.activo = true
        LEFT JOIN (
          SELECT setter_asignado_id, COUNT(*) as total
          FROM ventas_leads
          WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin AND NOT ventas_lead_descartado(id)
          GROUP BY setter_asignado_id
        ) l_count ON l_count.setter_asignado_id = u.id
        LEFT JOIN (
          SELECT ci.setter_origen_id, COUNT(*) as total
          FROM ventas_citas ci
          WHERE ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
          GROUP BY ci.setter_origen_id
        ) ci_count ON ci_count.setter_origen_id = u.id
        ORDER BY tasa DESC
      ) t
    ));
  END IF;

  -- ── Funnel ──
  IF 'funnel_setters' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('funnel_setters', jsonb_build_object(
      'leads', COALESCE((
        SELECT COUNT(*) FROM ventas_leads
        WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'setter' AND setter_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(id)
      ), 0),
      'contactados', COALESCE((
        SELECT COUNT(DISTINCT l.id)
        FROM ventas_leads l
        JOIN ventas_lead_pipeline lp ON lp.lead_id = l.id
        JOIN ventas_etapas e ON e.id = lp.etapa_id
        JOIN ventas_pipelines pip ON pip.id = lp.pipeline_id
        WHERE pip.nombre ILIKE '%setter%'
          AND e.orden > 1
          AND l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'setter' AND l.setter_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(l.id)
      ), 0),
      'citas', COALESCE((
        SELECT COUNT(*)
        FROM ventas_citas ci
        WHERE ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'setter' AND ci.setter_origen_id = p_usuario_id)
      ), 0),
      'ventas', COALESCE((
        SELECT COUNT(*)
        FROM ventas_ventas vv
        WHERE vv.estado = 'aprobada' AND vv.es_devolucion = false
          AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'setter' AND vv.setter_id = p_usuario_id)
      ), 0)
    ));
  END IF;

  IF 'funnel_closers' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('funnel_closers', jsonb_build_object(
      'citas_recibidas', COALESCE((
        SELECT COUNT(*)
        FROM ventas_citas ci
        WHERE ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'closer' AND ci.closer_id = p_usuario_id)
      ), 0),
      'realizadas', COALESCE((
        SELECT COUNT(*)
        FROM ventas_citas ci
        JOIN ventas_etapas e ON e.id = ci.estado_reunion_id
        WHERE ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND ci.estado != 'cancelada'
          AND e.tipo = 'cita_realizada'
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'closer' AND ci.closer_id = p_usuario_id)
      ), 0),
      'ventas', COALESCE((
        SELECT COUNT(*)
        FROM ventas_ventas vv
        WHERE vv.estado = 'aprobada' AND vv.es_devolucion = false
          AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'closer' AND vv.closer_id = p_usuario_id)
      ), 0),
      'facturacion', COALESCE((
        SELECT SUM(vv.importe)
        FROM ventas_ventas vv
        WHERE vv.estado = 'aprobada' AND vv.es_devolucion = false
          AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'closer' AND vv.closer_id = p_usuario_id)
      ), 0)
    ));
  END IF;

  IF 'pipeline_resumen' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('pipeline_resumen', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT e.nombre, e.color, COALESCE(COUNT(lp.id), 0) as total, e.orden
        FROM ventas_etapas e
        LEFT JOIN ventas_lead_pipeline lp ON lp.etapa_id = e.id
        LEFT JOIN ventas_leads l ON l.id = lp.lead_id
        WHERE e.activo = true
          AND (lp.id IS NULL OR v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
          AND (lp.id IS NULL OR NOT ventas_lead_descartado(l.id))
        GROUP BY e.id, e.nombre, e.color, e.orden ORDER BY e.orden
      ) t
    ));
  END IF;

  IF 'tasa_ghosting' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('tasa_ghosting', jsonb_build_object(
      'valor', COALESCE((
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE e.tipo = 'ghosting')::numeric /
           NULLIF(COUNT(*)::numeric, 0)) * 100, 2
        )
        FROM ventas_lead_pipeline lp
        JOIN ventas_etapas e ON e.id = lp.etapa_id
        JOIN ventas_leads l ON l.id = lp.lead_id
        WHERE l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(l.id)
      ), 0),
      'anterior', NULL
    ));
  END IF;

  -- ── Goals ──
  IF 'objetivo_ventas_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('objetivo_ventas_mes', jsonb_build_object(
      'actual', COALESCE((
        SELECT COUNT(*)
        FROM ventas_ventas vv
        WHERE vv.estado = 'aprobada' AND vv.es_devolucion = false
          AND vv.fecha_venta >= date_trunc('month', CURRENT_DATE)::date
          AND (v_es_admin OR v_rol = 'director_ventas' OR vv.closer_id = p_usuario_id OR vv.setter_id = p_usuario_id)
      ), 0),
      'dias_restantes', (
        SELECT (date_trunc('month', CURRENT_DATE)::date + interval '1 month' - interval '1 day')::date - CURRENT_DATE
      )
    ));
  END IF;

  IF 'objetivo_leads_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('objetivo_leads_mes', jsonb_build_object(
      'actual', COALESCE((
        SELECT COUNT(*)
        FROM ventas_leads l
        WHERE l.created_at::date >= date_trunc('month', CURRENT_DATE)::date
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
          AND NOT ventas_lead_descartado(l.id)
      ), 0),
      'dias_restantes', (
        SELECT (date_trunc('month', CURRENT_DATE)::date + interval '1 month' - interval '1 day')::date - CURRENT_DATE
      )
    ));
  END IF;

  -- ── KPI: tasa_conversion ──
  IF 'tasa_conversion' = ANY(p_widgets) THEN
    DECLARE
      v_leads_count BIGINT;
      v_ventas_count BIGINT;
      v_leads_prev BIGINT;
      v_ventas_prev BIGINT;
    BEGIN
      SELECT COUNT(*) INTO v_leads_count
      FROM ventas_leads
      WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
        AND NOT ventas_lead_descartado(id);

      SELECT COUNT(*) INTO v_ventas_count
      FROM ventas_ventas
      WHERE estado = 'aprobada' AND es_devolucion = false
        AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id);

      SELECT COUNT(*) INTO v_leads_prev
      FROM ventas_leads
      WHERE created_at::date BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
        AND NOT ventas_lead_descartado(id);

      SELECT COUNT(*) INTO v_ventas_prev
      FROM ventas_ventas
      WHERE estado = 'aprobada' AND es_devolucion = false
        AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id);

      v_result := v_result || jsonb_build_object('tasa_conversion', jsonb_build_object(
        'valor', CASE WHEN v_leads_count > 0 THEN ROUND((v_ventas_count::numeric / v_leads_count::numeric) * 100, 1) ELSE 0 END,
        'anterior', CASE WHEN v_leads_prev > 0 THEN ROUND((v_ventas_prev::numeric / v_leads_prev::numeric) * 100, 1) ELSE 0 END
      ));
    END;
  END IF;

  -- ── KPI: citas_agendadas ──
  IF 'citas_agendadas' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('citas_agendadas', jsonb_build_object(
      'valor', COALESCE((
        SELECT COUNT(*)
        FROM ventas_citas ci
        WHERE ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND ci.estado = 'agendada'
          AND (v_es_admin OR v_rol = 'director_ventas' OR ci.closer_id = p_usuario_id OR ci.setter_origen_id = p_usuario_id)
      ), 0),
      'anterior', COALESCE((
        SELECT COUNT(*)
        FROM ventas_citas ci
        WHERE ci.fecha_hora::date BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
          AND ci.estado = 'agendada'
          AND (v_es_admin OR v_rol = 'director_ventas' OR ci.closer_id = p_usuario_id OR ci.setter_origen_id = p_usuario_id)
      ), 0)
    ));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- NEW WIDGETS: Desglose por Closer y Desglose por Setter
  -- ══════════════════════════════════════════════════════════════════════

  -- ── Desglose Closers (por fecha de llamada/cita) ──
  -- Columns: Agendas, Realizadas, Canceladas, No Show, Seguimientos, Nurturing, Lost,
  --          Tasa Global (ventas/agendas), Tasa Relativa (ventas/realizadas)
  IF 'desglose_closers' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('desglose_closers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT
          u.id as usuario_id,
          u.nombre,
          -- Agendas: total citas asignadas al closer en el periodo
          COALESCE(citas_data.agendas, 0) as agendas,
          -- Realizadas: citas con estado_reunion = 'Realizada'
          COALESCE(citas_data.realizadas, 0) as realizadas,
          -- Canceladas: citas con estado = 'cancelada' OR estado_reunion = 'Cancelada'
          COALESCE(citas_data.canceladas, 0) as canceladas,
          -- No Show: citas con estado_reunion = 'No Show'
          COALESCE(citas_data.no_show, 0) as no_show,
          -- Seguimientos: leads en etapa tipo 'seguimiento' del pipeline closers
          COALESCE(pipeline_data.seguimientos, 0) as seguimientos,
          -- Nurturing: leads en etapa 'Nurturing' del pipeline closers
          COALESCE(pipeline_data.nurturing, 0) as nurturing,
          -- Lost: leads en etapa tipo 'lost' del pipeline closers
          COALESCE(pipeline_data.lost, 0) as lost,
          -- Ventas
          COALESCE(ventas_data.ventas, 0) as ventas,
          -- Tasa Global: ventas / agendas * 100
          CASE WHEN COALESCE(citas_data.agendas, 0) > 0
            THEN ROUND((COALESCE(ventas_data.ventas, 0)::numeric / citas_data.agendas::numeric) * 100, 1)
            ELSE 0
          END as tasa_global,
          -- Tasa Relativa: ventas / realizadas * 100
          CASE WHEN COALESCE(citas_data.realizadas, 0) > 0
            THEN ROUND((COALESCE(ventas_data.ventas, 0)::numeric / citas_data.realizadas::numeric) * 100, 1)
            ELSE 0
          END as tasa_relativa
        FROM usuarios u
        JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'closer' AND rc.activo = true
        -- Subquery: citas breakdown
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) as agendas,
            COUNT(*) FILTER (WHERE re.nombre = 'Realizada') as realizadas,
            COUNT(*) FILTER (WHERE ci.estado = 'cancelada' OR re.nombre = 'Cancelada') as canceladas,
            COUNT(*) FILTER (WHERE re.nombre = 'No Show') as no_show
          FROM ventas_citas ci
          LEFT JOIN ventas_reunion_estados re ON re.id = ci.estado_reunion_id
          WHERE ci.closer_id = u.id
            AND ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
        ) citas_data ON true
        -- Subquery: pipeline stages for closer's leads
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE e.tipo = 'seguimiento') as seguimientos,
            COUNT(*) FILTER (WHERE e.nombre ILIKE '%nurturing%') as nurturing,
            COUNT(*) FILTER (WHERE e.tipo = 'lost') as lost
          FROM ventas_lead_pipeline lp
          JOIN ventas_etapas e ON e.id = lp.etapa_id
          JOIN ventas_pipelines pip ON pip.id = lp.pipeline_id
          JOIN ventas_leads l ON l.id = lp.lead_id
          WHERE pip.nombre ILIKE '%closer%'
            AND l.closer_asignado_id = u.id
            AND l.created_at::date <= p_fecha_fin
            AND NOT ventas_lead_descartado(l.id)
        ) pipeline_data ON true
        -- Subquery: ventas
        LEFT JOIN LATERAL (
          SELECT COUNT(*) as ventas
          FROM ventas_ventas vv
          WHERE vv.closer_id = u.id
            AND vv.estado = 'aprobada' AND vv.es_devolucion = false
            AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        ) ventas_data ON true
        ORDER BY COALESCE(citas_data.agendas, 0) DESC
      ) t
    ));
  END IF;

  -- ── Desglose Setters (por fecha de creacion del lead) ──
  -- Columns: Leads gestionados, Agendados, Ghosting, Seguimientos, Nurturing, Lost,
  --          Tasa Agenda (agendados/leads), Tasa Venta (ventas/leads)
  IF 'desglose_setters' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('desglose_setters', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT
          u.id as usuario_id,
          u.nombre,
          -- Leads gestionados: leads asignados creados en el periodo
          COALESCE(leads_data.total, 0) as leads_gestionados,
          -- Agendados: leads en etapa 'Agendado' o con cita creada
          COALESCE(leads_data.agendados, 0) as agendados,
          -- Ghosting: leads en etapa tipo 'ghosting'
          COALESCE(leads_data.ghosting, 0) as ghosting,
          -- Seguimientos: leads en etapa tipo 'seguimiento'
          COALESCE(leads_data.seguimientos, 0) as seguimientos,
          -- Nurturing: leads en etapa 'Nurturing'
          COALESCE(leads_data.nurturing, 0) as nurturing,
          -- Lost: leads en etapa tipo 'lost'
          COALESCE(leads_data.lost, 0) as lost,
          -- Ventas del setter
          COALESCE(ventas_data.ventas, 0) as ventas,
          -- Tasa Agenda: agendados / leads * 100
          CASE WHEN COALESCE(leads_data.total, 0) > 0
            THEN ROUND((COALESCE(leads_data.agendados, 0)::numeric / leads_data.total::numeric) * 100, 1)
            ELSE 0
          END as tasa_agenda,
          -- Tasa Venta: ventas / leads * 100
          CASE WHEN COALESCE(leads_data.total, 0) > 0
            THEN ROUND((COALESCE(ventas_data.ventas, 0)::numeric / leads_data.total::numeric) * 100, 1)
            ELSE 0
          END as tasa_venta
        FROM usuarios u
        JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'setter' AND rc.activo = true
        -- Subquery: leads breakdown from setter pipeline
        LEFT JOIN LATERAL (
          SELECT
            COUNT(DISTINCT l.id) as total,
            COUNT(DISTINCT l.id) FILTER (WHERE e.nombre ILIKE '%agendad%' OR e.tipo = 'cita_realizada' OR e.tipo = 'venta') as agendados,
            COUNT(DISTINCT l.id) FILTER (WHERE e.tipo = 'ghosting') as ghosting,
            COUNT(DISTINCT l.id) FILTER (WHERE e.tipo = 'seguimiento') as seguimientos,
            COUNT(DISTINCT l.id) FILTER (WHERE e.nombre ILIKE '%nurturing%') as nurturing,
            COUNT(DISTINCT l.id) FILTER (WHERE e.tipo = 'lost') as lost
          FROM ventas_leads l
          JOIN ventas_lead_pipeline lp ON lp.lead_id = l.id
          JOIN ventas_etapas e ON e.id = lp.etapa_id
          JOIN ventas_pipelines pip ON pip.id = lp.pipeline_id
          WHERE pip.nombre ILIKE '%setter%'
            AND l.setter_asignado_id = u.id
            AND l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
            AND NOT ventas_lead_descartado(l.id)
        ) leads_data ON true
        -- Subquery: ventas
        LEFT JOIN LATERAL (
          SELECT COUNT(*) as ventas
          FROM ventas_ventas vv
          WHERE vv.setter_id = u.id
            AND vv.estado = 'aprobada' AND vv.es_devolucion = false
            AND vv.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        ) ventas_data ON true
        ORDER BY COALESCE(leads_data.total, 0) DESC
      ) t
    ));
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
