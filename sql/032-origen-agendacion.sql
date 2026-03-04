-- ============================================================================
-- Origen de agendacion — Trazabilidad de como se agendo cada cita
-- ============================================================================

BEGIN;

-- ── Campo nuevo en ventas_citas ─────────────────────────────────────────────
ALTER TABLE ventas_citas ADD COLUMN IF NOT EXISTS
  origen_agendacion VARCHAR(30) DEFAULT 'manual';
-- Valores: 'manual', 'enlace_setter', 'enlace_campana'

-- ── Marcar citas existentes retroactivamente ────────────────────────────────
UPDATE ventas_citas SET origen_agendacion = 'enlace_setter'
WHERE enlace_agenda_id IS NOT NULL AND setter_origen_id IS NOT NULL AND origen_agendacion = 'manual';

UPDATE ventas_citas SET origen_agendacion = 'enlace_campana'
WHERE enlace_agenda_id IS NOT NULL AND setter_origen_id IS NULL AND origen_agendacion = 'manual';

-- ── Actualizar RPC crear_reserva_publica ────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_reserva_publica(
    p_slug       TEXT,
    p_fecha_hora TIMESTAMPTZ,
    p_closer_id  UUID,
    p_nombre     TEXT,
    p_email      TEXT,
    p_telefono   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enlace    RECORD;
    v_lead_id   UUID;
    v_cita_id   UUID;
    v_duracion  INTEGER;
    v_origen    VARCHAR(30);
BEGIN
    -- Validate enlace
    SELECT id, setter_id, fuente, activo
    INTO v_enlace
    FROM ventas_enlaces_agenda
    WHERE slug = p_slug;

    IF NOT FOUND OR NOT v_enlace.activo THEN
        RAISE EXCEPTION 'Enlace no encontrado o inactivo';
    END IF;

    -- Validate closer is assigned to this enlace
    IF NOT EXISTS (
        SELECT 1 FROM ventas_enlaces_closers
        WHERE enlace_id = v_enlace.id AND closer_id = p_closer_id
    ) THEN
        RAISE EXCEPTION 'Closer no asignado a este enlace';
    END IF;

    -- Get slot duration
    SELECT COALESCE(duracion_slot_minutos, 60) INTO v_duracion
    FROM ventas_calendario_config
    WHERE usuario_id = p_closer_id;
    v_duracion := COALESCE(v_duracion, 60);

    -- Verify slot is still available
    IF EXISTS (
        SELECT 1 FROM ventas_citas vc
        WHERE vc.closer_id = p_closer_id
          AND vc.estado != 'cancelada'
          AND vc.fecha_hora < p_fecha_hora + (v_duracion || ' minutes')::INTERVAL
          AND vc.fecha_hora + (COALESCE(vc.duracion_minutos, v_duracion) || ' minutes')::INTERVAL > p_fecha_hora
    ) THEN
        RAISE EXCEPTION 'Este horario ya no esta disponible';
    END IF;

    -- Determine origen_agendacion
    v_origen := CASE WHEN v_enlace.setter_id IS NOT NULL THEN 'enlace_setter' ELSE 'enlace_campana' END;

    -- Find existing lead by email or create new one
    SELECT id INTO v_lead_id
    FROM ventas_leads
    WHERE email = p_email
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_lead_id IS NULL THEN
        INSERT INTO ventas_leads (nombre, email, telefono, fuente, setter_asignado_id, closer_asignado_id, creado_por)
        VALUES (p_nombre, p_email, p_telefono, v_enlace.fuente, v_enlace.setter_id, p_closer_id, 'enlace_publico')
        RETURNING id INTO v_lead_id;
    ELSE
        UPDATE ventas_leads
        SET nombre = p_nombre,
            telefono = COALESCE(p_telefono, telefono),
            closer_asignado_id = p_closer_id,
            updated_at = now()
        WHERE id = v_lead_id;
    END IF;

    -- Create cita with origen_agendacion
    INSERT INTO ventas_citas (lead_id, closer_id, setter_origen_id, enlace_agenda_id, fecha_hora, duracion_minutos, estado, origen_agendacion)
    VALUES (v_lead_id, p_closer_id, v_enlace.setter_id, v_enlace.id, p_fecha_hora, v_duracion, 'agendada', v_origen)
    RETURNING id INTO v_cita_id;

    RETURN jsonb_build_object(
        'cita_id', v_cita_id,
        'lead_id', v_lead_id,
        'closer_id', p_closer_id,
        'fecha_hora', p_fecha_hora,
        'duracion', v_duracion
    );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_reserva_publica(TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION crear_reserva_publica(TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
