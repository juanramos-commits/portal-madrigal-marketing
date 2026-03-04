-- ============================================================================
-- 040 - Auto-mover leads a "Cita Realizada" cuando la cita ya ha pasado
-- + Mover lead según estado_reunion (No Show → ghosting)
-- ============================================================================

-- ─── 1. Función batch: procesar citas pasadas sin estado de reunión ─────────
-- Se llama desde el frontend al cargar el CRM/calendario.
-- Busca citas cuya fecha+duración ya pasó, estado='agendada', sin estado_reunion,
-- y mueve el lead a la etapa tipo 'cita_realizada' del pipeline de closers.

CREATE OR REPLACE FUNCTION ventas_procesar_citas_pasadas()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pipeline_closers_id UUID;
    v_etapa_cita_realizada_id UUID;
    v_count INTEGER := 0;
    v_cita RECORD;
BEGIN
    -- Buscar pipeline de closers
    SELECT id INTO v_pipeline_closers_id
    FROM ventas_pipelines WHERE nombre = 'Closers (Cierre)' LIMIT 1;

    IF v_pipeline_closers_id IS NULL THEN
        RETURN jsonb_build_object('ok', true, 'procesadas', 0, 'msg', 'No hay pipeline de closers');
    END IF;

    -- Buscar etapa tipo cita_realizada en ese pipeline
    SELECT id INTO v_etapa_cita_realizada_id
    FROM ventas_etapas
    WHERE pipeline_id = v_pipeline_closers_id AND tipo = 'cita_realizada' AND activo = true
    LIMIT 1;

    IF v_etapa_cita_realizada_id IS NULL THEN
        RETURN jsonb_build_object('ok', true, 'procesadas', 0, 'msg', 'No hay etapa cita_realizada');
    END IF;

    -- Procesar citas pasadas
    FOR v_cita IN
        SELECT c.id, c.lead_id
        FROM ventas_citas c
        WHERE c.estado = 'agendada'
          AND c.estado_reunion_id IS NULL
          AND c.fecha_hora + (COALESCE(c.duracion_minutos, 60) || ' minutes')::INTERVAL < now()
    LOOP
        -- Mover lead en pipeline closers a cita_realizada
        UPDATE ventas_lead_pipeline
        SET etapa_id = v_etapa_cita_realizada_id,
            fecha_entrada = now()
        WHERE lead_id = v_cita.lead_id
          AND pipeline_id = v_pipeline_closers_id
          -- Solo mover si no está ya en una etapa posterior (venta, lost, devolucion)
          AND etapa_id NOT IN (
              SELECT id FROM ventas_etapas
              WHERE pipeline_id = v_pipeline_closers_id
                AND tipo IN ('venta', 'lost', 'devolucion', 'cita_realizada')
          );

        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'procesadas', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION ventas_procesar_citas_pasadas() TO authenticated;


-- ─── 2. Trigger: al marcar estado_reunion → mover lead según resultado ──────
-- Realizada → cita_realizada (confirmar)
-- No Show → ghosting
-- Cancelada → ya manejado por trigger existente de cancelación

CREATE OR REPLACE FUNCTION trg_fn_mover_lead_por_estado_reunion()
RETURNS TRIGGER AS $$
DECLARE
    v_estado_nombre VARCHAR;
    v_pipeline_closers_id UUID;
    v_etapa_destino_id UUID;
    v_tipo_destino VARCHAR;
BEGIN
    BEGIN
        -- Solo cuando cambia estado_reunion_id
        IF NEW.estado_reunion_id IS NULL THEN
            RETURN NEW;
        END IF;
        IF OLD.estado_reunion_id IS NOT DISTINCT FROM NEW.estado_reunion_id THEN
            RETURN NEW;
        END IF;

        SELECT nombre INTO v_estado_nombre
        FROM ventas_reunion_estados WHERE id = NEW.estado_reunion_id;

        -- Determinar etapa destino según estado
        IF v_estado_nombre = 'Realizada' THEN
            v_tipo_destino := 'cita_realizada';
        ELSIF v_estado_nombre = 'No Show' THEN
            v_tipo_destino := 'ghosting';
        ELSE
            -- Cancelada u otros: no mover (ya tiene su propio trigger)
            RETURN NEW;
        END IF;

        SELECT id INTO v_pipeline_closers_id
        FROM ventas_pipelines WHERE nombre = 'Closers (Cierre)' LIMIT 1;

        IF v_pipeline_closers_id IS NULL THEN
            RETURN NEW;
        END IF;

        SELECT id INTO v_etapa_destino_id
        FROM ventas_etapas
        WHERE pipeline_id = v_pipeline_closers_id AND tipo = v_tipo_destino AND activo = true
        ORDER BY orden
        LIMIT 1;

        IF v_etapa_destino_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Mover lead (solo si no está en etapa final)
        UPDATE ventas_lead_pipeline
        SET etapa_id = v_etapa_destino_id,
            fecha_entrada = now()
        WHERE lead_id = NEW.lead_id
          AND pipeline_id = v_pipeline_closers_id
          AND etapa_id NOT IN (
              SELECT id FROM ventas_etapas
              WHERE pipeline_id = v_pipeline_closers_id
                AND tipo IN ('venta', 'lost', 'devolucion')
          );

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Trigger mover_lead_por_estado_reunion failed: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ventas_mover_lead_por_estado_reunion ON ventas_citas;
CREATE TRIGGER trg_ventas_mover_lead_por_estado_reunion
    AFTER UPDATE ON ventas_citas
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_mover_lead_por_estado_reunion();
