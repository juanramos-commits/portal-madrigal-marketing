-- ============================================================================
-- 036 - Fix bugs en notificaciones + añadir notificaciones faltantes
-- ============================================================================

-- ─── FIX 1: Lead asignado manual — evitar duplicado con auto-asignación ─────
-- El webhook llama a ventas_asignar_lead_automatico que ya notifica.
-- Este trigger solo debe dispararse si NO viene del flujo automático.

CREATE OR REPLACE FUNCTION trg_fn_notificacion_lead_asignado_manual()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.setter_asignado_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF OLD.setter_asignado_id IS NOT DISTINCT FROM NEW.setter_asignado_id THEN
        RETURN NEW;
    END IF;

    -- Si el lead fue creado por webhook y aún no tenía setter, es asignación automática
    -- (ventas_asignar_lead_automatico ya envió la notificación)
    IF OLD.setter_asignado_id IS NULL AND NEW.creado_por = 'webhook' THEN
        RETURN NEW;
    END IF;

    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (
        NEW.setter_asignado_id,
        'lead_asignado',
        'Nuevo lead asignado',
        'Se te ha asignado el lead: ' || COALESCE(NEW.nombre, 'Sin nombre'),
        jsonb_build_object('lead_id', NEW.id)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── FIX 2: Venta pendiente — evitar duplicado para super_admins ────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_venta_pendiente()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    IF NEW.estado <> 'pendiente' THEN
        RETURN NEW;
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

    -- Notificar a directores y super_admins (con rol comercial)
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    SELECT DISTINCT vrc.usuario_id, 'venta_pendiente', 'Nueva venta pendiente',
           'Venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' por ' || NEW.importe || '€ pendiente de aprobación',
           jsonb_build_object('venta_id', NEW.id, 'lead_id', NEW.lead_id)
    FROM ventas_roles_comerciales vrc
    WHERE vrc.rol IN ('director_ventas', 'super_admin') AND vrc.activo = true
    AND vrc.usuario_id <> COALESCE(NEW.closer_id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- Super_admins sin rol comercial
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    SELECT u.id, 'venta_pendiente', 'Nueva venta pendiente',
           'Venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' por ' || NEW.importe || '€ pendiente de aprobación',
           jsonb_build_object('venta_id', NEW.id, 'lead_id', NEW.lead_id)
    FROM usuarios u
    WHERE u.tipo = 'super_admin' AND u.activo = true
    AND NOT EXISTS (
        SELECT 1 FROM ventas_roles_comerciales vrc2
        WHERE vrc2.usuario_id = u.id AND vrc2.activo = true
    )
    AND u.id <> COALESCE(NEW.closer_id, '00000000-0000-0000-0000-000000000000'::uuid);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── NUEVA 1: Closer asignado a un lead ─────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_closer_asignado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.closer_asignado_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF OLD.closer_asignado_id IS NOT DISTINCT FROM NEW.closer_asignado_id THEN
        RETURN NEW;
    END IF;

    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (
        NEW.closer_asignado_id,
        'lead_asignado',
        'Lead asignado para cierre',
        'Se te ha asignado el lead: ' || COALESCE(NEW.nombre, 'Sin nombre'),
        jsonb_build_object('lead_id', NEW.id)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ventas_notificacion_closer_asignado ON ventas_leads;
CREATE TRIGGER trg_ventas_notificacion_closer_asignado
    AFTER UPDATE ON ventas_leads
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_notificacion_closer_asignado();


-- ─── NUEVA 2: Reasignar closer de una cita ──────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_cita_reasignada()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    IF OLD.closer_id IS NOT DISTINCT FROM NEW.closer_id THEN
        RETURN NEW;
    END IF;
    IF NEW.closer_id IS NULL THEN
        RETURN NEW;
    END IF;
    -- No notificar si la cita está cancelada
    IF NEW.estado = 'cancelada' THEN
        RETURN NEW;
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

    -- Notificar al nuevo closer
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (
        NEW.closer_id,
        'cita_agendada',
        'Cita reasignada',
        'Se te ha reasignado la cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' el ' || to_char(NEW.fecha_hora, 'DD/MM/YYYY HH24:MI'),
        jsonb_build_object('cita_id', NEW.id, 'lead_id', NEW.lead_id)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ventas_notificacion_cita_reasignada ON ventas_citas;
CREATE TRIGGER trg_ventas_notificacion_cita_reasignada
    AFTER UPDATE ON ventas_citas
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_notificacion_cita_reasignada();


-- ─── NUEVA 3: Revertir rechazo → notificar closer y setter ──────────────────

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

    UPDATE ventas_ventas
    SET estado = 'pendiente',
        fecha_rechazo = NULL,
        updated_at = NOW()
    WHERE id = p_venta_id;

    -- Notificar al closer
    IF v_venta.closer_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.closer_id, 'venta_pendiente', 'Venta restaurada',
                'Tu venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido restaurada a pendiente',
                jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
    END IF;

    -- Notificar al setter
    IF v_venta.setter_id IS NOT NULL AND v_venta.setter_id <> COALESCE(v_venta.closer_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.setter_id, 'venta_pendiente', 'Venta restaurada',
                'La venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido restaurada a pendiente',
                jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
    END IF;

    -- Actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Rechazo revertido - venta vuelve a pendiente',
            jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── NUEVA 4: Revertir devolución → notificar closer y setter ───────────────

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

    -- Revertir flag de devolución, restaurar a aprobada
    UPDATE ventas_ventas
    SET es_devolucion = false,
        fecha_devolucion = NULL,
        estado = 'aprobada',
        updated_at = NOW()
    WHERE id = p_venta_id;

    -- Regenerar comisiones: cancelar las negativas de devolución
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

    -- Notificar al closer
    IF v_venta.closer_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.closer_id, 'venta_aprobada', 'Devolución revertida',
                'La devolución de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido revertida. Venta restaurada.',
                jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
    END IF;

    -- Notificar al setter
    IF v_venta.setter_id IS NOT NULL AND v_venta.setter_id <> COALESCE(v_venta.closer_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.setter_id, 'venta_aprobada', 'Devolución revertida',
                'La devolución de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido revertida. Venta restaurada.',
                jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
    END IF;

    -- Actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Devolución revertida - venta restaurada a aprobada',
            jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
