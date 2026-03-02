-- ============================================================================
-- ventas_revertir_rechazo: Rechazada → Pendiente
-- ventas_revertir_devolucion: Devolución → Aprobada (restaura comisiones)
-- ============================================================================

-- Revertir rechazo: pone la venta de vuelta a pendiente
CREATE OR REPLACE FUNCTION ventas_revertir_rechazo(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede revertir rechazos');
    END IF;

    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;
    IF v_venta.estado != 'rechazada' OR v_venta.es_devolucion = true THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La venta no está en estado rechazada');
    END IF;

    UPDATE ventas_ventas
    SET estado = 'pendiente',
        fecha_rechazo = NULL,
        updated_at = NOW()
    WHERE id = p_venta_id;

    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Rechazo revertido - venta vuelve a pendiente',
            jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ventas_revertir_rechazo TO authenticated;

-- Revertir devolución: restaura a aprobada y regenera comisiones
CREATE OR REPLACE FUNCTION ventas_revertir_devolucion(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_comision RECORD;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede revertir devoluciones');
    END IF;

    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;
    IF v_venta.es_devolucion = false THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La venta no es una devolución');
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;

    UPDATE ventas_ventas
    SET es_devolucion = false,
        fecha_devolucion = NULL,
        estado = 'aprobada',
        updated_at = NOW()
    WHERE id = p_venta_id;

    -- Revertir comisiones negativas de devolución
    FOR v_comision IN
        SELECT * FROM ventas_comisiones
        WHERE venta_id = p_venta_id AND monto < 0
          AND concepto LIKE 'Devolución%'
    LOOP
        INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
        VALUES (p_venta_id, v_comision.usuario_id, v_comision.rol, -v_comision.monto,
                'Reversión devolución - ' || COALESCE(v_lead_nombre, 'Lead'), now());

        UPDATE ventas_wallet
        SET saldo = saldo + (-v_comision.monto),
            total_ganado = total_ganado + (-v_comision.monto)
        WHERE usuario_id = v_comision.usuario_id;
    END LOOP;

    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Devolución revertida - venta restaurada a aprobada',
            jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ventas_revertir_devolucion TO authenticated;
