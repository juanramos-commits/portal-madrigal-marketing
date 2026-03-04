-- ============================================================================
-- 038 - Proteger notificaciones en funciones RPC con EXCEPTION
-- Una notificación fallida NUNCA debe bloquear comisiones, wallet o ventas
-- También fix: UNION duplicado en ventas_solicitar_retiro
-- ============================================================================

-- ─── ventas_aprobar_venta ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ventas_aprobar_venta(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_config RECORD;
    v_disponible_desde TIMESTAMPTZ;
    v_director RECORD;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede aprobar ventas');
    END IF;

    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;
    IF v_venta.estado = 'aprobada' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La venta ya está aprobada');
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;
    v_disponible_desde := v_venta.fecha_venta::timestamptz + interval '48 hours';

    UPDATE ventas_ventas
    SET estado = 'aprobada', aprobada_por_id = auth.uid()::uuid, fecha_aprobacion = now()
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

            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_venta.closer_id, 'closer', v_config.bonus_pago_unico,
                        'Bonus pago único - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);
                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_venta.closer_id;
            END IF;

            BEGIN
                INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
                VALUES (v_venta.closer_id, 'venta_aprobada', 'Venta aprobada',
                        'Tu venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido aprobada',
                        jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Notification failed (aprobar_venta closer): %', SQLERRM;
            END;
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

            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_venta.setter_id, 'setter', v_config.bonus_pago_unico,
                        'Bonus pago único - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);
                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_venta.setter_id;
            END IF;

            BEGIN
                INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
                VALUES (v_venta.setter_id, 'venta_aprobada', 'Venta aprobada',
                        'Tu lead ' || COALESCE(v_lead_nombre, 'Lead') || ' ha cerrado venta',
                        jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Notification failed (aprobar_venta setter): %', SQLERRM;
            END;
        END IF;
    END IF;

    -- Comisión a directores
    SELECT * INTO v_config FROM ventas_comisiones_config WHERE rol = 'director_ventas' AND activo = true LIMIT 1;
    IF v_config IS NOT NULL AND v_config.comision_fija > 0 THEN
        FOR v_director IN SELECT usuario_id FROM ventas_roles_comerciales WHERE rol = 'director_ventas' AND activo = true LOOP
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_director.usuario_id, 'director_ventas', v_config.comision_fija,
                    'Comisión dirección - ' || COALESCE(v_lead_nombre, 'Lead'), v_disponible_desde);
            UPDATE ventas_wallet SET saldo = saldo + v_config.comision_fija, total_ganado = total_ganado + v_config.comision_fija
            WHERE usuario_id = v_director.usuario_id;

            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_director.usuario_id, 'director_ventas', v_config.bonus_pago_unico,
                        'Bonus pago único dirección - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);
                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_director.usuario_id;
            END IF;
        END LOOP;
    END IF;

    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Venta aprobada por ' || v_venta.importe || '€',
            jsonb_build_object('venta_id', p_venta_id, 'importe', v_venta.importe));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ventas_rechazar_venta ──────────────────────────────────────────────────

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

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;

    IF v_venta.estado = 'aprobada' THEN
        FOR v_comision IN SELECT * FROM ventas_comisiones WHERE venta_id = p_venta_id AND monto > 0 LOOP
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_comision.usuario_id, v_comision.rol, -v_comision.monto,
                    'Rechazo - ' || COALESCE(v_lead_nombre, 'Lead'), now());
            UPDATE ventas_wallet SET saldo = saldo - v_comision.monto, total_descontado = total_descontado + v_comision.monto
            WHERE usuario_id = v_comision.usuario_id;
        END LOOP;
    END IF;

    UPDATE ventas_ventas SET estado = 'rechazada', fecha_rechazo = now() WHERE id = p_venta_id;

    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (rechazar_venta): %', SQLERRM;
    END;

    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta_rechazada',
            'Venta rechazada', jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ventas_marcar_devolucion ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ventas_marcar_devolucion(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_comision RECORD;
    v_pipeline RECORD;
    v_etapa_devolucion_id UUID;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede marcar devoluciones');
    END IF;

    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;
    IF v_venta.es_devolucion THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La venta ya está marcada como devolución');
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;

    UPDATE ventas_ventas SET es_devolucion = true, fecha_devolucion = now() WHERE id = p_venta_id;

    IF v_venta.estado = 'aprobada' THEN
        FOR v_comision IN SELECT * FROM ventas_comisiones WHERE venta_id = p_venta_id AND monto > 0 LOOP
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_comision.usuario_id, v_comision.rol, -v_comision.monto,
                    'Devolución - ' || COALESCE(v_lead_nombre, 'Lead'), now());
            UPDATE ventas_wallet SET saldo = saldo - v_comision.monto, total_descontado = total_descontado + v_comision.monto
            WHERE usuario_id = v_comision.usuario_id;
        END LOOP;
    END IF;

    IF v_venta.lead_id IS NOT NULL THEN
        FOR v_pipeline IN SELECT id FROM ventas_pipelines LOOP
            SELECT id INTO v_etapa_devolucion_id FROM ventas_etapas
            WHERE pipeline_id = v_pipeline.id AND tipo = 'devolucion' LIMIT 1;
            IF v_etapa_devolucion_id IS NOT NULL THEN
                UPDATE ventas_lead_pipeline SET etapa_id = v_etapa_devolucion_id
                WHERE lead_id = v_venta.lead_id AND pipeline_id = v_pipeline.id;
            END IF;
        END LOOP;
    END IF;

    BEGIN
        IF v_venta.closer_id IS NOT NULL THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.closer_id, 'venta_rechazada', 'Devolución registrada',
                    'Se ha registrado devolución en ' || COALESCE(v_lead_nombre, 'Lead'),
                    jsonb_build_object('venta_id', p_venta_id));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (marcar_devolucion): %', SQLERRM;
    END;

    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'devolucion',
            'Devolución registrada', jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ventas_aprobar_retiro ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ventas_aprobar_retiro(p_retiro_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_retiro RECORD;
    v_datos_fiscales RECORD;
    v_empresa RECORD;
    v_numero_factura VARCHAR;
    v_base DECIMAL;
    v_iva_monto DECIMAL;
    v_total DECIMAL;
    v_factura_id UUID;
    v_datos_bancarios TEXT;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede aprobar retiros');
    END IF;

    SELECT * INTO v_retiro FROM ventas_retiros WHERE id = p_retiro_id;
    IF v_retiro IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Retiro no encontrado');
    END IF;
    IF v_retiro.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El retiro no está pendiente');
    END IF;

    SELECT * INTO v_datos_fiscales FROM ventas_datos_fiscales WHERE usuario_id = v_retiro.usuario_id;
    SELECT * INTO v_empresa FROM ventas_empresa_fiscal LIMIT 1;

    IF v_datos_fiscales IS NOT NULL AND v_datos_fiscales.iva_incluido THEN
        v_total := v_retiro.monto;
        v_iva_monto := ROUND(v_retiro.monto * COALESCE(v_datos_fiscales.iva_porcentaje, 0) / (100 + COALESCE(v_datos_fiscales.iva_porcentaje, 0)), 2);
        v_base := v_total - v_iva_monto;
    ELSE
        v_base := v_retiro.monto;
        v_iva_monto := ROUND(v_retiro.monto * COALESCE(v_datos_fiscales.iva_porcentaje, 0) / 100, 2);
        v_total := v_base + v_iva_monto;
    END IF;

    v_numero_factura := COALESCE(v_datos_fiscales.serie_factura, 'F') || '-' ||
                        LPAD(COALESCE(v_datos_fiscales.siguiente_numero_factura, 1)::text, 3, '0');

    v_datos_bancarios := CASE COALESCE(v_retiro.tipo_cuenta, 'iban')
        WHEN 'iban' THEN 'IBAN: ' || COALESCE(v_retiro.cuenta_bancaria_iban, '-')
            || CASE WHEN v_retiro.swift_bic IS NOT NULL AND v_retiro.swift_bic != '' THEN ' · SWIFT: ' || v_retiro.swift_bic ELSE '' END
        WHEN 'us' THEN 'Routing: ' || COALESCE(v_retiro.routing_number, '-')
            || ' · Account: ' || COALESCE(v_retiro.account_number, '-')
            || CASE WHEN v_retiro.swift_bic IS NOT NULL AND v_retiro.swift_bic != '' THEN ' · SWIFT: ' || v_retiro.swift_bic ELSE '' END
        WHEN 'uk' THEN 'Sort Code: ' || COALESCE(v_retiro.sort_code, '-')
            || ' · Account: ' || COALESCE(v_retiro.account_number, '-')
            || CASE WHEN v_retiro.swift_bic IS NOT NULL AND v_retiro.swift_bic != '' THEN ' · SWIFT: ' || v_retiro.swift_bic ELSE '' END
        WHEN 'other' THEN 'SWIFT: ' || COALESCE(v_retiro.swift_bic, '-')
            || ' · Account: ' || COALESCE(v_retiro.account_number, '-')
        ELSE COALESCE(v_retiro.cuenta_bancaria_iban, '-')
    END;

    INSERT INTO ventas_facturas (
        retiro_id, usuario_id, numero_factura, fecha_emision,
        emisor_nombre, emisor_nif, emisor_direccion, emisor_ciudad, emisor_cp, emisor_pais,
        receptor_nombre, receptor_cif, receptor_direccion, receptor_ciudad, receptor_cp, receptor_pais,
        concepto, base_imponible, iva_porcentaje, iva_monto, total, datos_bancarios_texto
    ) VALUES (
        p_retiro_id, v_retiro.usuario_id, v_numero_factura, CURRENT_DATE,
        v_datos_fiscales.nombre_fiscal, v_datos_fiscales.nif_cif, v_datos_fiscales.direccion,
        v_datos_fiscales.ciudad, v_datos_fiscales.codigo_postal, v_datos_fiscales.pais,
        COALESCE(v_empresa.nombre_fiscal, 'Madrigal Marketing'), COALESCE(v_empresa.cif, ''),
        v_empresa.direccion, v_empresa.ciudad, v_empresa.codigo_postal, v_empresa.pais,
        COALESCE(v_empresa.concepto_factura, 'Servicios de intermediación comercial'),
        v_base, COALESCE(v_datos_fiscales.iva_porcentaje, 0), v_iva_monto, v_total, v_datos_bancarios
    ) RETURNING id INTO v_factura_id;

    UPDATE ventas_datos_fiscales SET siguiente_numero_factura = COALESCE(siguiente_numero_factura, 1) + 1
    WHERE usuario_id = v_retiro.usuario_id;

    UPDATE ventas_retiros SET estado = 'aprobado', factura_id = v_factura_id,
        aprobado_por_id = auth.uid()::uuid, fecha_aprobacion = now()
    WHERE id = p_retiro_id;

    UPDATE ventas_wallet SET total_retirado = total_retirado + v_retiro.monto
    WHERE usuario_id = v_retiro.usuario_id;

    BEGIN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_retiro.usuario_id, 'retiro_aprobado', 'Retiro aprobado',
                'Tu retiro de ' || v_retiro.monto || '€ ha sido aprobado. Factura: ' || v_numero_factura,
                jsonb_build_object('retiro_id', p_retiro_id, 'factura_id', v_factura_id));
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (aprobar_retiro): %', SQLERRM;
    END;

    RETURN jsonb_build_object('ok', true, 'factura_id', v_factura_id, 'numero_factura', v_numero_factura);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ventas_rechazar_retiro ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ventas_rechazar_retiro(p_retiro_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_retiro RECORD;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede rechazar retiros');
    END IF;

    SELECT * INTO v_retiro FROM ventas_retiros WHERE id = p_retiro_id;
    IF v_retiro IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Retiro no encontrado');
    END IF;
    IF v_retiro.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El retiro no está pendiente');
    END IF;

    UPDATE ventas_retiros SET estado = 'rechazado', fecha_rechazo = now(), motivo_rechazo = p_motivo
    WHERE id = p_retiro_id;

    BEGIN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_retiro.usuario_id, 'retiro_rechazado', 'Retiro rechazado',
                'Tu retiro de ' || v_retiro.monto || '€ ha sido rechazado.' ||
                CASE WHEN p_motivo IS NOT NULL THEN ' Motivo: ' || p_motivo ELSE '' END,
                jsonb_build_object('retiro_id', p_retiro_id, 'motivo', p_motivo));
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (rechazar_retiro): %', SQLERRM;
    END;

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ventas_solicitar_retiro (+ fix UNION duplicado) ────────────────────────

