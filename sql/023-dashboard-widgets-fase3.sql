-- ==========================================================================
-- DASHBOARD WIDGETS FASE 3 — Añade 2 KPIs: tasa_conversion, citas_agendadas
-- Total: 49 branches (47 anteriores + 2 nuevos)
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

  -- ══════════════════════════════════════════════════════════════════════════
  -- ORIGINAL 14 BRANCHES
  -- ══════════════════════════════════════════════════════════════════════════

  -- ── KPI: total_leads ──
  IF 'total_leads' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_leads', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id))
    ));
  END IF;

  -- ── KPI: leads_hoy ──
  IF 'leads_hoy' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_hoy', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date = CURRENT_DATE
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date = CURRENT_DATE - 1
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id))
    ));
  END IF;

  -- ── KPI: leads_esta_semana ──
  IF 'leads_esta_semana' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_esta_semana', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= date_trunc('week', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= (date_trunc('week', CURRENT_DATE) - interval '7 days')::date AND created_at::date < date_trunc('week', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id))
    ));
  END IF;

  -- ── KPI: leads_este_mes ──
  IF 'leads_este_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_este_mes', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AND created_at::date < date_trunc('month', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id))
    ));
  END IF;

  -- ── KPI: total_ventas ──
  IF 'total_ventas' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_ventas', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)),
      'anterior', (SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id))
    ));
  END IF;

  -- ── KPI: ventas_pendientes ──
  IF 'ventas_pendientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_pendientes', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'pendiente'
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)),
      'anterior', NULL
    ));
  END IF;

  -- ── KPI: ventas_aprobadas ──
  IF 'ventas_aprobadas' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_aprobadas', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)),
      'anterior', (SELECT COUNT(*) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id))
    ));
  END IF;

  -- ── KPI: ingresos_totales ──
  IF 'ingresos_totales' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_totales', jsonb_build_object(
      'valor', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  -- ── KPI: ingresos_mes ──
  IF 'ingresos_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_mes', jsonb_build_object(
      'valor', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta >= date_trunc('month', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false
        AND fecha_venta >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AND fecha_venta < date_trunc('month', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  -- ── KPI: ticket_medio ──
  IF 'ticket_medio' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ticket_medio', jsonb_build_object(
      'valor', COALESCE((SELECT AVG(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT AVG(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)), 0)
    ));
  END IF;

  -- ── Chart: leads_por_dia ──
  IF 'leads_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT created_at::date as fecha, COUNT(*) as total
        FROM ventas_leads
        WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
        GROUP BY created_at::date
        ORDER BY fecha
      ) t
    ));
  END IF;

  -- ── Chart: ventas_por_dia ──
  IF 'ventas_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT fecha_venta as fecha, COUNT(*) as total, SUM(importe) as importe
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY fecha_venta
        ORDER BY fecha
      ) t
    ));
  END IF;

  -- ── Table: leads_recientes ──
  IF 'leads_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT l.id, l.nombre, l.email, l.telefono, l.nombre_negocio, l.fuente, l.created_at,
          s.nombre as setter_nombre, c.nombre as closer_nombre
        FROM ventas_leads l
        LEFT JOIN usuarios s ON s.id = l.setter_asignado_id
        LEFT JOIN usuarios c ON c.id = l.closer_asignado_id
        WHERE (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
        ORDER BY l.created_at DESC
        LIMIT 10
      ) t
    ));
  END IF;

  -- ── Table: ventas_recientes ──
  IF 'ventas_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT v.id, v.importe, v.estado, v.metodo_pago, v.fecha_venta, v.created_at,
          l.nombre as lead_nombre, l.nombre_negocio,
          cl.nombre as closer_nombre, st.nombre as setter_nombre,
          p.nombre as paquete_nombre
        FROM ventas_ventas v
        LEFT JOIN ventas_leads l ON l.id = v.lead_id
        LEFT JOIN usuarios cl ON cl.id = v.closer_id
        LEFT JOIN usuarios st ON st.id = v.setter_id
        LEFT JOIN ventas_paquetes p ON p.id = v.paquete_id
        WHERE (v_es_admin OR v_rol = 'director_ventas' OR v.closer_id = p_usuario_id OR v.setter_id = p_usuario_id)
        ORDER BY v.created_at DESC
        LIMIT 10
      ) t
    ));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- FASE 2: 33 BRANCHES
  -- ══════════════════════════════════════════════════════════════════════════

  -- ────────────────────────────────────────────────────────────────────────
  -- WALLET KPIs (6)
  -- ────────────────────────────────────────────────────────────────────────

  -- ── KPI: mi_saldo ──
  IF 'mi_saldo' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('mi_saldo', jsonb_build_object(
      'valor', COALESCE((SELECT w.saldo FROM ventas_wallet w WHERE w.usuario_id = p_usuario_id), 0),
      'anterior', NULL
    ));
  END IF;

  -- ── KPI: mi_saldo_disponible ──
  IF 'mi_saldo_disponible' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('mi_saldo_disponible', jsonb_build_object(
      'valor', COALESCE(ventas_obtener_saldo_disponible(p_usuario_id), 0),
      'anterior', NULL
    ));
  END IF;

  -- ── KPI: total_ganado ──
  IF 'total_ganado' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_ganado', jsonb_build_object(
      'valor', COALESCE((SELECT w.total_ganado FROM ventas_wallet w WHERE w.usuario_id = p_usuario_id), 0),
      'anterior', NULL
    ));
  END IF;

  -- ── KPI: total_retirado ──
  IF 'total_retirado' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_retirado', jsonb_build_object(
      'valor', COALESCE((SELECT w.total_retirado FROM ventas_wallet w WHERE w.usuario_id = p_usuario_id), 0),
      'anterior', NULL
    ));
  END IF;

  -- ── KPI: comisiones_pendientes ──
  IF 'comisiones_pendientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('comisiones_pendientes', jsonb_build_object(
      'valor', COALESCE((SELECT SUM(c.monto) FROM ventas_comisiones c WHERE c.usuario_id = p_usuario_id AND c.disponible_desde > now()), 0),
      'anterior', NULL
    ));
  END IF;

  -- ── KPI: retiros_pendientes ──
  IF 'retiros_pendientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('retiros_pendientes', jsonb_build_object(
      'valor', COALESCE((
        SELECT SUM(r.monto) FROM ventas_retiros r
        WHERE r.estado = 'pendiente'
          AND (v_es_admin OR v_rol = 'director_ventas' OR r.usuario_id = p_usuario_id)
      ), 0),
      'anterior', NULL
    ));
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- CHARTS TIME-SERIES (6)
  -- ────────────────────────────────────────────────────────────────────────

  -- ── Chart: leads_por_semana ──
  IF 'leads_por_semana' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_semana', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('week', created_at)::date as fecha, COUNT(*) as total
        FROM ventas_leads
        WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
        GROUP BY date_trunc('week', created_at)::date
        ORDER BY fecha
      ) t
    ));
  END IF;

  -- ── Chart: ventas_por_mes ──
  IF 'ventas_por_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('month', fecha_venta)::date as fecha, COUNT(*) as total, SUM(importe) as importe
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY date_trunc('month', fecha_venta)::date
        ORDER BY fecha
      ) t
    ));
  END IF;

  -- ── Chart: ingresos_por_dia ──
  IF 'ingresos_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT fecha_venta as fecha, SUM(importe) as total
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY fecha_venta
        ORDER BY fecha
      ) t
    ));
  END IF;

  -- ── Chart: ingresos_por_mes ──
  IF 'ingresos_por_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('month', fecha_venta)::date as fecha, SUM(importe) as total
        FROM ventas_ventas
        WHERE estado = 'aprobada' AND es_devolucion = false
          AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
        GROUP BY date_trunc('month', fecha_venta)::date
        ORDER BY fecha
      ) t
    ));
  END IF;

  -- ── Chart: comisiones_por_mes ──
  IF 'comisiones_por_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('comisiones_por_mes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT date_trunc('month', c.created_at)::date as fecha, SUM(c.monto) as total
        FROM ventas_comisiones c
        WHERE c.usuario_id = p_usuario_id
          AND c.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY date_trunc('month', c.created_at)::date
        ORDER BY fecha
      ) t
    ));
  END IF;

  -- ── Chart: conversion_por_dia ──
  IF 'conversion_por_dia' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('conversion_por_dia', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha), '[]'::jsonb)
      FROM (
        SELECT
          d.fecha,
          COALESCE(le.total, 0) as leads,
          COALESCE(ve.total, 0) as ventas,
          CASE WHEN COALESCE(le.total, 0) > 0
            THEN ROUND((COALESCE(ve.total, 0)::numeric / le.total::numeric) * 100, 2)
            ELSE 0
          END as tasa
        FROM generate_series(p_fecha_inicio, p_fecha_fin, '1 day'::interval) d(fecha)
        LEFT JOIN (
          SELECT created_at::date as fecha, COUNT(*) as total
          FROM ventas_leads
          WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
            AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id)
          GROUP BY created_at::date
        ) le ON le.fecha = d.fecha::date
        LEFT JOIN (
          SELECT fecha_venta as fecha, COUNT(*) as total
          FROM ventas_ventas
          WHERE estado = 'aprobada' AND es_devolucion = false
            AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
            AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id)
          GROUP BY fecha_venta
        ) ve ON ve.fecha = d.fecha::date
        ORDER BY d.fecha
      ) t
    ));
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- DISTRIBUTION (6)
  -- ────────────────────────────────────────────────────────────────────────

  -- ── Distribution: leads_por_fuente ──
  IF 'leads_por_fuente' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_fuente', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(l.fuente, 'Sin fuente') as nombre, COUNT(*) as valor
        FROM ventas_leads l
        WHERE l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
        GROUP BY l.fuente
        ORDER BY valor DESC
      ) t
    ));
  END IF;

  -- ── Distribution: leads_por_categoria ──
  IF 'leads_por_categoria' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_categoria', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(c.nombre, 'Sin categoria') as nombre, COUNT(*) as valor
        FROM ventas_leads l
        LEFT JOIN ventas_categorias c ON c.id = l.categoria_id
        WHERE l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
        GROUP BY c.nombre
        ORDER BY valor DESC
      ) t
    ));
  END IF;

  -- ── Distribution: ventas_por_paquete ──
  IF 'ventas_por_paquete' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_paquete', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(p.nombre, 'Sin paquete') as nombre, COUNT(*) as valor, COALESCE(SUM(v.importe), 0) as importe
        FROM ventas_ventas v
        LEFT JOIN ventas_paquetes p ON p.id = v.paquete_id
        WHERE v.estado = 'aprobada' AND v.es_devolucion = false
          AND v.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v.closer_id = p_usuario_id OR v.setter_id = p_usuario_id)
        GROUP BY p.nombre
        ORDER BY valor DESC
      ) t
    ));
  END IF;

  -- ── Distribution: ventas_por_metodo_pago ──
  IF 'ventas_por_metodo_pago' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_metodo_pago', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT COALESCE(v.metodo_pago, 'Sin metodo') as nombre, COUNT(*) as valor, COALESCE(SUM(v.importe), 0) as importe
        FROM ventas_ventas v
        WHERE v.estado = 'aprobada' AND v.es_devolucion = false
          AND v.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v.closer_id = p_usuario_id OR v.setter_id = p_usuario_id)
        GROUP BY v.metodo_pago
        ORDER BY valor DESC
      ) t
    ));
  END IF;

  -- ── Distribution: leads_por_etapa ──
  IF 'leads_por_etapa' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_por_etapa', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT e.nombre, COUNT(lp.id) as valor, e.color
        FROM ventas_lead_pipeline lp
        JOIN ventas_etapas e ON e.id = lp.etapa_id
        JOIN ventas_leads l ON l.id = lp.lead_id
        WHERE e.activo = true
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
        GROUP BY e.nombre, e.color, e.orden
        ORDER BY e.orden
      ) t
    ));
  END IF;

  -- ── Distribution: ventas_por_estado ──
  IF 'ventas_por_estado' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ventas_por_estado', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT v.estado as nombre, COUNT(*) as valor, COALESCE(SUM(v.importe), 0) as importe
        FROM ventas_ventas v
        WHERE v.fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v.closer_id = p_usuario_id OR v.setter_id = p_usuario_id)
        GROUP BY v.estado
        ORDER BY valor DESC
      ) t
    ));
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- TABLES (4)
  -- ────────────────────────────────────────────────────────────────────────

  -- ── Table: comisiones_recientes ──
  IF 'comisiones_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('comisiones_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT c.id, c.monto, c.concepto, c.rol, c.es_bonus, c.disponible_desde, c.created_at,
          COALESCE(l.nombre, 'N/A') as lead_nombre
        FROM ventas_comisiones c
        LEFT JOIN ventas_ventas v ON v.id = c.venta_id
        LEFT JOIN ventas_leads l ON l.id = v.lead_id
        WHERE c.usuario_id = p_usuario_id
        ORDER BY c.created_at DESC
        LIMIT 10
      ) t
    ));
  END IF;

  -- ── Table: retiros_recientes ──
  IF 'retiros_recientes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('retiros_recientes', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT r.id, r.monto, r.estado, r.created_at, r.fecha_aprobacion
        FROM ventas_retiros r
        WHERE r.usuario_id = p_usuario_id
        ORDER BY r.created_at DESC
        LIMIT 10
      ) t
    ));
  END IF;

  -- ── Table: leads_sin_contactar ──
  IF 'leads_sin_contactar' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_sin_contactar', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT l.id, l.nombre, l.telefono, l.nombre_negocio, l.fuente, l.created_at
        FROM ventas_leads l
        JOIN ventas_lead_pipeline lp ON lp.lead_id = l.id
        JOIN ventas_etapas e ON e.id = lp.etapa_id
        WHERE e.nombre ILIKE '%por contactar%'
          AND l.created_at < now() - interval '48 hours'
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
        ORDER BY l.created_at ASC
        LIMIT 20
      ) t
    ));
  END IF;

  -- ── Table: citas_proximas ──
  IF 'citas_proximas' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('citas_proximas', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT ci.id, ci.fecha_hora, ci.duracion_minutos,
          COALESCE(l.nombre, 'N/A') as lead_nombre,
          COALESCE(l.nombre_negocio, '') as nombre_negocio,
          COALESCE(cl.nombre, '') as closer_nombre,
          COALESCE(st.nombre, '') as setter_nombre,
          ci.google_meet_url as meet_link
        FROM ventas_citas ci
        LEFT JOIN ventas_leads l ON l.id = ci.lead_id
        LEFT JOIN usuarios cl ON cl.id = ci.closer_id
        LEFT JOIN usuarios st ON st.id = ci.setter_origen_id
        WHERE ci.fecha_hora >= now()
          AND ci.estado = 'agendada'
          AND (v_es_admin OR v_rol = 'director_ventas' OR ci.closer_id = p_usuario_id OR ci.setter_origen_id = p_usuario_id)
        ORDER BY ci.fecha_hora ASC
        LIMIT 10
      ) t
    ));
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- TEAM (5)
  -- ────────────────────────────────────────────────────────────────────────

  -- ── Team: ranking_closers ──
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

  -- ── Team: ranking_setters ──
  IF 'ranking_setters' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ranking_setters', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT u.nombre, u.email,
          COALESCE(COUNT(DISTINCT ci.id), 0) as citas,
          COALESCE(COUNT(DISTINCT l.id), 0) as leads_asignados
        FROM usuarios u
        JOIN ventas_roles_comerciales rc ON rc.usuario_id = u.id AND rc.rol = 'setter' AND rc.activo = true
        LEFT JOIN ventas_citas ci ON ci.setter_origen_id = u.id
          AND ci.fecha_hora::date BETWEEN p_fecha_inicio AND p_fecha_fin
        LEFT JOIN ventas_leads l ON l.setter_asignado_id = u.id
          AND l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY u.id, u.nombre, u.email
        ORDER BY citas DESC
      ) t
    ));
  END IF;

  -- ── Team: actividad_reciente ──
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

  -- ── Team: conversion_por_closer ──
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

  -- ── Team: conversion_por_setter ──
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
          SELECT l.setter_asignado_id, COUNT(*) as total
          FROM ventas_leads l
          WHERE l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          GROUP BY l.setter_asignado_id
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

  -- ────────────────────────────────────────────────────────────────────────
  -- FUNNEL (4)
  -- ────────────────────────────────────────────────────────────────────────

  -- ── Funnel: funnel_setters ──
  IF 'funnel_setters' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('funnel_setters', jsonb_build_object(
      'leads', COALESCE((
        SELECT COUNT(*)
        FROM ventas_leads l
        WHERE l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'setter' AND l.setter_asignado_id = p_usuario_id)
      ), 0),
      'contactados', COALESCE((
        SELECT COUNT(DISTINCT lp.lead_id)
        FROM ventas_lead_pipeline lp
        JOIN ventas_etapas e ON e.id = lp.etapa_id
        JOIN ventas_pipelines pip ON pip.id = lp.pipeline_id
        JOIN ventas_leads l ON l.id = lp.lead_id
        WHERE pip.id = (SELECT id FROM ventas_pipelines WHERE nombre ILIKE '%setter%' LIMIT 1)
          AND e.nombre NOT ILIKE '%por contactar%'
          AND l.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
          AND (v_es_admin OR v_rol = 'director_ventas' OR v_rol = 'setter' AND l.setter_asignado_id = p_usuario_id)
      ), 0),
      'citas', COALESCE((
        SELECT COUNT(*)
        FROM ventas_citas ci
        JOIN ventas_leads l ON l.id = ci.lead_id
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

  -- ── Funnel: funnel_closers ──
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

  -- ── Funnel: pipeline_resumen ──
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
        GROUP BY e.id, e.nombre, e.color, e.orden
        ORDER BY e.orden
      ) t
    ));
  END IF;

  -- ── Funnel: tasa_ghosting ──
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
      ), 0),
      'anterior', NULL
    ));
  END IF;

  -- ────────────────────────────────────────────────────────────────────────
  -- GOALS (2)
  -- ────────────────────────────────────────────────────────────────────────

  -- ── Goal: objetivo_ventas_mes ──
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

  -- ── Goal: objetivo_leads_mes ──
  IF 'objetivo_leads_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('objetivo_leads_mes', jsonb_build_object(
      'actual', COALESCE((
        SELECT COUNT(*)
        FROM ventas_leads l
        WHERE l.created_at::date >= date_trunc('month', CURRENT_DATE)::date
          AND (v_es_admin OR v_rol = 'director_ventas' OR l.setter_asignado_id = p_usuario_id OR l.closer_asignado_id = p_usuario_id)
      ), 0),
      'dias_restantes', (
        SELECT (date_trunc('month', CURRENT_DATE)::date + interval '1 month' - interval '1 day')::date - CURRENT_DATE
      )
    ));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- FASE 3: 2 NEW BRANCHES
  -- ══════════════════════════════════════════════════════════════════════════

  -- ── KPI: tasa_conversion (leads → ventas aprobadas en periodo) ──
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
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id);

      SELECT COUNT(*) INTO v_ventas_count
      FROM ventas_ventas
      WHERE estado = 'aprobada' AND es_devolucion = false
        AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id OR setter_id = p_usuario_id);

      SELECT COUNT(*) INTO v_leads_prev
      FROM ventas_leads
      WHERE created_at::date BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR setter_asignado_id = p_usuario_id OR closer_asignado_id = p_usuario_id);

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

  -- ── KPI: citas_agendadas (citas en periodo) ──
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

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ventas_dashboard_widget_data(UUID, DATE, DATE, TEXT[]) TO authenticated;
