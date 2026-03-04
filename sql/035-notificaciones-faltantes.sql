-- ============================================================================
-- 035 - Notificaciones faltantes
-- Añade triggers para: venta pendiente, cambio estado reunión, lead asignado manual
-- ============================================================================

-- ─── 1. Venta registrada (pendiente de aprobar) ─────────────────────────────
-- Notifica a directores y super_admins cuando se crea una venta pendiente

CREATE OR REPLACE FUNCTION trg_fn_notificacion_venta_pendiente()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    -- Solo notificar ventas nuevas en estado pendiente
    IF NEW.estado <> 'pendiente' THEN
        RETURN NEW;
    END IF;

    -- Obtener nombre del lead
    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

    -- Notificar a directores de ventas
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    SELECT vrc.usuario_id, 'venta_pendiente', 'Nueva venta pendiente',
           'Venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' por ' || NEW.importe || '€ pendiente de aprobación',
           jsonb_build_object('venta_id', NEW.id, 'lead_id', NEW.lead_id)
    FROM ventas_roles_comerciales vrc
    WHERE vrc.rol IN ('director_ventas', 'super_admin') AND vrc.activo = true
    -- Excluir al propio closer que registró la venta (ya sabe que la creó)
    AND vrc.usuario_id <> COALESCE(NEW.closer_id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- También notificar a usuarios tipo super_admin que no tengan rol comercial
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    SELECT u.id, 'venta_pendiente', 'Nueva venta pendiente',
           'Venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' por ' || NEW.importe || '€ pendiente de aprobación',
           jsonb_build_object('venta_id', NEW.id, 'lead_id', NEW.lead_id)
    FROM usuarios u
    WHERE u.tipo = 'super_admin' AND u.activo = true
    AND NOT EXISTS (
        SELECT 1 FROM ventas_roles_comerciales vrc2
        WHERE vrc2.usuario_id = u.id AND vrc2.activo = true
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ventas_notificacion_venta_pendiente ON ventas_ventas;
CREATE TRIGGER trg_ventas_notificacion_venta_pendiente
    AFTER INSERT ON ventas_ventas
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_notificacion_venta_pendiente();


-- ─── 2. Cambio de estado de reunión ─────────────────────────────────────────
-- Notifica al closer y setter cuando cambia el estado de reunión de una cita

CREATE OR REPLACE FUNCTION trg_fn_notificacion_estado_reunion()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
    v_estado_nombre VARCHAR;
BEGIN
    -- Solo cuando cambia estado_reunion_id (y no es la primera vez que se establece desde NULL)
    IF NEW.estado_reunion_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF OLD.estado_reunion_id IS NOT DISTINCT FROM NEW.estado_reunion_id THEN
        RETURN NEW;
    END IF;

    -- Obtener nombre del lead y del estado
    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;
    SELECT nombre INTO v_estado_nombre FROM ventas_reunion_estados WHERE id = NEW.estado_reunion_id;

    -- No notificar si el estado es 'Cancelada' (ya tiene su propio trigger)
    IF v_estado_nombre = 'Cancelada' THEN
        RETURN NEW;
    END IF;

    -- Notificar al closer
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

    -- Notificar al setter (si existe y es diferente al closer)
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ventas_notificacion_estado_reunion ON ventas_citas;
CREATE TRIGGER trg_ventas_notificacion_estado_reunion
    AFTER UPDATE ON ventas_citas
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_notificacion_estado_reunion();


-- ─── 3. Lead asignado manualmente ───────────────────────────────────────────
-- Notifica al setter cuando se le asigna un lead manualmente (UPDATE de setter_asignado_id)

CREATE OR REPLACE FUNCTION trg_fn_notificacion_lead_asignado_manual()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo cuando cambia setter_asignado_id a un valor no nulo
    IF NEW.setter_asignado_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF OLD.setter_asignado_id IS NOT DISTINCT FROM NEW.setter_asignado_id THEN
        RETURN NEW;
    END IF;

    -- No duplicar si viene de ventas_asignar_lead_automatico (esa función ya notifica)
    -- Lo detectamos porque la asignación automática establece creado_por = 'webhook'
    -- y el lead ya tiene setter al crearse. Aquí solo disparamos si es un UPDATE posterior.

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

DROP TRIGGER IF EXISTS trg_ventas_notificacion_lead_asignado_manual ON ventas_leads;
CREATE TRIGGER trg_ventas_notificacion_lead_asignado_manual
    AFTER UPDATE ON ventas_leads
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_notificacion_lead_asignado_manual();
