import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-process-message
 *
 * Motor principal del agente IA. Invocado por ia-whatsapp-webhook cuando
 * llega un mensaje y el chatbot está activo.
 *
 * 1. Carga contexto (agente, lead, conversación, historial)
 * 2. Llama a Claude Sonnet 4.6 con tool use
 * 3. Evalúa calidad con Haiku
 * 4. Aplica guardrails post-respuesta
 * 5. Calcula delay de timing inteligente
 * 6. Envía respuesta via ia-whatsapp-send
 * 7. Actualiza CRM, métricas, costes
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// TOOL DEFINITIONS for Claude
// ============================================================
const AGENT_TOOLS = [
  {
    name: 'think',
    description:
      'Usa esta herramienta para razonar internamente antes de responder. El lead NUNCA verá el contenido. Piensa en voz alta sobre: qué quiere el lead, cuál es el mejor siguiente paso, qué tono usar, si deberías proponer reunión, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        razonamiento: {
          type: 'string',
          description: 'Tu razonamiento interno',
        },
      },
      required: ['razonamiento'],
    },
  },
  {
    name: 'consultar_calendario',
    description:
      'Consulta la disponibilidad real del calendario para agendar reuniones. Devuelve los próximos slots disponibles. SIEMPRE usa esta herramienta antes de proponer fechas — NUNCA inventes horarios.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fecha_desde: {
          type: 'string',
          description: 'Fecha desde la que buscar slots (YYYY-MM-DD). Si no se especifica, busca desde mañana.',
        },
        dias_buscar: {
          type: 'number',
          description: 'Cuántos días hacia adelante buscar (default 5)',
        },
      },
    },
  },
  {
    name: 'reservar_cita',
    description:
      'Reserva una cita/reunión en el calendario. Solo usa esta herramienta cuando el lead haya confirmado explícitamente la fecha y hora. Nunca reserves sin confirmación.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fecha_hora: {
          type: 'string',
          description: 'Fecha y hora de la cita en formato ISO (YYYY-MM-DDTHH:MM:SS)',
        },
        nombre_lead: {
          type: 'string',
          description: 'Nombre del lead para la cita',
        },
        resumen: {
          type: 'string',
          description: 'Resumen muy corto para el closer (1-2 frases): servicio de interés, situación del negocio, objeciones superadas',
        },
      },
      required: ['fecha_hora', 'nombre_lead', 'resumen'],
    },
  },
  {
    name: 'consultar_base_conocimiento',
    description:
      'Busca información en la base de conocimiento de Madrigal Marketing (servicios, precios, casos de éxito, FAQ). Usa esta herramienta cuando el lead pregunte sobre servicios, precios, metodología o cualquier duda sobre la empresa.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'La pregunta o tema a buscar en la base de conocimiento',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'derivar_humano',
    description:
      'Deriva la conversación a un humano del equipo. Usa esto cuando: el lead pide explícitamente hablar con una persona, la situación se sale de tu capacidad, el lead está muy frustrado, o hay una consulta técnica/legal que no puedes resolver.',
    input_schema: {
      type: 'object' as const,
      properties: {
        motivo: {
          type: 'string',
          description: 'Por qué se deriva (para que el humano tenga contexto)',
        },
        urgente: {
          type: 'boolean',
          description: 'Si es urgente y necesita atención inmediata',
        },
      },
      required: ['motivo'],
    },
  },
]

