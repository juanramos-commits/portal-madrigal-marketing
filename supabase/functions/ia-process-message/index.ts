import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * ia-process-message
 *
 * Motor principal del agente IA. Invocado por ia-whatsapp-webhook cuando
 * llega un mensaje y el chatbot está activo.
 *
 * 1. Acquires processing lock (prevents race conditions)
 * 2. Carga contexto (agente, lead, conversación, historial)
 * 3. Detecta sentimiento, objeciones, lead scoring
 * 4. Llama a Claude Sonnet 4.6 con tool use (retries on failure)
 * 5. Evalúa calidad con Haiku
 * 6. Aplica guardrails post-respuesta
 * 7. Envía respuesta via ia-whatsapp-send
 * 8. Actualiza resumen con IA, métricas, costes, CRM sync
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

// Get current Madrid date string
function getMadridDate(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(new Date()) // YYYY-MM-DD
}

function getMadridDateTime(): string {
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'full',
    timeStyle: 'short',
  })
  return fmt.format(new Date())
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
// PROCESSING LOCK (prevents race conditions on concurrent messages)
// ============================================================
async function acquireLock(
  supabase: ReturnType<typeof createClient>,
  conversacionId: string,
): Promise<boolean> {
  // Atomic: only succeeds if no lock or lock expired (>60s old)
  const { data, error } = await supabase.rpc('ia_acquire_processing_lock', {
    p_conversacion_id: conversacionId,
    p_lock_timeout_seconds: 60,
  })
  if (error) {
    // Fallback: try direct update with a condition
    const lockTime = new Date().toISOString()
    const expiredTime = new Date(Date.now() - 60000).toISOString()
    const { data: updated, error: updateErr } = await supabase
      .from('ia_conversaciones')
      .update({ processing_lock_at: lockTime })
      .eq('id', conversacionId)
      .or(`processing_lock_at.is.null,processing_lock_at.lt.${expiredTime}`)
      .select('id')

    return !updateErr && updated && updated.length > 0
  }
  return data === true
}

async function releaseLock(
  supabase: ReturnType<typeof createClient>,
  conversacionId: string,
): Promise<void> {
  await supabase
    .from('ia_conversaciones')
    .update({ processing_lock_at: null })
    .eq('id', conversacionId)
}

// ============================================================
// SENTIMENT ANALYSIS
// ============================================================
function analyzeSentiment(text: string): string {
  const lower = text.toLowerCase()

  const urgentPatterns = /urgente|cuanto antes|ya mismo|necesito ya|hoy mismo|lo antes posible|esta semana/
  const frustratedPatterns = /harto|hasta las narices|mala experiencia|fatal|horrible|pesados|dejadme|no funciona nada|estafa|timo|spam/
  const negativePatterns = /no me interesa|muy caro|no creo|paso|nah|pfff|bah|no gracias|no quiero|dejadme en paz/
  const positivePatterns = /genial|perfecto|me encanta|suena bien|interesante|me gusta|vale|ok|guay|de acuerdo|me apunto|claro|por supuesto|venga|adelante|dale|vamos|buena idea|mola/
  const interestedPatterns = /cuéntame|cuentame|quiero saber|cómo funciona|como funciona|qué ofrecéis|que ofreceis|precio|cuánto|cuanto cuesta|en qué consiste|que haceis|como trabajais|me interesa|dime más|dimelo|explícame|explicame/

  if (urgentPatterns.test(lower)) return 'urgente'
  if (frustratedPatterns.test(lower)) return 'frustrado'
  if (negativePatterns.test(lower)) return 'negativo'
  if (interestedPatterns.test(lower)) return 'interesado'
  if (positivePatterns.test(lower)) return 'positivo'
  return 'neutro'
}

// ============================================================
// LEAD SCORING
// ============================================================
function calculateLeadScore(
  lead: Record<string, unknown>,
  convo: Record<string, unknown>,
  sentiment: string,
  messageContent: string,
): { score: number; detalles: Record<string, number> } {
  let interes = (lead.score_detalles as Record<string, number>)?.interes || 30
  let encaje = (lead.score_detalles as Record<string, number>)?.encaje || 30
  let urgencia = (lead.score_detalles as Record<string, number>)?.urgencia || 20
  let capacidad = (lead.score_detalles as Record<string, number>)?.capacidad_inversion || 20

  // Sentiment adjustments
  if (sentiment === 'positivo' || sentiment === 'interesado') interes = Math.min(100, interes + 15)
  if (sentiment === 'urgente') urgencia = Math.min(100, urgencia + 25)
  if (sentiment === 'negativo') interes = Math.max(0, interes - 10)
  if (sentiment === 'frustrado') interes = Math.max(0, interes - 15)

  // Step adjustments
  if (convo.step === 'meeting_pref') interes = Math.min(100, interes + 15)
  if (convo.estado === 'agendado') { interes = 90; encaje = Math.min(100, encaje + 20) }

  // Content-based adjustments — detect real buying signals
  const lower = messageContent.toLowerCase()

  // === SEÑAL FUERTE: Interés en captación/marketing/clientes ===
  if (/captaci[oó]n|conseguir.*cliente|m[aá]s\s*cliente|nuevos\s*cliente|captar|marketing|publicidad|visibilidad|posicionamiento|redes\s*sociales|instagram|google\s*ads|seo|embudo|funnel/.test(lower)) {
    interes = Math.min(100, interes + 25)
    encaje = Math.min(100, encaje + 15)
  }

  // === SEÑAL FUERTE: Tiene presupuesto / habla de inversión ===
  if (/presupuesto|inversi[oó]n|inversion|invertir|gastar|pagar|€|\d+\s*euros?|cuánto\s*(cuesta|cobr|vale)|cu[aá]nto\s*hay\s*que|precio/.test(lower)) {
    capacidad = Math.min(100, capacidad + 25)
    interes = Math.min(100, interes + 10)
  }

  // === SEÑAL FUERTE: Comparte datos de negocio (volumen, facturación) ===
  if (/\d+/.test(messageContent) && /boda|evento|mes|año|semana|factur|ticket|paquete|servicio/.test(lower)) {
    encaje = Math.min(100, encaje + 20)
    capacidad = Math.min(100, capacidad + 10)
  }

  // === Encaje sector ===
  if (/boda|evento|empresa|negocio|aut[oó]nomo|fot[oó]graf|wedding|sector|florist|dj|catering|wedding\s*planner|videograf/.test(lower)) {
    encaje = Math.min(100, encaje + 15)
  }

  // === Urgencia ===
  if (/urgente|pronto|esta semana|necesito|lo antes posible|temporada|ya mismo|cuanto antes/.test(lower)) {
    urgencia = Math.min(100, urgencia + 20)
  }

  // === Señales de problema / dolor ===
  if (/no\s*(me\s*)?llegan|poca?s?\s*client|dependo\s*del?\s*boca|boca\s*a\s*boca|no\s*s[eé]\s*c[oó]mo|estancad|bajon|bajada|menos\s*trabajo|temporada\s*baja/.test(lower)) {
    interes = Math.min(100, interes + 20)
    urgencia = Math.min(100, urgencia + 10)
  }

  // Any substantive reply shows engagement
  if (messageContent.length > 15) interes = Math.min(100, interes + 5)
  // Numbers = sharing real data
  if (/\d+/.test(messageContent)) encaje = Math.min(100, encaje + 5)

  const score = Math.round(interes * 0.35 + encaje * 0.25 + urgencia * 0.2 + capacidad * 0.2)

  return {
    score: Math.min(100, Math.max(0, score)),
    detalles: { interes, encaje, urgencia, capacidad_inversion: capacidad },
  }
}