CREATE OR REPLACE FUNCTION ventas_solicitar_retiro(p_usuario_id UUID, p_monto DECIMAL)
RETURNS JSONB AS $$
DECLARE
    v_saldo_disponible DECIMAL;
    v_al_dia BOOLEAN;
    v_datos_fiscales RECORD;
    v_retiro_id UUID;
BEGIN
    IF auth.uid()::uuid <> p_usuario_id AND NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
    END IF;

    IF p_monto <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El monto debe ser mayor a 0');
    END IF;

    v_al_dia := ventas_verificar_closer_al_dia(p_usuario_id);
    IF NOT v_al_dia THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Debes marcar el estado de todas tus reuniones pasadas antes de solicitar un retiro');
    END IF;

    v_saldo_disponible := ventas_obtener_saldo_disponible(p_usuario_id);
    IF v_saldo_disponible < p_monto THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente. Disponible: ' || v_saldo_disponible || '€');
    END IF;

    SELECT * INTO v_datos_fiscales FROM ventas_datos_fiscales WHERE usuario_id = p_usuario_id;

    INSERT INTO ventas_retiros (
        usuario_id, monto, cuenta_bancaria_iban, tipo_cuenta, swift_bic,
        routing_number, account_number, sort_code, titular_cuenta
    ) VALUES (
        p_usuario_id, p_monto, v_datos_fiscales.cuenta_bancaria_iban,
        v_datos_fiscales.tipo_cuenta, v_datos_fiscales.swift_bic,
        v_datos_fiscales.routing_number, v_datos_fiscales.account_number,
        v_datos_fiscales.sort_code, v_datos_fiscales.titular_cuenta
    ) RETURNING id INTO v_retiro_id;

    BEGIN
        -- Notificar a super_admins con rol comercial
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        SELECT DISTINCT vrc.usuario_id, 'retiro_pendiente', 'Nuevo retiro solicitado',
               'Se ha solicitado un retiro de ' || p_monto || '€',
               jsonb_build_object('retiro_id', v_retiro_id, 'usuario_id', p_usuario_id)
        FROM ventas_roles_comerciales vrc
        WHERE vrc.rol = 'super_admin' AND vrc.activo = true;

        -- Super_admins sin rol comercial
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        SELECT u.id, 'retiro_pendiente', 'Nuevo retiro solicitado',
               'Se ha solicitado un retiro de ' || p_monto || '€',
               jsonb_build_object('retiro_id', v_retiro_id, 'usuario_id', p_usuario_id)
        FROM usuarios u
        WHERE u.tipo = 'super_admin' AND u.activo = true
        AND NOT EXISTS (
            SELECT 1 FROM ventas_roles_comerciales vrc2
            WHERE vrc2.usuario_id = u.id AND vrc2.activo = true
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (solicitar_retiro): %', SQLERRM;
    END;

    RETURN jsonb_build_object('ok', true, 'retiro_id', v_retiro_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ventas_revertir_rechazo (proteger notificaciones) ──────────────────────

CREATE OR REPLACE FUNCTION ventas_revertir_rechazo(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
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

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;

    UPDATE ventas_ventas SET estado = 'pendiente', fecha_rechazo = NULL, updated_at = NOW()
    WHERE id = p_venta_id;

    BEGIN
        IF v_venta.closer_id IS NOT NULL THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.closer_id, 'venta_pendiente', 'Venta restaurada',
                    'Tu venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido restaurada a pendiente',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
        IF v_venta.setter_id IS NOT NULL AND v_venta.setter_id <> COALESCE(v_venta.closer_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.setter_id, 'venta_pendiente', 'Venta restaurada',
                    'La venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido restaurada a pendiente',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (revertir_rechazo): %', SQLERRM;
    END;

    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Rechazo revertido - venta vuelve a pendiente',
            jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── ventas_revertir_devolucion (proteger notificaciones) ───────────────────

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

    UPDATE ventas_ventas SET es_devolucion = false, fecha_devolucion = NULL, estado = 'aprobada', updated_at = NOW()
    WHERE id = p_venta_id;

    FOR v_comision IN SELECT * FROM ventas_comisiones WHERE venta_id = p_venta_id AND monto < 0 AND concepto LIKE 'Devolución%' LOOP
        INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
        VALUES (p_venta_id, v_comision.usuario_id, v_comision.rol, -v_comision.monto,
                'Reversión devolución - ' || COALESCE(v_lead_nombre, 'Lead'), now());
        UPDATE ventas_wallet SET saldo = saldo + (-v_comision.monto), total_ganado = total_ganado + (-v_comision.monto)
        WHERE usuario_id = v_comision.usuario_id;
    END LOOP;

    BEGIN
        IF v_venta.closer_id IS NOT NULL THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.closer_id, 'venta_aprobada', 'Devolución revertida',
                    'La devolución de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido revertida. Venta restaurada.',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
        IF v_venta.setter_id IS NOT NULL AND v_venta.setter_id <> COALESCE(v_venta.closer_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.setter_id, 'venta_aprobada', 'Devolución revertida',
                    'La devolución de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido revertida. Venta restaurada.',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (revertir_devolucion): %', SQLERRM;
    END;

    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Devolución revertida - venta restaurada a aprobada',
            jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