// ============================================================
// TOOL EXECUTION
// ============================================================
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: {
    supabase: ReturnType<typeof createClient>
    agente: Record<string, unknown>
    lead: Record<string, unknown>
    convo: Record<string, unknown>
  },
): Promise<string> {
  const { supabase, agente, lead, convo } = context

  switch (toolName) {
    case 'think': {
      // The scratchpad content is returned but never sent to the lead
      return `[Razonamiento registrado]`
    }

    case 'consultar_calendario': {
      const fechaDesde = (toolInput.fecha_desde as string) ||
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const diasBuscar = (toolInput.dias_buscar as number) || 5

      try {
        // Use the portal's existing booking system
        // Find the agent's enlace_agenda or query disponibilidad directly
        const { data: slots, error } = await supabase.rpc(
          'obtener_slots_disponibles_agente',
          {
            p_agente_usuario_id: agente.usuario_id,
            p_fecha_desde: fechaDesde,
            p_dias: diasBuscar,
          },
        )

        if (error) {
          // Fallback: query disponibilidad directly
          const { data: disps } = await supabase
            .from('ventas_calendario_disponibilidad')
            .select('*')
            .eq('usuario_id', agente.usuario_id)
            .order('dia_semana')

          if (!disps || disps.length === 0) {
            return 'No hay disponibilidad configurada en el calendario. Deriva a un humano para agendar.'
          }

          // Build available slots from disponibilidad
          const slotsText = disps.map((d: Record<string, unknown>) => {
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
            return `${dias[d.dia_semana as number]}: ${d.hora_inicio} - ${d.hora_fin}`
          }).join('\n')

          return `Disponibilidad general del calendario:\n${slotsText}\n\nPropón horarios dentro de estos rangos para los próximos días laborables.`
        }

        if (!slots || slots.length === 0) {
          return 'No hay slots disponibles en los próximos días. Sugiere al lead que espere o contacte directamente.'
        }

        // Format slots for the agent
        const formatted = slots.map((s: Record<string, string>) =>
          `${s.fecha} a las ${s.hora} (${s.duracion}min)`,
        ).join('\n')

        return `Slots disponibles:\n${formatted}\n\nPropón 2-3 opciones al lead de forma natural, no como una lista.`
      } catch (err) {
        return `Error consultando calendario: ${err}. Deriva a un humano si el lead quiere agendar.`
      }
    }

    case 'reservar_cita': {
      const fechaHora = toolInput.fecha_hora as string
      const nombreLead = toolInput.nombre_lead as string
      const resumen = toolInput.resumen as string

      try {
        // Create cita in ventas_citas (like the portal's booking system)
        // First, find an available closer
        const { data: closers } = await supabase
          .from('ventas_roles_comerciales')
          .select('usuario_id')
          .eq('rol', 'closer')
          .limit(5)

        if (!closers || closers.length === 0) {
          return 'Error: no hay closers disponibles. Informa al lead que le confirmarás la cita por email.'
        }

        // Pick closer with fewest upcoming citas (load balancing)
        let selectedCloserId = closers[0].usuario_id
        let minCitas = Infinity

        for (const c of closers) {
          const { count } = await supabase
            .from('ventas_citas')
            .select('id', { count: 'exact', head: true })
            .eq('closer_id', c.usuario_id)
            .eq('estado', 'agendada')
            .gte('fecha_hora', new Date().toISOString())

          if ((count || 0) < minCitas) {
            minCitas = count || 0
            selectedCloserId = c.usuario_id
          }
        }

        // Create the cita
        const { data: cita, error: citaErr } = await supabase
          .from('ventas_citas')
          .insert({
            lead_id: lead.crm_lead_id || null,
            closer_id: selectedCloserId,
            setter_origen_id: agente.usuario_id,
            fecha_hora: fechaHora,
            duracion_minutos: 60,
            estado: 'agendada',
            origen_agendacion: 'agente_ia',
            notas_closer: resumen,
          })
          .select()
          .single()

        if (citaErr) {
          return `Error al reservar: ${citaErr.message}. Disculpa y propón otra hora.`
        }

        // Update CRM lead if linked
        if (lead.crm_lead_id) {
          // Update resumen_setter
          await supabase
            .from('ventas_leads')
            .update({
              resumen_setter: resumen,
              closer_asignado_id: selectedCloserId,
            })
            .eq('id', lead.crm_lead_id)

          // Log activity
          await supabase.from('ventas_actividad').insert({
            lead_id: lead.crm_lead_id,
            usuario_id: agente.usuario_id,
            tipo: 'cita_agendada',
            descripcion: `Cita agendada por agente IA para ${fechaHora}`,
          })
        }

        // Update conversation
        await supabase
          .from('ia_conversaciones')
          .update({ estado: 'agendado' })
          .eq('id', convo.id)

        // Get closer name for the response
        const { data: closerUser } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('id', selectedCloserId)
          .single()

        const closerName = closerUser?.nombre || 'nuestro equipo'

        return `Cita reservada correctamente para ${fechaHora} con ${closerName}. Confirma al lead que recibirá los detalles.`
      } catch (err) {
        return `Error reservando cita: ${err}. Informa al lead que lo gestionarás manualmente.`
      }
    }

    case 'consultar_base_conocimiento': {
      const query = toolInput.query as string

      try {
        // Use OpenAI embeddings for RAG search (existing vector store)
        const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
        if (!openaiKey) {
          return 'Base de conocimiento no disponible. Responde con lo que sepas del prompt.'
        }

        // Generate embedding for the query
        const embRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query,
          }),
        })
        const embData = await embRes.json()
        const embedding = embData.data?.[0]?.embedding

        if (!embedding) {
          return 'Error generando embedding. Responde con lo que sepas del prompt.'
        }

        // Search in vector store
        const { data: docs, error } = await supabase.rpc(
          'match_documents_rosalia',
          {
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: 3,
          },
        )

        if (error || !docs || docs.length === 0) {
          return 'No encontré información relevante en la base de conocimiento para esta consulta. Responde con lo que sepas del prompt o sugiere que contacte al equipo para más detalles.'
        }

        const context = docs
          .map((d: Record<string, unknown>) => d.content)
          .join('\n\n---\n\n')

        return `Información encontrada en la base de conocimiento:\n\n${context}\n\nUsa esta información para responder de forma natural y conversacional. NO copies texto literalmente, parafrasea.`
      } catch (err) {
        return `Error consultando base de conocimiento: ${err}`
      }
    }

    case 'derivar_humano': {
      const motivo = toolInput.motivo as string
      const urgente = (toolInput.urgente as boolean) || false

      // Deactivate bot, set handoff
      await supabase
        .from('ia_conversaciones')
        .update({
          chatbot_activo: false,
          handoff_humano: true,
          estado: 'handoff_humano',
        })
        .eq('id', convo.id)

      // Create supervisor alert
      await supabase.from('ia_alertas_supervisor').insert({
        agente_id: agente.id,
        conversacion_id: convo.id,
        tipo: urgente ? 'lead_caliente_sin_respuesta' : 'bot_bloqueado',
        mensaje: `Derivación a humano: ${motivo}`,
        leida: false,
      })

      return `Conversación derivada a humano. Motivo: ${motivo}. ${urgente ? 'URGENTE.' : ''} Despídete amablemente diciendo que un compañero del equipo se pondrá en contacto.`
    }

    default:
      return `Herramienta desconocida: ${toolName}`
  }
}