// ============================================================
// OBJECTION DETECTION
// ============================================================
function detectObjection(text: string): { detected: boolean; tipo: string; descripcion: string } | null {
  const lower = text.toLowerCase()

  const patterns: Array<{ tipo: string; regex: RegExp; desc: string }> = [
    { tipo: 'precio', regex: /muy caro|no me lo puedo permitir|demasiado|fuera de presupuesto|no tengo dinero|cuánto cuesta|es mucho/, desc: 'Objeción de precio' },
    { tipo: 'tiempo', regex: /no tengo tiempo|estoy muy liado|ahora no puedo|más adelante|quizás luego|otro momento|la semana que viene|después de|cuando pase/, desc: 'Objeción de tiempo' },
    { tipo: 'confianza', regex: /no me fío|no confío|parece estafa|es fiable|cómo sé que|quién sois|no os conozco|spam|publicidad|timo/, desc: 'Objeción de confianza' },
    { tipo: 'competencia', regex: /ya tengo|trabajo con otro|ya uso|otra agencia|otra empresa|competencia|lo llevo yo/, desc: 'Objeción de competencia' },
    { tipo: 'pensar', regex: /lo tengo que pensar|déjame pensarlo|ya te digo|necesito pensarlo|consultarlo|hablarlo con|me lo pienso/, desc: 'Necesita pensarlo' },
    { tipo: 'no_sector', regex: /he cerrado|ya no.*boda|dejé.*sector|no.*dedico.*boda|cambié.*trabajo|ya no.*evento|no.*sector/, desc: 'Ya no está en el sector' },
    { tipo: 'opt_out', regex: /no me escrib|dejad.*paz|no.*mole|borra.*datos|no.*contactéis|no.*llam|darme de baja|quita.*lista/, desc: 'Pide no ser contactado' },
  ]

  for (const p of patterns) {
    if (p.regex.test(lower)) {
      return { detected: true, tipo: p.tipo, descripcion: p.desc }
    }
  }

  return null
}

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
    bookingUsed?: { value: boolean }
  },
): Promise<string> {
  const { supabase, agente, lead, convo } = context

  switch (toolName) {
    case 'think': {
      return `[Razonamiento registrado]`
    }

    case 'consultar_calendario': {
      const fechaDesde = (toolInput.fecha_desde as string) ||
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const diasBuscar = (toolInput.dias_buscar as number) || 7

      try {
        // Always query CLOSERS' availability, not the bot's
        const { data: closers } = await supabase
          .from('ventas_roles_comerciales')
          .select('usuario_id')
          .eq('rol', 'closer')
          .eq('activo', true)

        if (!closers || closers.length === 0) {
          return 'Propón al lead una fecha entre semana (lunes a viernes) en horario de 10:00 a 19:00 y dile que confirmarás disponibilidad. No digas que no hay hueco.'
        }

        // Try each closer until we find slots
        let allSlots: Array<Record<string, string>> = []
        for (const closer of closers) {
          try {
            const { data: slots } = await supabase.rpc(
              'obtener_slots_disponibles_agente',
              { p_agente_usuario_id: closer.usuario_id, p_fecha_desde: fechaDesde, p_dias: diasBuscar },
            )
            if (slots && slots.length > 0) {
              allSlots = slots
              break
            }
          } catch {
            // RPC might fail — try next closer
          }
        }

        if (allSlots.length > 0) {
          const formatted = allSlots.slice(0, 5).map((s: Record<string, string>) =>
            `${s.fecha} a las ${s.hora} (${s.duracion}min)`
          ).join('\n')
          return `Slots disponibles:\n${formatted}\n\nPropón 2-3 opciones al lead de forma natural.`
        }

        // No RPC slots found — check if closers have general availability configured
        const { data: disps } = await supabase
          .from('ventas_calendario_disponibilidad')
          .select('dia_semana, hora_inicio, hora_fin')
          .eq('usuario_id', closers[0].usuario_id)
          .order('dia_semana')

        if (disps && disps.length > 0) {
          const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
          const slotsText = disps.map((d: Record<string, unknown>) =>
            `${dias[d.dia_semana as number]}: ${d.hora_inicio} - ${d.hora_fin}`
          ).join('\n')
          return `Disponibilidad general:\n${slotsText}\n\nPropón horarios dentro de estos rangos para los próximos días laborables.`
        }

        // Ultimate fallback — never leave lead without options
        return 'Propón al lead una fecha entre semana (lunes a viernes) en horario de 10:00 a 19:00 y dile que confirmarás disponibilidad exacta. NUNCA digas que no hay hueco ni que te escribirás después.'
      } catch (err) {
        return 'Propón al lead una fecha entre semana en horario de 10:00 a 19:00. Dile que confirmarás. No menciones problemas técnicos.'
      }
    }

    case 'reservar_cita': {
      // Dedup: prevent double booking in same conversation
      if (context.bookingUsed?.value) {
        return 'Ya has reservado una cita en esta iteración. No reserves dos veces.'
      }
      if (context.bookingUsed) context.bookingUsed.value = true

      const fechaHora = toolInput.fecha_hora as string
      const nombreLead = toolInput.nombre_lead as string
      const resumen = toolInput.resumen as string

      try {
        const { data: closers } = await supabase
          .from('ventas_roles_comerciales')
          .select('usuario_id')
          .eq('rol', 'closer')
          .limit(5)

        if (!closers || closers.length === 0) {
          return 'Error: no hay closers disponibles. Informa al lead que le confirmarás la cita por email.'
        }

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

        const { data: cita, error: citaErr } = await supabase
          .from('ventas_citas')
          .insert({
            lead_id: lead.crm_lead_id || null,
            closer_id: selectedCloserId,
            setter_origen_id: agente.usuario_id || null,
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

        // Update conversation
        await supabase
          .from('ia_conversaciones')
          .update({ estado: 'agendado' })
          .eq('id', convo.id)

        // Sync with CRM if linked
        if (lead.crm_lead_id) {
          await supabase
            .from('ventas_leads')
            .update({
              resumen_setter: resumen,
              closer_asignado_id: selectedCloserId,
            })
            .eq('id', lead.crm_lead_id)

          try { await supabase.from('ventas_actividad').insert({
            lead_id: lead.crm_lead_id,
            usuario_id: agente.usuario_id || selectedCloserId,
            tipo: 'cita_agendada',
            descripcion: `Cita agendada por agente IA para ${fechaHora}`,
          }) } catch (_e) { /* ignore */ }
        }

        // CRM sync: move etapa
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        fetch(`${supabaseUrl}/functions/v1/ia-crm-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ conversacion_id: convo.id, action: 'etapa_agendado' }),
        }).catch(() => {})

        const { data: closerUser } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('id', selectedCloserId)
          .single()

        return `Cita reservada correctamente para ${fechaHora} con ${closerUser?.nombre || 'nuestro equipo'}. Confirma al lead que recibirá los detalles.`
      } catch (err) {
        return `Error reservando cita: ${err}. Informa al lead que lo gestionarás manualmente.`
      }
    }

    case 'consultar_base_conocimiento': {
      const query = toolInput.query as string

      try {
        const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
        if (!openaiKey) {
          return 'Base de conocimiento no disponible. Responde con lo que sepas del prompt.'
        }

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

        const { data: docs, error } = await supabase.rpc(
          'match_documents_rosalia',
          {
            query_embedding: embedding,
            match_threshold: 0.3,
            match_count: 3,
          },
        )

        if (error || !docs || docs.length === 0) {
          return 'No encontré información relevante en la base de conocimiento. Responde con lo que sepas del prompt o sugiere que contacte al equipo.'
        }

        const ragContext = docs
          .map((d: Record<string, unknown>) => d.content)
          .join('\n\n---\n\n')

        return `Información de la base de conocimiento:\n\n${ragContext}\n\nUsa esta información de forma natural. NO copies literalmente, parafrasea.`
      } catch (err) {
        return `Error consultando base de conocimiento: ${err}`
      }
    }

    case 'derivar_humano': {
      const motivo = toolInput.motivo as string
      const urgente = (toolInput.urgente as boolean) || false

      await supabase
        .from('ia_conversaciones')
        .update({
          chatbot_activo: false,
          handoff_humano: true,
          estado: 'handoff_humano',
        })
        .eq('id', convo.id)

      await supabase.from('ia_alertas_supervisor').insert({
        agente_id: agente.id,
        conversacion_id: convo.id,
        tipo: urgente ? 'derivacion_urgente' : 'derivacion_humano',
        mensaje: `Derivación a humano: ${motivo}`,
        leida: false,
      })

      // Send WhatsApp notification to team lead (+34659878684)
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      fetch(`${supabaseUrl}/functions/v1/ia-whatsapp-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          agente_id: agente.id,
          conversacion_id: convo.id,
          to: '+34659878684',
          sender: 'bot',
          template_name: 'derivacion_humano',
          template_params: {},
        }),
      }).catch(() => {}) // Fire and forget

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

  const aiMentions = [
    'soy una ia', 'soy un bot', 'soy inteligencia artificial',
    'como ia', 'como bot', 'soy una máquina', 'soy una maquina',
    'no soy humana', 'no soy humano', 'no soy una persona',
    'i am an ai', 'i am a bot', 'artificial intelligence',
    'language model', 'modelo de lenguaje', 'chatgpt', 'claude',
    'openai', 'anthropic',
  ]
  for (const mention of aiMentions) {
    if (responseText.toLowerCase().includes(mention)) {
      issues.push(`Menciona ser IA: "${mention}"`)
    }
  }

  if (responseText.length > 800) {
    issues.push(`Mensaje demasiado largo: ${responseText.length} chars (max 800)`)
  }

  const forbidden = [
    /contraseña|password/i,
    /tarjeta de crédito|credit card/i,
    /número de cuenta|account number/i,
    /clave secreta|api.key/i,
  ]
  for (const pattern of forbidden) {
    if (pattern.test(responseText)) {
      issues.push(`Información prohibida detectada: ${pattern}`)
    }
  }

  // Bot-sounding expressions
  const botExpressions = [
    'estimado/a', 'le informo', 'procederemos a', 'agradecemos su interés',
    'quedamos a su disposición', 'a continuación', 'seguidamente',
    'cordialmente', 'atentamente', 'permítame',
  ]
  for (const expr of botExpressions) {
    if (responseText.toLowerCase().includes(expr)) {
      issues.push(`Expresión de bot detectada: "${expr}"`)
    }
  }

  return {
    pass: issues.filter(i => i.startsWith('Menciona ser IA') || i.startsWith('Información prohibida')).length === 0,
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

Criterios (puntúa del 1 al 10):
- Natural y humano, no robótico (¿suena a WhatsApp real?)
- Apropiada para el contexto (¿responde a lo que preguntó el lead?)
- Avanza la conversación (¿tiene pregunta o call-to-action?)
- Longitud correcta (¿es un WhatsApp corto, no un email?)
- No revela que es IA
- No tiene mensajes vacíos de relleno ("Genial!", "Qué bien!" solos)

Responde ÚNICAMENTE con JSON, sin texto antes ni después:
{"score": N, "feedback": "razón en 1 frase"}`,
          },
        ],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'no body')
      console.error(`Quality check API error: ${res.status} ${res.statusText} — ${errBody}`)
      return { score: 5, feedback: `Quality check unavailable (${res.status}): ${errBody.substring(0, 100)}` }
    }
    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    try {
      // Try direct parse first, then extract JSON from surrounding text
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(text)
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*"score"\s*:\s*\d+[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          // Try to extract score from plain text
          const scoreMatch = text.match(/(\d+)\s*\/\s*10/)
          if (scoreMatch) {
            return { score: Math.min(10, Math.max(1, parseInt(scoreMatch[1]))), feedback: text.substring(0, 200) }
          }
          console.error('Quality check unparseable:', text.substring(0, 300))
          return { score: 7, feedback: 'Quality parse failed — allowing by default' }
        }
      }
      return {
        score: Math.min(10, Math.max(1, (parsed.score as number) || 5)),
        feedback: (parsed.feedback as string) || '',
      }
    } catch {
      // Can't parse at all → allow through
      return { score: 7, feedback: 'Quality parse failed — allowing by default' }
    }
  } catch {
    // Quality check failed → conservative: return 5 so it blocks if threshold is 6
    return { score: 5, feedback: 'Quality check failed — blocking by default' }
  }
}

// ============================================================
// AI SUMMARY (replaces crude concatenation)
// ============================================================
async function generateSummary(
  currentSummary: string | null,
  leadMessage: string,
  botResponse: string,
  anthropicKey: string,
): Promise<string> {
  if (!anthropicKey) {
    // Fallback: simple append
    const append = `Lead: "${leadMessage.substring(0, 40)}..." → Bot: "${botResponse.substring(0, 40)}..."`
    const fallback = `${currentSummary || ''}${currentSummary ? ' | ' : ''}${append}`
    return fallback.substring(0, 1500)
  }

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
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Actualiza este resumen ejecutivo de una conversación comercial por WhatsApp. Máximo 500 caracteres.

Resumen actual: ${currentSummary || 'Conversación nueva, sin resumen.'}

Último intercambio:
Lead: "${leadMessage}"
Bot: "${botResponse}"

Escribe un resumen actualizado que incluya: quién es el lead, qué busca, en qué punto está la conversación, objeciones si hay, y el siguiente paso. Solo el resumen, sin prefijos.`,
          },
        ],
      }),
    })

    if (!res.ok) return currentSummary || ''
    const data = await res.json()
    return (data.content?.[0]?.text || currentSummary || '').substring(0, 1500)
  } catch {
    return currentSummary || ''
  }
}

