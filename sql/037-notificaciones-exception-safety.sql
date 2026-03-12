-- ============================================================================
-- 037 - Hacer TODOS los triggers de notificación tolerantes a fallos
-- Una notificación que falla NUNCA debe bloquear la operación padre
-- ============================================================================

-- ─── 1. Cita agendada ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_cita_agendada()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    BEGIN
        SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

        IF NEW.closer_id IS NOT NULL THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (
                NEW.closer_id,
                'cita_agendada',
                'Nueva cita agendada',
                'Cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' el ' || to_char(NEW.fecha_hora, 'DD/MM/YYYY HH24:MI'),
                jsonb_build_object('lead_id', NEW.lead_id, 'cita_id', NEW.id)
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed (cita_agendada): %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 2. Cita cancelada ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_cita_cancelada()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    BEGIN
        IF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN
            SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

            IF NEW.closer_id IS NOT NULL THEN
                INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
                VALUES (
                    NEW.closer_id,
                    'cita_cancelada',
                    'Cita cancelada',
                    'La cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido cancelada',
                    jsonb_build_object('lead_id', NEW.lead_id, 'cita_id', NEW.id)
                );
            END IF;

            IF NEW.setter_origen_id IS NOT NULL THEN
                INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
                VALUES (
                    NEW.setter_origen_id,
                    'cita_cancelada',
                    'Cita cancelada',
                    'La cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido cancelada',
                    jsonb_build_object('lead_id', NEW.lead_id, 'cita_id', NEW.id)
                );
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed (cita_cancelada): %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 3. Estado reunión cambiado ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_estado_reunion()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
    v_estado_nombre VARCHAR;
BEGIN
    BEGIN
        IF NEW.estado_reunion_id IS NULL THEN
            RETURN NEW;
        END IF;
        IF OLD.estado_reunion_id IS NOT DISTINCT FROM NEW.estado_reunion_id THEN
            RETURN NEW;
        END IF;

        SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;
        SELECT nombre INTO v_estado_nombre FROM ventas_reunion_estados WHERE id = NEW.estado_reunion_id;

        IF v_estado_nombre = 'Cancelada' THEN
            RETURN NEW;
        END IF;

        IF NEW.closer_id IS NOT NULL THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (
                NEW.closer_id,
                'cita_estado_cambiado',
                'Estado de reunión actualizado',
                'Reunión con ' || COALESCE(v_lead_nombre, 'Lead') || ' marcada como: ' || COALESCE(v_estado_nombre, 'Desconocido'),
                jsonb_build_object('cita_id', NEW.id, 'lead_id', NEW.lead_id, 'estado_reunion', v_estado_nombre)
            );
        END IF;

        IF NEW.setter_origen_id IS NOT NULL AND NEW.setter_origen_id <> COALESCE(NEW.closer_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (
                NEW.setter_origen_id,
                'cita_estado_cambiado',
                'Estado de reunión actualizado',
                'Reunión con ' || COALESCE(v_lead_nombre, 'Lead') || ' marcada como: ' || COALESCE(v_estado_nombre, 'Desconocido'),
                jsonb_build_object('cita_id', NEW.id, 'lead_id', NEW.lead_id, 'estado_reunion', v_estado_nombre)
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed (estado_reunion): %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 4. Cita reasignada ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_cita_reasignada()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    BEGIN
        IF OLD.closer_id IS NOT DISTINCT FROM NEW.closer_id THEN
            RETURN NEW;
        END IF;
        IF NEW.closer_id IS NULL THEN
            RETURN NEW;
        END IF;
        IF NEW.estado = 'cancelada' THEN
            RETURN NEW;
        END IF;

        SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (
            NEW.closer_id,
            'cita_agendada',
            'Cita reasignada',
            'Se te ha reasignado la cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' el ' || to_char(NEW.fecha_hora, 'DD/MM/YYYY HH24:MI'),
            jsonb_build_object('cita_id', NEW.id, 'lead_id', NEW.lead_id)
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed (cita_reasignada): %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 5. Lead asignado manual (setter) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_lead_asignado_manual()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        IF NEW.setter_asignado_id IS NULL THEN
            RETURN NEW;
        END IF;
        IF OLD.setter_asignado_id IS NOT DISTINCT FROM NEW.setter_asignado_id THEN
            RETURN NEW;
        END IF;
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
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed (lead_asignado_manual): %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 6. Closer asignado a lead ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_closer_asignado()
RETURNS TRIGGER AS $$
BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed (closer_asignado): %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 7. Venta pendiente ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_fn_notificacion_venta_pendiente()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    BEGIN
        IF NEW.estado <> 'pendiente' THEN
            RETURN NEW;
        END IF;

        SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        SELECT DISTINCT vrc.usuario_id, 'venta_pendiente', 'Nueva venta pendiente',
               'Venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' por ' || NEW.importe || '€ pendiente de aprobación',
               jsonb_build_object('venta_id', NEW.id, 'lead_id', NEW.lead_id)
        FROM ventas_roles_comerciales vrc
        WHERE vrc.rol IN ('director_ventas', 'super_admin') AND vrc.activo = true
        AND vrc.usuario_id <> COALESCE(NEW.closer_id, '00000000-0000-0000-0000-000000000000'::uuid);

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
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed (venta_pendiente): %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 8. Funciones RPC — añadir EXCEPTION a los bloques de notificación ──────
-- Estas funciones tienen lógica de negocio + notificaciones.
-- Envolvemos SOLO la parte de notificaciones en EXCEPTION.

-- 8a. ventas_asignar_lead_automatico — proteger la notificación
-- Leemos la función actual y la reescribimos con EXCEPTION en la notificación

CREATE OR REPLACE FUNCTION ventas_asignar_lead_automatico(p_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_setter_asignado_id UUID;
    v_rand DOUBLE PRECISION;
    v_cumulative INTEGER := 0;
    v_total_pct INTEGER;
    rec RECORD;
BEGIN
    -- Verificar que el lead existe y no tiene setter
    IF NOT EXISTS (SELECT 1 FROM ventas_leads WHERE id = p_lead_id AND setter_asignado_id IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Lead ya tiene setter o no existe');
    END IF;

    -- Obtener total de porcentaje de setters con porcentaje > 0
    SELECT COALESCE(SUM(rc.porcentaje), 0) INTO v_total_pct
    FROM ventas_reparto_config rc
    JOIN ventas_roles_comerciales vrc ON vrc.usuario_id = rc.setter_id
    JOIN usuarios u ON u.id = rc.setter_id
    WHERE rc.activo = true AND rc.porcentaje > 0
      AND vrc.rol = 'setter' AND vrc.activo = true AND u.activo = true;

    IF v_total_pct = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No hay setters con porcentaje > 0');
    END IF;

    -- Selección ponderada por porcentaje
    v_rand := random() * v_total_pct;

    FOR rec IN
        SELECT rc.setter_id, rc.porcentaje
        FROM ventas_reparto_config rc
        JOIN ventas_roles_comerciales vrc ON vrc.usuario_id = rc.setter_id
        JOIN usuarios u ON u.id = rc.setter_id
        WHERE rc.activo = true AND rc.porcentaje > 0
          AND vrc.rol = 'setter' AND vrc.activo = true AND u.activo = true
        ORDER BY rc.porcentaje DESC, rc.setter_id
    LOOP
        v_cumulative := v_cumulative + rec.porcentaje;
        IF v_rand <= v_cumulative THEN
            v_setter_asignado_id := rec.setter_id;
            EXIT;
        END IF;
    END LOOP;

    -- Fallback (should not happen)
    IF v_setter_asignado_id IS NULL THEN
        SELECT rc.setter_id INTO v_setter_asignado_id
        FROM ventas_reparto_config rc
        WHERE rc.activo = true AND rc.porcentaje > 0
        LIMIT 1;
    END IF;

    IF v_setter_asignado_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No se pudo seleccionar setter');
    END IF;

    -- Asignar setter
    UPDATE ventas_leads
    SET setter_asignado_id = v_setter_asignado_id
    WHERE id = p_lead_id;

    -- Actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (p_lead_id, v_setter_asignado_id, 'asignacion',
            'Lead asignado automáticamente',
            jsonb_build_object('setter_id', v_setter_asignado_id));

    -- Notificación (con protección)
    BEGIN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_setter_asignado_id, 'lead_asignado', 'Nuevo lead asignado',
                'Se te ha asignado un nuevo lead',
                jsonb_build_object('lead_id', p_lead_id));
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification failed (asignar_lead_auto): %', SQLERRM;
    END;

    RETURN jsonb_build_object('ok', true, 'setter_id', v_setter_asignado_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