// ============================================================
// GUARDRAILS POST-RESPONSE
// ============================================================
function checkGuardrails(responseText: string): {
  pass: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check if mentions being AI/bot
  const aiMentions = [
    'soy una ia', 'soy un bot', 'soy inteligencia artificial',
    'como ia', 'como bot', 'soy una máquina', 'soy una maquina',
    'no soy humana', 'no soy humano', 'no soy una persona',
    'i am an ai', 'i am a bot', 'artificial intelligence',
    'language model', 'modelo de lenguaje',
  ]
  for (const mention of aiMentions) {
    if (responseText.toLowerCase().includes(mention)) {
      issues.push(`Menciona ser IA: "${mention}"`)
    }
  }

  // Check if too long (WhatsApp messages should be short)
  if (responseText.length > 800) {
    issues.push(`Mensaje demasiado largo: ${responseText.length} chars (max 800)`)
  }

  // Check for forbidden info patterns
  const forbidden = [
    /contraseña|password/i,
    /tarjeta de crédito|credit card/i,
    /número de cuenta|account number/i,
  ]
  for (const pattern of forbidden) {
    if (pattern.test(responseText)) {
      issues.push(`Información prohibida detectada: ${pattern}`)
    }
  }

  return {
    pass: issues.length === 0,
    issues,
  }
}

// ============================================================
// QUALITY EVALUATION (Haiku)
// ============================================================
async function evaluateQuality(
  responseText: string,
  leadMessage: string,
  conversationContext: string,
  anthropicKey: string,
): Promise<{ score: number; feedback: string }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Evalúa esta respuesta de un setter comercial por WhatsApp. Puntúa del 1 al 10.

Contexto de la conversación:
${conversationContext}

Mensaje del lead:
${leadMessage}

Respuesta del setter:
${responseText}

Criterios:
- ¿Suena natural y humano? (no robótico)
- ¿Es apropiada para la situación?
- ¿Avanza la conversación hacia agendar?
- ¿Es demasiado larga o corta?
- ¿Revela que es IA?