// ============================================================
// FOLLOWUP DETECTION from AI response
// ============================================================
function detectFollowup(responseJson: string): { requested: boolean; when: string | null } {
  try {
    const parsed = JSON.parse(responseJson)
    if (parsed.followup?.requested && parsed.followup?.when) {
      return { requested: true, when: parsed.followup.when }
    }
    if (parsed.intent === 'followup_later') {
      return { requested: true, when: parsed.followup?.when || 'la semana que viene' }
    }
  } catch {
    // Not JSON, check for followup patterns in text
  }
  return { requested: false, when: null }
}

function parseFollowupDate(whenText: string): Date | null {
  const now = new Date()
  const lower = whenText.toLowerCase()

  if (/mañana/.test(lower)) return new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (/pasado mañana/.test(lower)) return new Date(now.getTime() + 48 * 60 * 60 * 1000)
  if (/semana que viene|la semana|próxima semana/.test(lower)) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  if (/en (\d+) día/.test(lower)) {
    const days = parseInt(lower.match(/en (\d+) día/)?.[1] || '3')
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  }
  if (/lunes/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7)); d.setHours(10, 0, 0, 0); return d }
  if (/martes/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7)); d.setHours(10, 0, 0, 0); return d }
  if (/miércoles|miercoles/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); d.setHours(10, 0, 0, 0); return d }
  if (/jueves/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); d.setHours(10, 0, 0, 0); return d }
  if (/viernes/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); d.setHours(10, 0, 0, 0); return d }

  // Default: 3 days
  return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
}

