-- =====================================================
-- Agentes IA — RPCs para Edge Functions
-- =====================================================

-- RPC: Incrementar costes atómicamente (evita race conditions)
CREATE OR REPLACE FUNCTION ia_increment_costes(
  p_agente_id UUID,
  p_fecha DATE,
  p_claude_calls INT DEFAULT 0,
  p_claude_tokens_in INT DEFAULT 0,
  p_claude_tokens_out INT DEFAULT 0,
  p_claude_coste NUMERIC DEFAULT 0,
  p_haiku_calls INT DEFAULT 0,
  p_haiku_coste NUMERIC DEFAULT 0,
  p_whisper_calls INT DEFAULT 0,
  p_whisper_coste NUMERIC DEFAULT 0,
  p_gpt4o_calls INT DEFAULT 0,
  p_gpt4o_coste NUMERIC DEFAULT 0,
  p_whatsapp_mensajes INT DEFAULT 0,
  p_whatsapp_coste NUMERIC DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ia_costes (
    agente_id, fecha,
    claude_calls, claude_tokens_in, claude_tokens_out, claude_coste,
    haiku_calls, haiku_coste,
    whisper_calls, whisper_coste,
    gpt4o_calls, gpt4o_coste,
    whatsapp_mensajes, whatsapp_coste
  ) VALUES (
    p_agente_id, p_fecha,
    p_claude_calls, p_claude_tokens_in, p_claude_tokens_out, p_claude_coste,
    p_haiku_calls, p_haiku_coste,
    p_whisper_calls, p_whisper_coste,
    p_gpt4o_calls, p_gpt4o_coste,
    p_whatsapp_mensajes, p_whatsapp_coste
  )
  ON CONFLICT (agente_id, fecha) DO UPDATE SET
    claude_calls = ia_costes.claude_calls + EXCLUDED.claude_calls,
    claude_tokens_in = ia_costes.claude_tokens_in + EXCLUDED.claude_tokens_in,
    claude_tokens_out = ia_costes.claude_tokens_out + EXCLUDED.claude_tokens_out,
    claude_coste = ia_costes.claude_coste + EXCLUDED.claude_coste,
    haiku_calls = ia_costes.haiku_calls + EXCLUDED.haiku_calls,
    haiku_coste = ia_costes.haiku_coste + EXCLUDED.haiku_coste,
    whisper_calls = ia_costes.whisper_calls + EXCLUDED.whisper_calls,
    whisper_coste = ia_costes.whisper_coste + EXCLUDED.whisper_coste,
    gpt4o_calls = ia_costes.gpt4o_calls + EXCLUDED.gpt4o_calls,
    gpt4o_coste = ia_costes.gpt4o_coste + EXCLUDED.gpt4o_coste,
    whatsapp_mensajes = ia_costes.whatsapp_mensajes + EXCLUDED.whatsapp_mensajes,
    whatsapp_coste = ia_costes.whatsapp_coste + EXCLUDED.whatsapp_coste;
END;
$$;

-- RPC: Incrementar métricas diarias atómicamente
CREATE OR REPLACE FUNCTION ia_increment_metricas(
  p_agente_id UUID,
  p_fecha DATE,
  p_ab_version TEXT DEFAULT 'A',
  p_leads_contactados INT DEFAULT 0,
  p_respuestas_recibidas INT DEFAULT 0,
  p_reuniones_agendadas INT DEFAULT 0,
  p_leads_descartados INT DEFAULT 0,
  p_mensajes_enviados INT DEFAULT 0,
  p_mensajes_recibidos INT DEFAULT 0,
  p_objeciones_detectadas INT DEFAULT 0,
  p_objeciones_resueltas INT DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ia_metricas_diarias (
    agente_id, fecha, ab_version,
    leads_contactados, respuestas_recibidas, reuniones_agendadas,
    leads_descartados, mensajes_enviados, mensajes_recibidos,
    objeciones_detectadas, objeciones_resueltas
  ) VALUES (
    p_agente_id, p_fecha, p_ab_version,
    p_leads_contactados, p_respuestas_recibidas, p_reuniones_agendadas,
    p_leads_descartados, p_mensajes_enviados, p_mensajes_recibidos,
    p_objeciones_detectadas, p_objeciones_resueltas
  )
  ON CONFLICT (agente_id, fecha, ab_version) DO UPDATE SET
    leads_contactados = ia_metricas_diarias.leads_contactados + EXCLUDED.leads_contactados,
    respuestas_recibidas = ia_metricas_diarias.respuestas_recibidas + EXCLUDED.respuestas_recibidas,
    reuniones_agendadas = ia_metricas_diarias.reuniones_agendadas + EXCLUDED.reuniones_agendadas,
    leads_descartados = ia_metricas_diarias.leads_descartados + EXCLUDED.leads_descartados,
    mensajes_enviados = ia_metricas_diarias.mensajes_enviados + EXCLUDED.mensajes_enviados,
    mensajes_recibidos = ia_metricas_diarias.mensajes_recibidos + EXCLUDED.mensajes_recibidos,
    objeciones_detectadas = ia_metricas_diarias.objeciones_detectadas + EXCLUDED.objeciones_detectadas,
    objeciones_resueltas = ia_metricas_diarias.objeciones_resueltas + EXCLUDED.objeciones_resueltas;
END;
$$;

-- RPC: Obtener slots disponibles para un agente IA
CREATE OR REPLACE FUNCTION obtener_slots_disponibles_agente(
  p_agente_usuario_id UUID,
  p_fecha_desde DATE DEFAULT CURRENT_DATE + 1,
  p_dias INT DEFAULT 5
) RETURNS TABLE (
  fecha TEXT,
  hora TEXT,
  duracion INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fecha DATE;
  v_dia_semana INT;
  v_slot RECORD;
  v_duracion INT := 60;
  v_descanso INT := 15;
  v_hora_slot TIME;
  v_hora_fin TIME;
  v_conflicto BOOLEAN;
BEGIN
  -- Get closer config if exists
  SELECT
    COALESCE(cc.duracion_slot_minutos, 60),
    COALESCE(cc.descanso_entre_citas_minutos, 15)
  INTO v_duracion, v_descanso
  FROM ventas_calendario_config cc
  WHERE cc.usuario_id = p_agente_usuario_id
  LIMIT 1;

  -- Look through each day
  FOR i IN 0..p_dias - 1 LOOP
    v_fecha := p_fecha_desde + i;
    v_dia_semana := EXTRACT(DOW FROM v_fecha)::INT;

    -- Get availability for this day of week
    FOR v_slot IN
      SELECT hora_inicio, hora_fin
      FROM ventas_calendario_disponibilidad
      WHERE usuario_id = p_agente_usuario_id
        AND dia_semana = v_dia_semana
      ORDER BY hora_inicio
    LOOP
      v_hora_slot := v_slot.hora_inicio;
      v_hora_fin := v_slot.hora_fin;

      -- Generate slots within this availability window
      WHILE v_hora_slot + (v_duracion || ' minutes')::INTERVAL <= v_hora_fin LOOP
        -- Check for conflicts with existing citas
        SELECT EXISTS(
          SELECT 1 FROM ventas_citas vc
          WHERE vc.closer_id = p_agente_usuario_id
            AND vc.estado = 'agendada'
            AND vc.fecha_hora::DATE = v_fecha
            AND vc.fecha_hora::TIME < v_hora_slot + (v_duracion || ' minutes')::INTERVAL
            AND (vc.fecha_hora + (vc.duracion_minutos || ' minutes')::INTERVAL)::TIME > v_hora_slot
        ) INTO v_conflicto;

        -- Also check Google Calendar blocks
        IF NOT v_conflicto THEN
          SELECT EXISTS(
            SELECT 1 FROM ventas_calendario_bloqueos vb
            WHERE vb.usuario_id = p_agente_usuario_id
              AND v_fecha BETWEEN vb.fecha_inicio::DATE AND vb.fecha_fin::DATE
              AND (
                vb.todo_el_dia = true
                OR (
                  vb.fecha_inicio::TIME < v_hora_slot + (v_duracion || ' minutes')::INTERVAL
                  AND vb.fecha_fin::TIME > v_hora_slot
                )
              )
          ) INTO v_conflicto;
        END IF;

        IF NOT v_conflicto THEN
          -- Check minimum lead time (at least 1 hour from now)
          IF v_fecha > CURRENT_DATE OR (v_fecha = CURRENT_DATE AND v_hora_slot > (CURRENT_TIME + INTERVAL '1 hour')) THEN
            fecha := v_fecha::TEXT;
            hora := v_hora_slot::TEXT;
            duracion := v_duracion;
            RETURN NEXT;
          END IF;
        END IF;

        v_hora_slot := v_hora_slot + ((v_duracion + v_descanso) || ' minutes')::INTERVAL;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

-- RPC: Match documents for RAG (requires pgvector extension)
-- Only create if vector type is available
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION match_documents_rosalia(
        query_embedding VECTOR(1536),
        match_threshold FLOAT DEFAULT 0.7,
        match_count INT DEFAULT 3
      ) RETURNS TABLE (
        id UUID,
        content TEXT,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      BEGIN
        RETURN QUERY
        SELECT
          d.id,
          d.content,
          1 - (d.embedding <=> query_embedding) AS similarity
        FROM documentos_madrigal_marketing_rosalia d
        WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
        ORDER BY d.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $body$;
    $fn$;
  END IF;
END $$;