Responde SOLO en este formato JSON:
{"score": N, "feedback": "..."}`,
          },
        ],
      }),
    })

    if (!res.ok) return { score: 7, feedback: 'Quality check unavailable' }
    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    try {
      const parsed = JSON.parse(text)
      return {
        score: Math.min(10, Math.max(1, parsed.score || 7)),
        feedback: parsed.feedback || '',
      }
    } catch {
      return { score: 7, feedback: 'Could not parse quality response' }
    }
  } catch {
    return { score: 7, feedback: 'Quality check failed' }
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const conversacionId = params.conversacion_id as string
  const agenteId = params.agente_id as string
  const leadId = params.lead_id as string
  const messageContent = params.message_content as string
  const messageType = params.message_type as string

  if (!conversacionId || !agenteId || !leadId) {
    return jsonResponse({ error: 'Missing required params' }, 400)
  }

  try {
    // === LOAD CONTEXT ===
    const [agenteRes, leadRes, convoRes] = await Promise.all([
      supabase.from('ia_agentes').select('*').eq('id', agenteId).single(),
      supabase.from('ia_leads').select('*').eq('id', leadId).single(),
      supabase.from('ia_conversaciones').select('*').eq('id', conversacionId).single(),
    ])

    const agente = agenteRes.data
    const lead = leadRes.data
    const convo = convoRes.data

    if (!agente || !lead || !convo) {
      return jsonResponse({ error: 'Context not found' }, 404)
    }

    // Load conversation history (last 30 messages)
    const { data: history } = await supabase
      .from('ia_mensajes')
      .select('direction, sender, content, message_type, transcription, created_at')
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true })
      .limit(30)

    // Build messages for Claude
    const historyMessages = (history || []).map((m: Record<string, unknown>) => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.transcription
        ? `${m.content}\n[Transcripción: ${m.transcription}]`
        : (m.content as string),
    }))

    // Select system prompt (A/B test)
    let systemPrompt = agente.system_prompt || ''
    if (agente.ab_test_activo && agente.system_prompt_b) {
      if (convo.ab_version === 'B') {
        systemPrompt = agente.system_prompt_b
      }
    }

    // Add context to system prompt
    const contextAddendum = `