// ============================================================
// CLAUDE API CALL WITH RETRIES
// ============================================================
async function callClaudeWithRetry(
  body: Record<string, unknown>,
  anthropicKey: string,
  maxRetries = 5,
): Promise<{ data: Record<string, unknown>; ok: boolean; error?: string }> {
  let lastError = ''
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        return { data, ok: true }
      }

      const errText = await res.text()
      lastError = `Claude API ${res.status}: ${errText.substring(0, 200)}`
      console.error(`[claude] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError}`)

      // 429 or 529 → retry with backoff
      if (res.status === 429 || res.status === 529) {
        await sleep(Math.pow(2, attempt) * 2000)
        continue
      }

      // Other errors → don't retry
      return { data: {}, ok: false, error: lastError }
    } catch (err) {
      lastError = `Claude API network error: ${err}`
      console.error(`[claude] Attempt ${attempt + 1}/${maxRetries} exception: ${lastError}`)
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 2000)
        continue
      }
      return { data: {}, ok: false, error: lastError }
    }
  }
  return { data: {}, ok: false, error: `Max retries exhausted. Last: ${lastError}` }
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
  // Use the incoming Authorization header's key if available (more reliable than env var)
  const incomingAuth = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const serviceKey = incomingAuth || (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const conversacionId = params.conversacion_id as string
  const agenteId = params.agente_id as string
  const leadId = params.lead_id as string
  const messageContent = (params.message_content as string) || ''
  const messageType = (params.message_type as string) || 'text'

  if (!conversacionId || !agenteId || !leadId) {
    return jsonResponse({ error: 'Missing required params' }, 400)
  }

  // === ACQUIRE PROCESSING LOCK (prevents duplicate processing) ===
  const lockAcquired = await acquireLock(supabase, conversacionId)
  if (!lockAcquired) {
    return jsonResponse({ status: 'skipped', reason: 'processing_locked' })
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

    // === CHECK BUSINESS HOURS ===
    const agenteConfig = (agente.config as Record<string, unknown>) || {}
    const horario = agenteConfig.horario as Record<string, unknown> | undefined
    if (horario) {
      const madridNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      const currentHourMin = madridNow.getHours() * 100 + madridNow.getMinutes()
      const currentDay = madridNow.getDay() // 0=Sun, 1=Mon...
      const dias = (horario.dias as number[]) || [1, 2, 3, 4, 5]
      const inicio = horario.inicio as string || '08:30'
      const fin = horario.fin as string || '21:00'
      const [hI, mI] = inicio.split(':').map(Number)
      const [hF, mF] = fin.split(':').map(Number)
      const inicioMin = hI * 100 + mI
      const finMin = hF * 100 + mF

      if (!dias.includes(currentDay) || currentHourMin < inicioMin || currentHourMin > finMin) {
        // Outside business hours — queue for later, don't respond now
        await supabase.from('ia_logs').insert({
          agente_id: agenteId,
          conversacion_id: conversacionId,
          tipo: 'info',
          mensaje: `Mensaje recibido fuera de horario (${madridNow.toLocaleTimeString('es-ES')}). Respuesta pendiente.`,
        })
        await supabase.from('ia_conversaciones').update({
          estado: 'needs_reply',
        }).eq('id', conversacionId)
        await releaseLock(supabase, conversacionId)
        return jsonResponse({ status: 'queued', reason: 'outside_business_hours' })
      }
    }

    // === GUARD CHECKS ===
    if (!convo.chatbot_activo) {
      return jsonResponse({ status: 'skipped', reason: 'chatbot_inactivo' })
    }
    if (!agente.activo) {
      return jsonResponse({ status: 'skipped', reason: 'agente_inactivo' })
    }
    if (lead.opted_out) {
      return jsonResponse({ status: 'skipped', reason: 'lead_opted_out' })
    }

    // === SENTIMENT ANALYSIS ===
    const sentiment = analyzeSentiment(messageContent)
    await supabase.from('ia_leads').update({
      sentimiento_actual: sentiment,
    }).eq('id', leadId)

    // Log sentiment if notable
    if (sentiment !== 'neutro') {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'sentiment',
        mensaje: `Sentimiento detectado: ${sentiment}`,
        detalles: { sentiment, message_preview: messageContent.substring(0, 100) },
      })
    }

    // Create alert for negative/frustrated sentiment
    if (sentiment === 'frustrado' || sentiment === 'negativo') {
      await supabase.from('ia_alertas_supervisor').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'sentimiento_negativo',
        mensaje: `Lead con sentimiento ${sentiment}: "${messageContent.substring(0, 100)}"`,
        leida: false,
      })
    }

    // === LEAD SCORING ===
    const scoring = calculateLeadScore(lead, convo, sentiment, messageContent)
    await supabase.from('ia_leads').update({
      lead_score: scoring.score,
      score_detalles: scoring.detalles,
    }).eq('id', leadId)

    // === OBJECTION DETECTION ===
    const objection = detectObjection(messageContent)
    if (objection) {
      // Get the latest inbound message ID for reference
      const { data: latestMsg } = await supabase
        .from('ia_mensajes')
        .select('id')
        .eq('conversacion_id', conversacionId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      await supabase.from('ia_objeciones').insert({
        conversacion_id: conversacionId,
        mensaje_id: latestMsg?.id || null,
        tipo: objection.tipo,
        descripcion: objection.descripcion,
        resuelta: false,
      })

      // Auto-handle opt_out: mark lead and stop chatbot
      if (objection.tipo === 'opt_out') {
        await supabase.from('ia_leads').update({ opted_out: true, opted_out_at: new Date().toISOString() }).eq('id', leadId)
        await supabase.from('ia_conversaciones').update({ estado: 'descartado', chatbot_activo: false }).eq('id', conversacionId)
        await supabase.from('ia_logs').insert({
          agente_id: agenteId, conversacion_id: conversacionId, tipo: 'info',
          mensaje: `Lead opt-out detectado automáticamente: "${messageContent.substring(0, 100)}"`,
        })
      }

      // Auto-handle no_sector: mark as descartado
      if (objection.tipo === 'no_sector') {
        await supabase.from('ia_conversaciones').update({ estado: 'descartado' }).eq('id', conversacionId)
        await supabase.from('ia_logs').insert({
          agente_id: agenteId, conversacion_id: conversacionId, tipo: 'info',
          mensaje: `Lead ya no en sector detectado: "${messageContent.substring(0, 100)}"`,
        })
      }
    }

    // === TRACK LEAD ACTIVE HOURS ===
    const madridHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
    const currentHour = parseInt(madridHour)
    const horasActivas = (lead.horas_activas as Record<string, number>) || {}
    horasActivas[String(currentHour)] = (horasActivas[String(currentHour)] || 0) + 1
    await supabase.from('ia_leads').update({ horas_activas: horasActivas }).eq('id', leadId)

    // === LOAD CONVERSATION HISTORY (last 30 messages) ===
    const { data: history } = await supabase
      .from('ia_mensajes')
      .select('direction, sender, content, message_type, transcription, created_at')
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true })
      .limit(30)

    // Actual text of WhatsApp templates (must match Meta-approved text exactly)
    const TEMPLATE_TEXTS: Record<string, (leadName: string) => string> = {
      'primer_mensaje_formulario': (name) =>
        `Hola ${name}, soy Rosalía, del equipo de Madrigal Marketing. Hemos recibido tu solicitud de información sobre nuestros servicios. Cuéntame, qué es lo que más te está frenando ahora mismo para conseguir más clientes?`,
      'hola_he_visto_que_nos_has_vuelto_a_rellenar_el_formulario_en_que_te_puedo_ayudar': (_name) =>
        `Hola! He visto que nos has vuelto a rellenar el formulario, en qué te puedo ayudar?`,
      'ests_por_aqui': (_name) =>
        `Estás por aquí?`,
      'ojitos': (_name) =>
        `👀`,
      'ultimo_toque_y_no_molesto_mas__seguimos_o_lo_dejamos_aqui': (_name) =>
        `Último toque y no molesto más, seguimos o lo dejamos aquí?`,
      're_contacto_rosalia_1': (_name) =>
        `Hola! Soy Rosalía del equipo de Madrigal Marketing. Te escribo porque creo que podemos ayudarte con tu negocio. Tienes un momento?`,
    }

    const leadName = (lead.nombre as string) || 'amigo/a'

    const historyMessages = (history || []).map((m: Record<string, unknown>) => {
      let content = m.transcription
        ? `${m.content}\n[Transcripción: ${m.transcription}]`
        : (m.content as string)

      // Replace template placeholders with actual text
      const templateMatch = content.match(/^\[Plantilla: (.+)\]$/)
      if (templateMatch) {
        const tplName = templateMatch[1]
        const tplFn = TEMPLATE_TEXTS[tplName]
        content = tplFn ? tplFn(leadName) : `(Mensaje de saludo inicial al lead)`
      }

      return {
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content,
      }
    })

    // === SELECT SYSTEM PROMPT (A/B test) ===
    let systemPrompt = agente.system_prompt || ''
    if (agente.ab_test_activo && agente.system_prompt_b && convo.ab_version === 'B') {
      systemPrompt = agente.system_prompt_b
    }

    // === LOAD TEAM STYLE (if available) ===
    let styleAddendum = ''
    const { data: estilos } = await supabase
      .from('ia_estilos_equipo')
      .select('estilo')
      .eq('agente_id', agenteId)
      .limit(1)

    if (estilos && estilos.length > 0 && estilos[0].estilo) {
      const estilo = estilos[0].estilo as Record<string, unknown>
      styleAddendum = `\n\n--- ESTILO DEL EQUIPO (adapta tu tono) ---
Longitud media de mensajes del equipo: ${estilo.longitud_media || 'no disponible'}
Usa emojis: ${estilo.usa_emojis ? 'Sí, moderadamente' : 'No'}
Expresiones frecuentes: ${(estilo.expresiones_frecuentes as string[])?.join(', ') || 'no disponible'}
Tono: ${estilo.tono || 'no disponible'}
`
    }

    // === LOAD LEARNED PATTERNS ===
    let learnedRules = ''
    const { data: aprendizajes } = await supabase
      .from('ia_aprendizajes')
      .select('tipo, contenido, confianza')
      .eq('agente_id', agenteId)
      .eq('activo', true)
      .order('confianza', { ascending: false })
      .limit(15)

    if (aprendizajes && aprendizajes.length > 0) {
      const ganadores = aprendizajes.filter((a: Record<string, unknown>) => a.tipo === 'patron_ganador').map((a: Record<string, unknown>) => `✓ ${a.contenido}`)
      const perdedores = aprendizajes.filter((a: Record<string, unknown>) => a.tipo === 'patron_perdedor').map((a: Record<string, unknown>) => `✗ ${a.contenido}`)
      const reglas = aprendizajes.filter((a: Record<string, unknown>) => a.tipo === 'regla_aprendida').map((a: Record<string, unknown>) => `• ${a.contenido}`)

      learnedRules = `\n--- APRENDIZAJES DE CONVERSACIONES ANTERIORES ---\n`
      if (reglas.length > 0) learnedRules += `REGLAS:\n${reglas.join('\n')}\n`
      if (ganadores.length > 0) learnedRules += `LO QUE FUNCIONA:\n${ganadores.join('\n')}\n`
      if (perdedores.length > 0) learnedRules += `LO QUE NO FUNCIONA:\n${perdedores.join('\n')}\n`
    }

    // Add context to system prompt
    const agentConfig = (agente.config as Record<string, unknown>) || {}
    const especialidad = agentConfig.especialidad || agente.tipo || 'setter'

    const contextAddendum = `

--- INSTRUCCIONES DEL SISTEMA ---

FORMATO: Divide tu respuesta en 1-2 mensajes cortos separados por --- en su propia línea.
Cada mensaje: MÁXIMO 15 palabras. Como un WhatsApp real.
Preguntas DIRECTAS y CORTAS. NUNCA preguntas con opciones "X o Y?".

Ejemplo BUENO:
Y esas campañas te están dando resultado?

Ejemplo MALO (demasiado largo, da opciones):
Y esas campañas de redes, te dan resultado o es un poco irregular según el mes?

El primer mensaje del historial es una plantilla que TÚ ya enviaste. NUNCA repitas su contenido.

STEP ACTUAL: "${convo.step}"

${convo.step === 'first_message' || convo.step === 'qualify' ? `Estás CUALIFICANDO. Máximo 2-3 intercambios.
- Detecta si sigue en el sector, cómo le va, cómo consigue clientes
- Si muestra dolor → VALIDA y CREA CURIOSIDAD. No propongas reunión aún
- Ejemplo: "Eso le pasa a muchos. Justo es lo que solucionamos"
- Deja que el lead pregunte más. Termina con algo que genere curiosidad` : ''}
${convo.step === 'meeting_pref' ? `El lead ha mostrado interés. PERO no vayas directo a videollamada.
- Si el lead aún no ha preguntado "cómo lo hacéis" → crea curiosidad primero
- Si el lead YA preguntó o dijo "cuéntame" → ahora sí propón videollamada corta
- SOLO cuando acepte, usa consultar_calendario
- NUNCA inventes fechas` : ''}

Usa consultar_base_conocimiento si el lead pregunta sobre servicios, precios o qué hacemos.

--- DATOS DEL LEAD (ya los conoces, NUNCA preguntes algo que ya sabes) ---
Nombre: ${lead.nombre || 'Desconocido'}
${lead.servicio ? `Servicio/profesión: ${lead.servicio} — YA SABES que es ${lead.servicio}, NO le preguntes a qué se dedica` : 'Servicio: desconocido'}
Score: ${scoring.score}/100 | Sentimiento: ${sentiment}
Step: ${convo.step} | Estado: ${convo.estado}
${convo.resumen ? `Resumen: ${convo.resumen}` : ''}
${objection ? `Objeción: ${objection.tipo}` : ''}
Fecha: ${getMadridDateTime()}
${styleAddendum}
${learnedRules}`

    const fullSystemPrompt = systemPrompt + contextAddendum

    // === CALL CLAUDE SONNET 4.6 WITH RETRIES ===
    let claudeMessages = [...historyMessages]

    // Ensure last message is from user
    if (claudeMessages.length === 0 || claudeMessages[claudeMessages.length - 1].role !== 'user') {
      claudeMessages.push({ role: 'user', content: messageContent })
    }

    let finalResponse = ''
    let tokensIn = 0
    let tokensOut = 0
    let toolCalls = 0
    const maxIterations = 10
    const bookingUsed = { value: false }

    const PRIMARY_MODEL = 'claude-sonnet-4-6'
    const FALLBACK_MODEL = 'claude-haiku-4-5-20251001'
    let activeModel = PRIMARY_MODEL

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let claudeResult = await callClaudeWithRetry({
        model: activeModel,
        max_tokens: 1024,
        system: fullSystemPrompt,
        tools: AGENT_TOOLS,
        messages: claudeMessages,
      }, anthropicKey)

      // If primary model fails, try fallback model
      if (!claudeResult.ok && activeModel === PRIMARY_MODEL) {
        console.warn(`[claude] Primary model ${PRIMARY_MODEL} failed, trying fallback ${FALLBACK_MODEL}`)
        activeModel = FALLBACK_MODEL
        claudeResult = await callClaudeWithRetry({
          model: FALLBACK_MODEL,
          max_tokens: 1024,
          system: fullSystemPrompt,
          tools: AGENT_TOOLS,
          messages: claudeMessages,
        }, anthropicKey)
      }

      if (!claudeResult.ok) {
        // === FALLBACK: Both models failed ===
        await supabase.from('ia_alertas_supervisor').insert({
          agente_id: agenteId,
          conversacion_id: conversacionId,
          tipo: 'error',
          mensaje: `Claude API caído (ambos modelos): ${claudeResult.error}. Lead sin respuesta.`,
          leida: false,
        })

        await supabase.from('ia_logs').insert({
          agente_id: agenteId,
          conversacion_id: conversacionId,
          tipo: 'error',
          mensaje: `Claude API fallback triggered (both models): ${claudeResult.error}`,
        })

        // Don't leave lead without response — derive to human
        await executeTool('derivar_humano', {
          motivo: `Claude API no disponible: ${claudeResult.error}`,
          urgente: true,
        }, { supabase, agente, lead, convo, bookingUsed })

        return jsonResponse({ status: 'fallback', reason: 'claude_api_down', error: claudeResult.error })
      }

      const claudeData = claudeResult.data
      tokensIn += (claudeData.usage as Record<string, number>)?.input_tokens || 0
      tokensOut += (claudeData.usage as Record<string, number>)?.output_tokens || 0

      const stopReason = claudeData.stop_reason
      const contentBlocks = (claudeData.content as Array<Record<string, unknown>>) || []
      const textBlocks = contentBlocks.filter(b => b.type === 'text')
      const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use')

      if (textBlocks.length > 0) {
        finalResponse = textBlocks.map((b: Record<string, string>) => b.text).join('')
      }

      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        claudeMessages.push({ role: 'assistant', content: contentBlocks })

        const toolResults: Array<Record<string, unknown>> = []

        for (const toolBlock of toolUseBlocks) {
          toolCalls++
          const toolResult = await executeTool(
            toolBlock.name as string,
            toolBlock.input as Record<string, unknown>,
            { supabase, agente, lead, convo, bookingUsed },
          )

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: toolResult,
          })

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

        claudeMessages.push({ role: 'user', content: toolResults })
        continue
      }

      break
    }

    // === POST-PROCESS: clean up formatting ===
    // Remove ¿ ¡ (opening punctuation), trailing periods, and colons
    finalResponse = finalResponse
      .replace(/¿/g, '')
      .replace(/¡/g, '')
      .replace(/:\s/g, ', ')           // Replace ": " with ", " (colons sound robotic)
      .replace(/\.(\s*\n|$)/g, '$1')   // Remove period at end of lines
      .replace(/\.\s*$/g, '')          // Remove trailing period
      .replace(/\.(\s*---)/g, '$1')    // Remove period before --- delimiter

    if (!finalResponse) {
      // Claude used all iterations on tools without generating text
      // Force one final call without tools to get a text response
      claudeMessages.push({ role: 'user', content: '[SISTEMA: Genera tu respuesta de texto ahora. No uses más herramientas.]' })
      const forceResult = await callClaudeWithRetry({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: fullSystemPrompt,
        messages: claudeMessages,
      }, anthropicKey)

      if (forceResult.ok) {
        const forceData = forceResult.data
        const forceText = ((forceData.content as Array<Record<string, unknown>>) || [])
          .filter(b => b.type === 'text')
          .map((b: Record<string, string>) => b.text)
          .join('')
        if (forceText) {
          finalResponse = forceText
            .replace(/¿/g, '')
            .replace(/¡/g, '')
            .replace(/\.(\s*\n|$)/g, '$1')
            .replace(/\.\s*$/g, '')
          tokensIn += (forceData.usage as Record<string, number>)?.input_tokens || 0
          tokensOut += (forceData.usage as Record<string, number>)?.output_tokens || 0
        }
      }
    }

    if (!finalResponse) {
      // Still nothing — last resort: derive to human
      await executeTool('derivar_humano', {
        motivo: 'Claude no generó respuesta de texto tras reintento',
        urgente: true,
      }, { supabase, agente, lead, convo, bookingUsed })
      return jsonResponse({ status: 'fallback', reason: 'no_response_generated' })
    }

    // === DETECT FOLLOWUP REQUEST IN RESPONSE ===
    const followup = detectFollowup(finalResponse)
    if (followup.requested && followup.when) {
      const followupDate = parseFollowupDate(followup.when)
      if (followupDate) {
        await supabase.from('ia_conversaciones').update({
          estado: 'scheduled_followup',
          chatbot_activo: false,
          followup_at: followupDate.toISOString(),
        }).eq('id', conversacionId)
      }
    }

    // === GUARDRAILS POST-RESPONSE ===
    const guardrails = checkGuardrails(finalResponse)

    if (!guardrails.pass) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'warning',
        mensaje: `Guardrails failed: ${guardrails.issues.join(', ')}`,
        detalles: { original_response: finalResponse, issues: guardrails.issues },
      })

      if (guardrails.issues.some(i => i.startsWith('Menciona ser IA'))) {
        await executeTool('derivar_humano', {
          motivo: 'Bot intentó revelar que es IA',
          urgente: true,
        }, { supabase, agente, lead, convo, bookingUsed })
        return jsonResponse({ status: 'blocked', reason: 'guardrails' })
      }

      // Truncate if too long
      if (finalResponse.length > 800) {
        finalResponse = finalResponse.substring(0, 750) + '...'
      }
    }

    // Clean up bot-sounding characters
    finalResponse = finalResponse.replace(/[—–]/g, '.').replace(/\.\./g, '.')

    // === QUALITY EVALUATION (HAIKU) ===
    const qualityThreshold = (agente.config as Record<string, unknown>)?.umbral_calidad_minima as number || 6
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
        finalResponse, messageContent, contextSummary, anthropicKey,
      )
      qualityScore = quality.score
      qualityFeedback = quality.feedback

      try { await supabase.rpc('ia_increment_costes', {
        p_agente_id: agenteId,
        p_fecha: getMadridDate(),
        p_haiku_calls: 1,
        p_haiku_coste: 0.001,
      }) } catch (_e) { /* ignore */ }
    }

    if (qualityScore < qualityThreshold) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'quality_check',
        mensaje: `Calidad baja (${qualityScore}/${qualityThreshold}): ${qualityFeedback}`,
        detalles: { score: qualityScore, feedback: qualityFeedback, response: finalResponse },
      })

      // Don't derive to human — just log the alert and send anyway
      // The quality check is informational, not blocking
      await supabase.from('ia_alertas_supervisor').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'quality_rating_warning',
        mensaje: `Respuesta con calidad baja (${qualityScore}/10): ${qualityFeedback}`,
        leida: false,
      })
    }

    // === TIMING INTELIGENTE ===
    // Reduced max delay to 10s (was 45s) to stay within Edge Function limits
    const baseDelay = 3000
    const messageLength = finalResponse.length
    const readingTime = (messageContent || '').length * 20
    const typingTime = messageLength * 15
    const variance = 0.7 + Math.random() * 0.6
    let delay = Math.max(baseDelay, (readingTime + typingTime) * variance)
    // Cap at 10s to avoid Edge Function timeout
    delay = Math.min(delay, 10000)

    // Use lead's active hours for timing preference (bonus: seems more human)
    if (convo.step === 'first_message') {
      delay = Math.min(delay, 5000) // Fast on first message
    }

    await sleep(delay)

    // === SEND RESPONSE ===
    // Split by "---" delimiter first, then fallback to smart splitting
    let messageParts: string[] = finalResponse
      .split(/\n\s*---\s*\n|^\s*---\s*\n|\n\s*---\s*$/gm)
      .map(p => p.replace(/\n+/g, ' ').trim())
      .filter(p => p.length > 0)

    // Fallback: if no --- delimiter found and response is long, split on double newlines
    if (messageParts.length <= 1 && finalResponse.length > 60) {
      messageParts = finalResponse
        .split(/\n\n+/)
        .map(p => p.replace(/\n+/g, ' ').trim())
        .filter(p => p.length > 0)
    }

    // Fallback 2: if still one block and long, split on sentence boundaries
    if (messageParts.length <= 1 && finalResponse.length > 80) {
      const text = messageParts[0] || finalResponse
      // Split after sentence-ending punctuation followed by space
      const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 0)
      if (sentences.length >= 3) {
        // Group sentences into 2-3 messages
        const perMsg = Math.ceil(sentences.length / 3)
        messageParts = []
        for (let s = 0; s < sentences.length; s += perMsg) {
          messageParts.push(sentences.slice(s, s + perMsg).join(' ').trim())
        }
      } else if (sentences.length === 2) {
        messageParts = sentences.map(s => s.trim())
      }
    }

    messageParts = messageParts.filter(p => p.length > 0).slice(0, 4) // Max 4 messages

    console.log(`[split] Response split into ${messageParts.length} parts`)

    // === PRE-SEND CHECK: Did lead send more messages while AI was thinking? ===
    // Compare latest inbound message timestamp vs when we acquired the lock.
    // If a newer inbound arrived, discard this response — the webhook debounce
    // will fire a new processing cycle with the complete context.
    const { data: latestInbound } = await supabase
      .from('ia_mensajes')
      .select('created_at')
      .eq('conversacion_id', conversacionId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: convoLock } = await supabase
      .from('ia_conversaciones')
      .select('processing_lock_at')
      .eq('id', conversacionId)
      .single()

    if (latestInbound && convoLock?.processing_lock_at) {
      const lastMsgTime = new Date(latestInbound.created_at).getTime()
      const lockTime = new Date(convoLock.processing_lock_at).getTime()
      if (lastMsgTime > lockTime) {
        console.log(`[interrupt] New inbound arrived after lock — discarding response`)
        try { await supabase.from('ia_logs').insert({
          agente_id: agenteId,
          conversacion_id: conversacionId,
          tipo: 'info',
          mensaje: `Respuesta descartada: el lead envió mensaje(s) mientras la IA pensaba. Se re-procesará con contexto completo.`,
        }) } catch (_e) { /* ignore */ }
        return jsonResponse({ status: 'discarded', reason: 'new_inbound_during_thinking' })
      }
    }

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

    if (!sendRes.ok || sendResult.sent === 0) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'error',
        mensaje: `Error al enviar respuesta: ${JSON.stringify(sendResult).substring(0, 300)}`,
      })

      // Alert: lead without response
      await supabase.from('ia_alertas_supervisor').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'error',
        mensaje: `No se pudo enviar respuesta al lead. Error de WhatsApp.`,
        leida: false,
      })
    }

    // === UPDATE CONVERSATION STATE ===
    const convoUpdates: Record<string, unknown> = {
      last_bot_message_at: new Date().toISOString(),
    }

    if (convo.step === 'first_message') {
      convoUpdates.step = 'qualify'
    }

    // Advance qualify → meeting_pref when lead shows enough interest
    const meetingScoreThreshold = (agentConfig.umbral_score_reunion as number) || 65
    const { count: exchangeCount } = await supabase
      .from('ia_mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', conversacionId)
      .eq('direction', 'inbound')

    if (convo.step === 'qualify') {
      const exchanges = exchangeCount || 0
      // Fast track: high score after just 1 exchange (lead showed clear interest/pain)
      const fastTrack = scoring.score >= 70 && exchanges >= 1
      // Normal track: decent score after 2+ exchanges
      const normalTrack = scoring.score >= meetingScoreThreshold && exchanges >= 2

      if (fastTrack || normalTrack) {
        convoUpdates.step = 'meeting_pref'
      }
    }

    // Mark objection as resolved if bot responded after objection
    if (objection) {
      await supabase
        .from('ia_objeciones')
        .update({
          resuelta: true,
          estrategia_usada: `Respuesta automática: "${finalResponse.substring(0, 100)}"`,
        })
        .eq('conversacion_id', conversacionId)
        .eq('resuelta', false)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    // === AI-POWERED SUMMARY ===
    const newResumen = await generateSummary(
      convo.resumen, messageContent, finalResponse, anthropicKey,
    )
    convoUpdates.resumen = newResumen

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
          .update({ calidad_score: qualityScore, sentimiento: sentiment })
          .eq('id', lastMsg.id)
      }
    }

    // === LOG COSTS (atomic increment via RPC) ===
    const today = getMadridDate()
    // Claude Sonnet 4 pricing: $3/MTok in, $15/MTok out
    const claudeCost = (tokensIn * 3 + tokensOut * 15) / 1_000_000

    try { await supabase.rpc('ia_increment_costes', {
      p_agente_id: agenteId,
      p_fecha: today,
      p_claude_calls: 1,
      p_claude_tokens_in: tokensIn,
      p_claude_tokens_out: tokensOut,
      p_claude_coste: claudeCost,
    }) } catch (_e) { /* ignore */ }

    // === UPDATE METRICS (atomic increment via RPC) ===
    try { await supabase.rpc('ia_increment_metricas', {
      p_agente_id: agenteId,
      p_fecha: today,
      p_ab_version: convo.ab_version || 'A',
      p_mensajes_enviados: messageParts.length,
      p_mensajes_recibidos: 1,
      p_objeciones_detectadas: objection ? 1 : 0,
      p_objeciones_resueltas: objection ? 1 : 0,
    }) } catch (_e) { /* ignore */ }

    // === CRM SYNC (fire and forget) ===
    if (convo.step === 'first_message') {
      fetch(`${supabaseUrl}/functions/v1/ia-crm-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ conversacion_id: conversacionId, action: 'etapa_contactado' }),
      }).catch(() => {})
    }

    // === LOG ===
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'ai_call',
      mensaje: `Respuesta generada (quality: ${qualityScore}/10, delay: ${Math.round(delay / 1000)}s, tools: ${toolCalls}, score: ${scoring.score})`,
      detalles: {
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        quality_score: qualityScore,
        quality_feedback: qualityFeedback,
        delay_ms: delay,
        tool_calls: toolCalls,
        response_parts: messageParts.length,
        guardrails_issues: guardrails.issues,
        sentiment,
        lead_score: scoring.score,
        objection: objection?.tipo || null,
      },
    })

    return jsonResponse({
      status: 'ok',
      quality_score: qualityScore,
      response_parts: messageParts.length,
      delay_ms: delay,
      sentiment,
      lead_score: scoring.score,
    })
  } catch (err) {
    console.error('Error processing message:', err)

    if (agenteId) {
      try { await supabase.from('ia_alertas_supervisor').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId || null,
        tipo: 'error',
        mensaje: `Error procesando mensaje: ${err}`,
        leida: false,
      }) } catch (_e) { /* ignore */ }

      try { await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId || null,
        tipo: 'error',
        mensaje: `Error en ia-process-message: ${err}`,
        detalles: { error: String(err), stack: String(err) },
      }) } catch (_e) { /* ignore */ }
    }

    return jsonResponse({ error: 'Processing failed', details: String(err) }, 500)
  } finally {
    // ALWAYS release lock
    await releaseLock(supabase, conversacionId).catch(() => {})
  }
})
