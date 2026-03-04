-- ============================================================================
-- Cache de eventos externos de Google Calendar
-- Permite mostrar TODOS los eventos de Google en la app y bloquear
-- disponibilidad en la reserva publica
-- ============================================================================

BEGIN;

-- ── Tabla de cache de eventos externos de Google Calendar ─────────────────
CREATE TABLE IF NOT EXISTS ventas_google_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    google_event_id VARCHAR(255) NOT NULL,
    summary         TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    all_day         BOOLEAN DEFAULT false,
    status          VARCHAR(30) DEFAULT 'confirmed',
    html_link       TEXT,
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(usuario_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_vge_usuario_start ON ventas_google_events(usuario_id, start_time);
CREATE INDEX IF NOT EXISTS idx_vge_usuario_end ON ventas_google_events(usuario_id, end_time);

CREATE TRIGGER trg_ventas_google_events_updated_at
    BEFORE UPDATE ON ventas_google_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ventas_google_events ENABLE ROW LEVEL SECURITY;

-- Closers ven sus propios eventos, directores/admins ven todos
CREATE POLICY vge_select ON ventas_google_events FOR SELECT USING (
    ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid
);
-- Writes solo desde service_role (edge functions) — RLS se bypasa con service_role key
-- Pero añadimos policies permisivas por si acaso
CREATE POLICY vge_insert ON ventas_google_events FOR INSERT WITH CHECK (true);
CREATE POLICY vge_update ON ventas_google_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY vge_delete ON ventas_google_events FOR DELETE USING (true);

-- ── Actualizar obtener_slots_disponibles para comprobar Google events ─────
CREATE OR REPLACE FUNCTION obtener_slots_disponibles(
    p_slug        TEXT,
    p_fecha_desde DATE DEFAULT CURRENT_DATE,
    p_fecha_hasta DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days')::DATE
)
RETURNS TABLE (
    fecha_hora  TIMESTAMPTZ,
    closer_id   UUID,
    duracion    INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_enlace_id UUID;
    v_activo    BOOLEAN;
    v_closer    RECORD;
    v_disp      RECORD;
    v_fecha     DATE;
    v_slot_start TIMESTAMPTZ;
    v_slot_end   TIMESTAMPTZ;
    v_dur       INTEGER;
    v_desc      INTEGER;
    v_dia       INTEGER;
    v_window_start TIMESTAMPTZ;
    v_window_end   TIMESTAMPTZ;
BEGIN
    -- Resolve slug
    SELECT ea.id, ea.activo INTO v_enlace_id, v_activo
    FROM ventas_enlaces_agenda ea
    WHERE ea.slug = p_slug;

    IF NOT FOUND OR NOT v_activo THEN
        RETURN;
    END IF;

    -- For each closer assigned to this enlace, ordered by cita count (round-robin)
    FOR v_closer IN (
        SELECT
            vec.closer_id AS cid,
            COALESCE(cfg.duracion_slot_minutos, 60) AS slot_dur,
            COALESCE(cfg.descanso_entre_citas_minutos, 15) AS slot_desc,
            COALESCE(cnt.total, 0) AS citas_count
        FROM ventas_enlaces_closers vec
        LEFT JOIN ventas_calendario_config cfg ON cfg.usuario_id = vec.closer_id
        LEFT JOIN (
            SELECT vc.closer_id, COUNT(*) AS total
            FROM ventas_citas vc
            WHERE vc.estado != 'cancelada'
              AND vc.fecha_hora >= NOW()
              AND vc.fecha_hora <= NOW() + INTERVAL '7 days'
            GROUP BY vc.closer_id
        ) cnt ON cnt.closer_id = vec.closer_id
        WHERE vec.enlace_id = v_enlace_id
        ORDER BY COALESCE(cnt.total, 0) ASC
    ) LOOP
        v_dur := v_closer.slot_dur;
        v_desc := v_closer.slot_desc;

        v_fecha := p_fecha_desde;
        WHILE v_fecha <= p_fecha_hasta LOOP
            -- dia_semana: 0=Lun..6=Dom (ISODOW: 1=Mon..7=Sun)
            v_dia := EXTRACT(ISODOW FROM v_fecha)::INTEGER - 1;

            FOR v_disp IN (
                SELECT d.hora_inicio, d.hora_fin
                FROM ventas_calendario_disponibilidad d
                WHERE d.usuario_id = v_closer.cid
                  AND d.dia_semana = v_dia
                  AND d.activo = true
                ORDER BY d.hora_inicio
            ) LOOP
                v_window_start := (v_fecha || ' ' || v_disp.hora_inicio)::TIMESTAMP AT TIME ZONE 'Europe/Madrid';
                v_window_end := (v_fecha || ' ' || v_disp.hora_fin)::TIMESTAMP AT TIME ZONE 'Europe/Madrid';

                v_slot_start := v_window_start;

                WHILE v_slot_start + (v_dur || ' minutes')::INTERVAL <= v_window_end LOOP
                    v_slot_end := v_slot_start + (v_dur || ' minutes')::INTERVAL;

                    -- Skip past slots (with 1h minimum lead time)
                    IF v_slot_start > NOW() + INTERVAL '1 hour' THEN
                        -- Check no overlapping cita
                        IF NOT EXISTS (
                            SELECT 1 FROM ventas_citas vc
                            WHERE vc.closer_id = v_closer.cid
                              AND vc.estado != 'cancelada'
                              AND vc.fecha_hora < v_slot_end
                              AND vc.fecha_hora + (COALESCE(vc.duracion_minutos, v_dur) || ' minutes')::INTERVAL > v_slot_start
                        )
                        -- Check no bloqueo
                        AND NOT EXISTS (
                            SELECT 1 FROM ventas_calendario_bloqueos vb
                            WHERE vb.usuario_id = v_closer.cid
                              AND vb.fecha_inicio < v_slot_end
                              AND vb.fecha_fin > v_slot_start
                        )
                        -- Check no Google Calendar external event
                        AND NOT EXISTS (
                            SELECT 1 FROM ventas_google_events vge
                            WHERE vge.usuario_id = v_closer.cid
                              AND vge.status != 'cancelled'
                              AND vge.start_time < v_slot_end
                              AND vge.end_time > v_slot_start
                        )
                        THEN
                            fecha_hora := v_slot_start;
                            closer_id := v_closer.cid;
                            duracion := v_dur;
                            RETURN NEXT;
                        END IF;
                    END IF;

                    v_slot_start := v_slot_start + ((v_dur + v_desc) || ' minutes')::INTERVAL;
                END LOOP;
            END LOOP;

            v_fecha := v_fecha + 1;
        END LOOP;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_slots_disponibles(TEXT, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION obtener_slots_disponibles(TEXT, DATE, DATE) TO authenticated;

-- ── Actualizar crear_reserva_publica para comprobar Google events ─────────
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

    -- Verify slot is still available (citas)
    IF EXISTS (
        SELECT 1 FROM ventas_citas vc
        WHERE vc.closer_id = p_closer_id
          AND vc.estado != 'cancelada'
          AND vc.fecha_hora < p_fecha_hora + (v_duracion || ' minutes')::INTERVAL
          AND vc.fecha_hora + (COALESCE(vc.duracion_minutos, v_duracion) || ' minutes')::INTERVAL > p_fecha_hora
    ) THEN
        RAISE EXCEPTION 'Este horario ya no esta disponible';
    END IF;

    -- Verify slot is still available (Google Calendar events)
    IF EXISTS (
        SELECT 1 FROM ventas_google_events vge
        WHERE vge.usuario_id = p_closer_id
          AND vge.status != 'cancelled'
          AND vge.start_time < p_fecha_hora + (v_duracion || ' minutes')::INTERVAL
          AND vge.end_time > p_fecha_hora
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