--- CONTEXTO ACTUAL ---
Nombre del lead: ${lead.nombre || 'Desconocido'}
Teléfono: ${lead.telefono}
Lead score: ${lead.lead_score || 0}/100
Sentimiento actual: ${lead.sentimiento_actual || 'neutro'}
Servicio de interés: ${lead.servicio || 'No especificado'}
Estado conversación: ${convo.estado}
Step actual: ${convo.step}
Resumen conversación: ${convo.resumen || 'Sin resumen previo'}
Fecha/hora actual: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
`

    const fullSystemPrompt = systemPrompt + contextAddendum

    // === CALL CLAUDE SONNET 4.6 ===
    let claudeMessages = [...historyMessages]

    // Ensure last message is from user
    if (claudeMessages.length === 0 || claudeMessages[claudeMessages.length - 1].role !== 'user') {
      claudeMessages.push({ role: 'user', content: messageContent })
    }

    let finalResponse = ''
    let tokensIn = 0
    let tokensOut = 0
    let toolCalls = 0
    const maxIterations = 5 // Max tool-use rounds

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6-20250514',
          max_tokens: 1024,
          system: fullSystemPrompt,
          tools: AGENT_TOOLS,
          messages: claudeMessages,
        }),
      })

      if (!claudeRes.ok) {
        const errText = await claudeRes.text()
        throw new Error(`Claude API error: ${claudeRes.status} ${errText}`)
      }

      const claudeData = await claudeRes.json()
      tokensIn += claudeData.usage?.input_tokens || 0
      tokensOut += claudeData.usage?.output_tokens || 0

      const stopReason = claudeData.stop_reason

      // Extract text and tool_use blocks
      const contentBlocks = claudeData.content || []
      const textBlocks = contentBlocks.filter((b: Record<string, unknown>) => b.type === 'text')
      const toolUseBlocks = contentBlocks.filter((b: Record<string, unknown>) => b.type === 'tool_use')

      // If there's a text response
      if (textBlocks.length > 0) {
        finalResponse = textBlocks.map((b: Record<string, string>) => b.text).join('')
      }

      // If Claude wants to use tools
      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        // Add assistant message with all content blocks
        claudeMessages.push({ role: 'assistant', content: contentBlocks })

        // Execute each tool and collect results
        const toolResults: Array<Record<string, unknown>> = []

        for (const toolBlock of toolUseBlocks) {
          toolCalls++
          const toolResult = await executeTool(
            toolBlock.name as string,
            toolBlock.input as Record<string, unknown>,
            { supabase, agente, lead, convo },
          )

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: toolResult,
          })

          // Log tool call
          await supabase.from('ia_logs').insert({
            agente_id: agenteId,
            conversacion_id: conversacionId,
            tipo: 'ai_call',
            mensaje: `Tool: ${toolBlock.name}`,
            detalles: {
              tool_name: toolBlock.name,
              tool_input: toolBlock.input,
              tool_result: toolResult.substring(0, 500),
            },
          })
        }

        // Add tool results to messages
        claudeMessages.push({ role: 'user', content: toolResults })

        // Continue the loop to get Claude's final response
        continue
      }

      // If end_turn or no more tools, we're done
      break
    }

    if (!finalResponse) {
      throw new Error('No response generated from Claude')
    }

    // === GUARDRAILS POST-RESPONSE ===
    const guardrails = checkGuardrails(finalResponse)

    if (!guardrails.pass) {
      // Log guardrail failure
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'warning',
        mensaje: `Guardrails failed: ${guardrails.issues.join(', ')}`,
        detalles: { original_response: finalResponse, issues: guardrails.issues },
      })

      // If mentions AI → derivar
      if (guardrails.issues.some(i => i.includes('IA'))) {
        await executeTool('derivar_humano', {
          motivo: 'Bot intentó revelar que es IA',
          urgente: true,
        }, { supabase, agente, lead, convo })
        return jsonResponse({ status: 'blocked', reason: 'guardrails' })
      }

      // If too long → truncate
      if (finalResponse.length > 800) {
        finalResponse = finalResponse.substring(0, 750) + '...'
      }
    }

    // === QUALITY EVALUATION (HAIKU) ===
    const qualityThreshold = agente.config?.umbral_calidad_minima || 6
    let qualityScore = 7
    let qualityFeedback = ''

    if (anthropicKey) {
      const contextSummary = (history || [])
        .slice(-5)
        .map((m: Record<string, unknown>) =>
          `${m.direction === 'inbound' ? 'Lead' : 'Bot'}: ${(m.content as string).substring(0, 100)}`,
        )
        .join('\n')

      const quality = await evaluateQuality(
        finalResponse,
        messageContent,
        contextSummary,
        anthropicKey,
      )
      qualityScore = quality.score
      qualityFeedback = quality.feedback

      // Log Haiku cost
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('ia_costes').upsert(
        {
          agente_id: agenteId,
          fecha: today,
          haiku_calls: 1,
          haiku_coste: 0.001,
        },
        { onConflict: 'agente_id,fecha' },
      )
    }

    // If quality too low → derivar
    if (qualityScore < qualityThreshold) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'quality_check',
        mensaje: `Calidad baja (${qualityScore}/${qualityThreshold}): ${qualityFeedback}`,
        detalles: { score: qualityScore, feedback: qualityFeedback, response: finalResponse },
      })

      await supabase.from('ia_alertas_supervisor').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'calidad_baja',
        mensaje: `Respuesta bloqueada por calidad baja (${qualityScore}/10): ${qualityFeedback}`,
        leida: false,
      })

      // Derivar a humano
      await executeTool('derivar_humano', {
        motivo: `Calidad de respuesta baja (${qualityScore}/10)`,
        urgente: false,
      }, { supabase, agente, lead, convo })

      return jsonResponse({ status: 'blocked', reason: 'quality_low', score: qualityScore })
    }

    // === TIMING INTELIGENTE ===
    // Calculate delay to seem human (15s-3min)
    const baseDelay = 15000 // 15s minimum
    const messageLength = finalResponse.length
    // ~50ms per char (reading time simulation)
    const readingTime = messageContent.length * 50
    // ~30ms per char (typing time simulation)
    const typingTime = messageLength * 30
    // Random variance ±30%
    const variance = 0.7 + Math.random() * 0.6
    let delay = Math.max(baseDelay, (readingTime + typingTime) * variance)
    delay = Math.min(delay, 180000) // Max 3 minutes

    // During qualification step, respond faster
    if (convo.step === 'first_message' || convo.step === 'qualify') {
      delay = Math.min(delay, 60000)
    }

    await sleep(delay)

    // === SEND RESPONSE ===
    // Split long messages into multiple (WhatsApp-style)
    const messageParts: string[] = []
    if (finalResponse.length > 400) {
      // Split at sentence boundaries
      const sentences = finalResponse.match(/[^.!?]+[.!?]+/g) || [finalResponse]
      let currentPart = ''

      for (const sentence of sentences) {
        if ((currentPart + sentence).length > 350 && currentPart) {
          messageParts.push(currentPart.trim())
          currentPart = sentence
        } else {
          currentPart += sentence
        }
      }
      if (currentPart.trim()) messageParts.push(currentPart.trim())
    } else {
      messageParts.push(finalResponse)
    }

    // Send via ia-whatsapp-send
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/ia-whatsapp-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        to: lead.telefono,
        sender: 'bot',
        messages: messageParts.map(text => ({ type: 'text', content: text })),
      }),
    })

    const sendResult = await sendRes.json()

    // === UPDATE CONVERSATION STATE ===
    const convoUpdates: Record<string, unknown> = {
      last_bot_message_at: new Date().toISOString(),
    }

    // Update resumen (executive summary)
    const newResumen = `${convo.resumen || ''}${convo.resumen ? ' | ' : ''}[${new Date().toLocaleDateString('es-ES')}] Lead: "${messageContent.substring(0, 50)}..." → Bot: "${finalResponse.substring(0, 50)}..."`
    if (newResumen.length < 2000) {
      convoUpdates.resumen = newResumen
    }

    await supabase
      .from('ia_conversaciones')
      .update(convoUpdates)
      .eq('id', conversacionId)

    // Store quality score on the outbound message
    if (qualityScore) {
      const { data: lastMsg } = await supabase
        .from('ia_mensajes')
        .select('id')
        .eq('conversacion_id', conversacionId)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastMsg) {
        await supabase
          .from('ia_mensajes')
          .update({ calidad_score: qualityScore })
          .eq('id', lastMsg.id)
      }
    }

    // === LOG COSTS ===
    const today = new Date().toISOString().split('T')[0]
    // Claude Sonnet 4.6 pricing: ~$3/MTok in, ~$15/MTok out
    const claudeCost = (tokensIn * 3 + tokensOut * 15) / 1_000_000

    await supabase.from('ia_costes').upsert(
      {
        agente_id: agenteId,
        fecha: today,
        claude_calls: 1,
        claude_tokens_in: tokensIn,
        claude_tokens_out: tokensOut,
        claude_coste: claudeCost,
      },
      { onConflict: 'agente_id,fecha' },
    )

    // === UPDATE METRICS ===
    await supabase.from('ia_metricas_diarias').upsert(
      {
        agente_id: agenteId,
        fecha: today,
        ab_version: convo.ab_version || 'A',
        mensajes_enviados: messageParts.length,
        mensajes_recibidos: 1,
        score_calidad_promedio: qualityScore,
      },
      { onConflict: 'agente_id,fecha,ab_version' },
    )

    // === LOG ===
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'ai_call',
      mensaje: `Respuesta generada (quality: ${qualityScore}/10, delay: ${Math.round(delay / 1000)}s, tools: ${toolCalls})`,
      detalles: {
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        quality_score: qualityScore,
        quality_feedback: qualityFeedback,
        delay_ms: delay,
        tool_calls: toolCalls,
        response_parts: messageParts.length,
        guardrails_issues: guardrails.issues,
      },
    })

    return jsonResponse({
      status: 'ok',
      quality_score: qualityScore,
      response_parts: messageParts.length,
      delay_ms: delay,
    })
  } catch (err) {
    console.error('Error processing message:', err)

    // === FALLBACK: Alert team ===
    await supabase.from('ia_alertas_supervisor').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'error',
      mensaje: `Error procesando mensaje: ${err}`,
      leida: false,
    })

    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'error',
      mensaje: `Error en ia-process-message: ${err}`,
      detalles: { error: String(err), stack: (err as Error).stack },
    })

    return jsonResponse({ error: 'Processing failed', details: String(err) }, 500)
  }
})
