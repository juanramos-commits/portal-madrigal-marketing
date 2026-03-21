-- ============================================================================
-- 045 - Optimizar obtener_slots_disponibles:
--   1. Parar tras encontrar 5 dias distintos con disponibilidad
--   2. Lead time minimo de 4 horas (antes 1h)
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION obtener_slots_disponibles(
    p_slug        TEXT,
    p_fecha_desde DATE DEFAULT CURRENT_DATE,
    p_fecha_hasta DATE DEFAULT (CURRENT_DATE + INTERVAL '60 days')::DATE
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
    v_dias_con_slots INTEGER := 0;
    v_ultimo_dia_con_slot DATE := NULL;
    v_max_dias   INTEGER := 5;
    v_leadtime   INTERVAL := INTERVAL '4 hours';
BEGIN
    -- Resolve slug
    SELECT ea.id, ea.activo INTO v_enlace_id, v_activo
    FROM ventas_enlaces_agenda ea
    WHERE ea.slug = p_slug;

    IF NOT FOUND OR NOT v_activo THEN
        RETURN;
    END IF;

    -- Iterate day by day (outer loop) so we can count distinct days and stop early
    v_fecha := p_fecha_desde;
    WHILE v_fecha <= p_fecha_hasta AND v_dias_con_slots < v_max_dias LOOP
        DECLARE
            v_dia_tiene_slot BOOLEAN := false;
        BEGIN
            v_dia := EXTRACT(ISODOW FROM v_fecha)::INTEGER - 1;

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

                        -- Skip past slots (with 4h minimum lead time)
                        IF v_slot_start > NOW() + v_leadtime THEN
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
                                v_dia_tiene_slot := true;
                            END IF;
                        END IF;

                        v_slot_start := v_slot_start + ((v_dur + v_desc) || ' minutes')::INTERVAL;
                    END LOOP;
                END LOOP;
            END LOOP;

            -- Count this day if it had at least one slot
            IF v_dia_tiene_slot THEN
                v_dias_con_slots := v_dias_con_slots + 1;
            END IF;
        END;

        v_fecha := v_fecha + 1;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_slots_disponibles(TEXT, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION obtener_slots_disponibles(TEXT, DATE, DATE) TO authenticated;

COMMIT;
