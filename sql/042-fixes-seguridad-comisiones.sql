-- ============================================================================
-- 042 - Fixes: seguridad RLS google_events + comisiones dobles
-- ============================================================================

-- ─── 1. Fix ventas_google_events RLS — remove over-permissive write policies ──
-- Service role bypasses RLS, so authenticated users don't need write access.

DROP POLICY IF EXISTS vge_insert ON ventas_google_events;
DROP POLICY IF EXISTS vge_update ON ventas_google_events;
DROP POLICY IF EXISTS vge_delete ON ventas_google_events;

-- Only allow admins to write (edge functions use service_role which bypasses RLS)
CREATE POLICY vge_insert ON ventas_google_events FOR INSERT
  WITH CHECK (ventas_es_admin_o_director());

CREATE POLICY vge_update ON ventas_google_events FOR UPDATE
  USING (ventas_es_admin_o_director());

CREATE POLICY vge_delete ON ventas_google_events FOR DELETE
  USING (ventas_es_admin_o_director());


-- ─── 2. Fix ventas_aprobar_venta — only approve from 'pendiente' ─────────────
-- Prevents double-commission bug when re-approving a rejected sale.

CREATE OR REPLACE FUNCTION ventas_aprobar_venta(p_venta_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta RECORD;
  v_comision_setter NUMERIC;
  v_comision_closer NUMERIC;
BEGIN
  SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
  END IF;

  IF v_venta.estado != 'pendiente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo se pueden aprobar ventas en estado pendiente (actual: ' || v_venta.estado || ')');
  END IF;

  -- Calculate commissions
  v_comision_setter := v_venta.importe * COALESCE(v_venta.porcentaje_setter, 0) / 100;
  v_comision_closer := v_venta.importe * COALESCE(v_venta.porcentaje_closer, 0) / 100;

  -- Update venta status
  UPDATE ventas_ventas SET
    estado = 'aprobada',
    fecha_aprobacion = NOW(),
    aprobado_por = auth.uid()
  WHERE id = p_venta_id;

  -- Create commissions for setter
  IF v_venta.setter_id IS NOT NULL AND v_comision_setter > 0 THEN
    INSERT INTO ventas_comisiones (usuario_id, venta_id, tipo, monto, disponible_desde)
    VALUES (v_venta.setter_id, p_venta_id, 'setter', v_comision_setter, NOW() + INTERVAL '48 hours');

    UPDATE ventas_wallet SET
      saldo = saldo + v_comision_setter,
      total_ganado = total_ganado + v_comision_setter,
      updated_at = NOW()
    WHERE usuario_id = v_venta.setter_id;
  END IF;

  -- Create commissions for closer
  IF v_venta.closer_id IS NOT NULL AND v_comision_closer > 0 THEN
    INSERT INTO ventas_comisiones (usuario_id, venta_id, tipo, monto, disponible_desde)
    VALUES (v_venta.closer_id, p_venta_id, 'closer', v_comision_closer, NOW() + INTERVAL '48 hours');

    UPDATE ventas_wallet SET
      saldo = saldo + v_comision_closer,
      total_ganado = total_ganado + v_comision_closer,
      updated_at = NOW()
    WHERE usuario_id = v_venta.closer_id;
  END IF;

  -- Handle devolucion (subtract from provider's wallet)
  IF v_venta.es_devolucion = true AND v_venta.closer_id IS NOT NULL THEN
    UPDATE ventas_wallet SET
      saldo = saldo - v_venta.importe,
      updated_at = NOW()
    WHERE usuario_id = v_venta.closer_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'comision_setter', v_comision_setter, 'comision_closer', v_comision_closer);
END;
$$;


-- ─── 3. Fix ventas_rechazar_venta — only reject from 'pendiente' ─────────────

CREATE OR REPLACE FUNCTION ventas_rechazar_venta(p_venta_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta RECORD;
BEGIN
  SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
  END IF;

  IF v_venta.estado != 'pendiente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo se pueden rechazar ventas en estado pendiente (actual: ' || v_venta.estado || ')');
  END IF;

  UPDATE ventas_ventas SET
    estado = 'rechazada',
    motivo_rechazo = p_motivo,
    aprobado_por = auth.uid()
  WHERE id = p_venta_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
