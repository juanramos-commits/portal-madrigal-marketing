-- ============================================================================
-- 043 - URGENTE: Restaurar ventas_aprobar_venta con lógica original + fix pendiente
-- La migración 042 rompió la función usando columnas que no existen
-- ============================================================================

-- ─── 1. Restaurar ventas_aprobar_venta (original de 009 + guard pendiente) ───
CREATE OR REPLACE FUNCTION ventas_aprobar_venta(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_config RECORD;
    v_comision DECIMAL;
    v_disponible_desde TIMESTAMPTZ;
    v_director RECORD;
BEGIN
    -- Verificar que el usuario es super_admin
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede aprobar ventas');
    END IF;

    -- Obtener datos de la venta
    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;

    -- FIXED: Solo aprobar desde pendiente (antes permitía re-aprobar rechazadas)
    IF v_venta.estado != 'pendiente' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo se pueden aprobar ventas en estado pendiente (actual: ' || v_venta.estado || ')');
    END IF;

    -- Nombre del lead para concepto
    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;
    v_disponible_desde := v_venta.fecha_venta::timestamptz + interval '48 hours';

    -- Actualizar estado
    UPDATE ventas_ventas
    SET estado = 'aprobada',
        aprobada_por_id = auth.uid()::uuid,
        fecha_aprobacion = now()
    WHERE id = p_venta_id;

    -- Comisión al closer
    IF v_venta.closer_id IS NOT NULL THEN
        SELECT * INTO v_config FROM ventas_comisiones_config WHERE rol = 'closer' AND activo = true LIMIT 1;
        IF v_config IS NOT NULL AND v_config.comision_fija > 0 THEN
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_venta.closer_id, 'closer', v_config.comision_fija,
                    'Comisión cierre - ' || COALESCE(v_lead_nombre, 'Lead'), v_disponible_desde);

            UPDATE ventas_wallet SET saldo = saldo + v_config.comision_fija, total_ganado = total_ganado + v_config.comision_fija
            WHERE usuario_id = v_venta.closer_id;

            -- Bonus pago único
            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_venta.closer_id, 'closer', v_config.bonus_pago_unico,
                        'Bonus pago único - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);

                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_venta.closer_id;
            END IF;

            -- Notificación al closer
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.closer_id, 'venta_aprobada', 'Venta aprobada',
                    'Tu venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido aprobada',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
    END IF;

    -- Comisión al setter
    IF v_venta.setter_id IS NOT NULL THEN
        SELECT * INTO v_config FROM ventas_comisiones_config WHERE rol = 'setter' AND activo = true LIMIT 1;
        IF v_config IS NOT NULL AND v_config.comision_fija > 0 THEN
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_venta.setter_id, 'setter', v_config.comision_fija,
                    'Comisión setter - ' || COALESCE(v_lead_nombre, 'Lead'), v_disponible_desde);

            UPDATE ventas_wallet SET saldo = saldo + v_config.comision_fija, total_ganado = total_ganado + v_config.comision_fija
            WHERE usuario_id = v_venta.setter_id;

            -- Bonus pago único para setter
            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_venta.setter_id, 'setter', v_config.bonus_pago_unico,
                        'Bonus pago único - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);

                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_venta.setter_id;
            END IF;

            -- Notificación al setter
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.setter_id, 'venta_aprobada', 'Venta aprobada',
                    'Tu lead ' || COALESCE(v_lead_nombre, 'Lead') || ' ha cerrado venta',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
    END IF;

    -- Comisión al director de ventas (todos los activos)
    SELECT * INTO v_config FROM ventas_comisiones_config WHERE rol = 'director_ventas' AND activo = true LIMIT 1;
    IF v_config IS NOT NULL AND v_config.comision_fija > 0 THEN
        FOR v_director IN
            SELECT usuario_id FROM ventas_roles_comerciales
            WHERE rol = 'director_ventas' AND activo = true
        LOOP
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_director.usuario_id, 'director_ventas', v_config.comision_fija,
                    'Comisión dirección - ' || COALESCE(v_lead_nombre, 'Lead'), v_disponible_desde);

            UPDATE ventas_wallet SET saldo = saldo + v_config.comision_fija, total_ganado = total_ganado + v_config.comision_fija
            WHERE usuario_id = v_director.usuario_id;

            -- Bonus pago único para director
            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_director.usuario_id, 'director_ventas', v_config.bonus_pago_unico,
                        'Bonus pago único dirección - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);

                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_director.usuario_id;
            END IF;
        END LOOP;
    END IF;

    -- Registrar actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Venta aprobada por ' || v_venta.importe || '€',
            jsonb_build_object('venta_id', p_venta_id, 'importe', v_venta.importe));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 2. Restaurar ventas_rechazar_venta (original, ya era correcta) ──────────
-- La original permite rechazar ventas aprobadas (revierte comisiones), lo cual es correcto.
CREATE OR REPLACE FUNCTION ventas_rechazar_venta(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_comision RECORD;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede rechazar ventas');
    END IF;

    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;

    -- FIXED: No rechazar lo que ya está rechazado
    IF v_venta.estado = 'rechazada' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La venta ya está rechazada');
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;

    -- Si estaba aprobada → revertir comisiones
    IF v_venta.estado = 'aprobada' THEN
        FOR v_comision IN
            SELECT * FROM ventas_comisiones WHERE venta_id = p_venta_id AND monto > 0
        LOOP
            -- Crear comisión negativa
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_comision.usuario_id, v_comision.rol, -v_comision.monto,
                    'Rechazo - ' || COALESCE(v_lead_nombre, 'Lead'), now());

            -- Actualizar wallet
            UPDATE ventas_wallet
            SET saldo = saldo - v_comision.monto,
                total_descontado = total_descontado + v_comision.monto
            WHERE usuario_id = v_comision.usuario_id;
        END LOOP;
    END IF;

    -- Actualizar estado
    UPDATE ventas_ventas
    SET estado = 'rechazada', fecha_rechazo = now()
    WHERE id = p_venta_id;

    -- Notificaciones
    IF v_venta.closer_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.closer_id, 'venta_rechazada', 'Venta rechazada',
                'La venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido rechazada',
                jsonb_build_object('venta_id', p_venta_id));
    END IF;
    IF v_venta.setter_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.setter_id, 'venta_rechazada', 'Venta rechazada',
                'La venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido rechazada',
                jsonb_build_object('venta_id', p_venta_id));
    END IF;

    -- Actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta_rechazada',
            'Venta rechazada', jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
