import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * ia-learn-cron
 *
 * Runs weekly. Analyzes successful vs failed conversations,
 * extracts winning patterns, and stores them as learned rules
 * that get injected into the agent's system prompt context.
 *
 * Flow:
 * 1. Load conversations that ended in 'agendado' (wins) and 'descartado'/'no_response' (losses)
 * 2. Send conversation transcripts to Claude for pattern extraction
 * 3. Store learned patterns in ia_aprendizajes
 * 4. Patterns are injected into process-message context automatically
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!anthropicKey) {
    return jsonRes({ error: 'No Anthropic key' }, 500)
  }

  try {
    // Get all active agents
    const { data: agentes } = await supabase
      .from('ia_agentes')
      .select('id, nombre, tipo')
      .eq('activo', true)

    if (!agentes || agentes.length === 0) {
      return jsonRes({ status: 'ok', message: 'No active agents' })
    }

    const results = []

    for (const agente of agentes) {
      // Get last analysis date
      const { data: lastLearn } = await supabase
        .from('ia_aprendizajes')
        .select('created_at')
        .eq('agente_id', agente.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const since = lastLearn?.created_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Load WINNING conversations (agendado)
      const { data: wins } = await supabase
        .from('ia_conversaciones')
        .select('id, estado, step, resumen')
        .eq('agente_id', agente.id)
        .eq('estado', 'agendado')
        .gt('updated_at', since)
        .limit(10)

      // Load LOSING conversations (descartado, no_response with messages)
      const { data: losses } = await supabase
        .from('ia_conversaciones')
        .select('id, estado, step, resumen')
        .eq('agente_id', agente.id)
        .in('estado', ['descartado', 'no_response'])
        .gt('updated_at', since)
        .limit(10)

      const totalConvos = (wins?.length || 0) + (losses?.length || 0)
      if (totalConvos < 3) {
        results.push({ agente: agente.nombre, skipped: true, reason: 'Not enough conversations to learn from' })
        continue
      }

      // Load full message transcripts for wins and losses
      const winTranscripts = await loadTranscripts(supabase, wins || [])
      const lossTranscripts = await loadTranscripts(supabase, losses || [])

      if (winTranscripts.length === 0 && lossTranscripts.length === 0) {
        results.push({ agente: agente.nombre, skipped: true, reason: 'No transcripts' })
        continue
      }

      // Call Claude to analyze patterns
      const analysis = await analyzeWithClaude(anthropicKey, agente, winTranscripts, lossTranscripts)

      if (!analysis) {
        results.push({ agente: agente.nombre, error: 'Claude analysis failed' })
        continue
      }

      // Store learned patterns
      const insertRows = []
      const winConvIds = (wins || []).map(w => w.id)
      const lossConvIds = (losses || []).map(l => l.id)

      for (const pattern of analysis.patrones_ganadores || []) {
        insertRows.push({
          agente_id: agente.id,
          tipo: 'patron_ganador',
          contenido: pattern,
          fuente_conversaciones: winConvIds,
          confianza: Math.min(0.99, 0.5 + (wins?.length || 0) * 0.05),
        })
      }

      for (const pattern of analysis.patrones_perdedores || []) {
        insertRows.push({
          agente_id: agente.id,
          tipo: 'patron_perdedor',
          contenido: pattern,
          fuente_conversaciones: lossConvIds,
          confianza: Math.min(0.99, 0.5 + (losses?.length || 0) * 0.05),
        })
      }

      for (const rule of analysis.reglas_aprendidas || []) {
        insertRows.push({
          agente_id: agente.id,
          tipo: 'regla_aprendida',
          contenido: rule,
          fuente_conversaciones: [...winConvIds, ...lossConvIds],
          confianza: Math.min(0.99, 0.5 + totalConvos * 0.03),
        })
      }

      if (insertRows.length > 0) {
        await supabase.from('ia_aprendizajes').insert(insertRows)
      }

      await supabase.from('ia_logs').insert({
        agente_id: agente.id,
        tipo: 'info',
        mensaje: `Aprendizaje completado: ${analysis.patrones_ganadores?.length || 0} patrones ganadores, ${analysis.patrones_perdedores?.length || 0} perdedores, ${analysis.reglas_aprendidas?.length || 0} reglas. Basado en ${wins?.length || 0} wins y ${losses?.length || 0} losses.`,
      })

      results.push({
        agente: agente.nombre,
        wins: wins?.length || 0,
        losses: losses?.length || 0,
        patterns_learned: insertRows.length,
      })
    }

    return jsonRes({ status: 'ok', results })
  } catch (err) {
    console.error('Learn cron error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})

async function loadTranscripts(
  supabase: ReturnType<typeof createClient>,
  conversations: Array<Record<string, unknown>>,
): Promise<string[]> {
  const transcripts: string[] = []

  for (const conv of conversations) {
    const { data: msgs } = await supabase
      .from('ia_mensajes')
      .select('direction, content, message_type')
      .eq('conversacion_id', conv.id as string)
      .order('created_at')
      .limit(30)

    if (!msgs || msgs.length < 2) continue

    const transcript = msgs
      .filter((m: Record<string, unknown>) => m.message_type === 'text' || m.message_type === 'nota_interna')
      .map((m: Record<string, unknown>) => {
        const who = m.direction === 'inbound' ? 'Lead' : 'Bot'
        return `${who}: ${(m.content as string).substring(0, 200)}`
      })
      .join('\n')

    const header = `[${(conv.estado as string).toUpperCase()}] Resumen: ${conv.resumen || 'sin resumen'}`
    transcripts.push(`${header}\n${transcript}`)
  }

  return transcripts
}

async function analyzeWithClaude(
  apiKey: string,
  agente: Record<string, unknown>,
  wins: string[],
  losses: string[],
): Promise<{
  patrones_ganadores: string[]
  patrones_perdedores: string[]
  reglas_aprendidas: string[]
} | null> {
  const prompt = `Eres un analista de ventas experto. Analiza estas conversaciones de WhatsApp de un setter comercial (agente "${agente.nombre}", tipo: ${agente.tipo}).

CONVERSACIONES QUE AGENDARON REUNIÓN (ÉXITO):
${wins.length > 0 ? wins.join('\n\n---\n\n') : 'No hay conversaciones exitosas aún.'}

CONVERSACIONES QUE SE PERDIERON (FRACASO):
${losses.length > 0 ? losses.join('\n\n---\n\n') : 'No hay conversaciones perdidas aún.'}

Analiza y extrae:

1. PATRONES GANADORES: Qué hizo el bot en las conversaciones exitosas que funcionó. Frases concretas, timing, tipo de preguntas. Máximo 5 patrones.

2. PATRONES PERDEDORES: Qué hizo el bot en las conversaciones fallidas que causó el abandono. Errores concretos. Máximo 5 patrones.

3. REGLAS APRENDIDAS: Reglas concretas y accionables para mejorar. Formato: "SIEMPRE haz X" o "NUNCA hagas Y". Máximo 5 reglas.

Responde ÚNICAMENTE con JSON:
{"patrones_ganadores": ["..."], "patrones_perdedores": ["..."], "reglas_aprendidas": ["..."]}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    try {
      return JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) return JSON.parse(match[0])
      return null
    }
  } catch {
    return null
  }
}

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
