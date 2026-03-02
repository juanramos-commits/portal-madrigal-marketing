-- ==========================================================================
-- DASHBOARD WIDGETS — Tabla de layouts + RPC multiplexado
-- ==========================================================================

-- ═══ Tabla: dashboard_layouts ═══
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_dashboard_layouts_usuario UNIQUE (usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_dl_usuario ON dashboard_layouts(usuario_id);

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY dl_select ON dashboard_layouts FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY dl_insert ON dashboard_layouts FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY dl_update ON dashboard_layouts FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- ═══ RPC: ventas_dashboard_widget_data ═══
-- Multiplexed RPC — receives array of widget dataKeys, returns JSONB with each
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

  -- ── KPI: total_leads ──
  IF 'total_leads' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('total_leads', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin)
    ));
  END IF;

  -- ── KPI: leads_hoy ──
  IF 'leads_hoy' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_hoy', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date = CURRENT_DATE),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date = CURRENT_DATE - 1)
    ));
  END IF;

  -- ── KPI: leads_esta_semana ──
  IF 'leads_esta_semana' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_esta_semana', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= date_trunc('week', CURRENT_DATE)::date),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= (date_trunc('week', CURRENT_DATE) - interval '7 days')::date AND created_at::date < date_trunc('week', CURRENT_DATE)::date)
    ));
  END IF;

  -- ── KPI: leads_este_mes ──
  IF 'leads_este_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('leads_este_mes', jsonb_build_object(
      'valor', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date),
      'anterior', (SELECT COUNT(*) FROM ventas_leads WHERE created_at::date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AND created_at::date < date_trunc('month', CURRENT_DATE)::date)
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
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)),
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
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)), 0)
    ));
  END IF;

  -- ── KPI: ingresos_mes ──
  IF 'ingresos_mes' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ingresos_mes', jsonb_build_object(
      'valor', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta >= date_trunc('month', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT SUM(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false
        AND fecha_venta >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AND fecha_venta < date_trunc('month', CURRENT_DATE)::date
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)), 0)
    ));
  END IF;

  -- ── KPI: ticket_medio ──
  IF 'ticket_medio' = ANY(p_widgets) THEN
    v_result := v_result || jsonb_build_object('ticket_medio', jsonb_build_object(
      'valor', COALESCE((SELECT AVG(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN p_fecha_inicio AND p_fecha_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)), 0),
      'anterior', COALESCE((SELECT AVG(importe) FROM ventas_ventas WHERE estado = 'aprobada' AND es_devolucion = false AND fecha_venta BETWEEN v_fecha_prev_inicio AND v_fecha_prev_fin
        AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)), 0)
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
          AND (v_es_admin OR v_rol = 'director_ventas' OR closer_id = p_usuario_id)
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

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ventas_dashboard_widget_data(UUID, DATE, DATE, TEXT[]) TO authenticated;
