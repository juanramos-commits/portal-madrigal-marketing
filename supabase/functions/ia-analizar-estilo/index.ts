import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * ia-analizar-estilo
 *
 * Analyzes a human team member's writing style from their messages.
 * Uses Claude Haiku to extract: avg length, emoji usage, common expressions, tone.
 * Upserts result in ia_estilos_equipo.
 *
 * POST body:
 *   agente_id: UUID (required)
 *   usuario_id: UUID (required)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-supabase-api-version',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

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

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!anthropicApiKey) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  }

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const agenteId = params.agente_id as string
  const usuarioId = params.usuario_id as string

  if (!agenteId || !usuarioId) {
    return jsonResponse({ error: 'agente_id and usuario_id are required' }, 400)
  }

  try {
    // === 1. Verify agent exists ===
    const { data: agente, error: agenteErr } = await supabase
      .from('ia_agentes')
      .select('id, nombre')
      .eq('id', agenteId)
      .single()

    if (agenteErr || !agente) {
      return jsonResponse({ error: 'Agent not found' }, 404)
    }

    // === 2. Get conversation IDs for this agent ===
    const { data: convos, error: convosErr } = await supabase
      .from('ia_conversaciones')
      .select('id')
      .eq('agente_id', agenteId)

    if (convosErr) {
      return jsonResponse({ error: 'Failed to fetch conversations', details: convosErr.message }, 500)
    }

    const convoIds = (convos || []).map(c => c.id)

    if (convoIds.length === 0) {
      return jsonResponse({ error: 'Not enough messages to analyze' }, 400)
    }

    // === 3. Query human messages for these conversations ===
    const { data: mensajes, error: msgErr } = await supabase
      .from('ia_mensajes')
      .select('content, created_at')
      .eq('sender', 'humano')
      .in('conversacion_id', convoIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (msgErr) {
      return jsonResponse({ error: 'Failed to fetch messages', details: msgErr.message }, 500)
    }

    if (!mensajes || mensajes.length < 5) {
      return jsonResponse({ error: 'Not enough messages to analyze' }, 400)
    }

    // === 4. Call Claude Haiku to analyze style ===
    const messagesText = mensajes
      .map((m, i) => `${i + 1}. "${m.content}"`)
      .join('\n')

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Analiza el estilo de escritura de estos mensajes de WhatsApp enviados por un miembro del equipo comercial. Devuelve SOLO un JSON válido (sin markdown, sin bloques de código) con esta estructura exacta:

{
  "longitud_promedio": <número de caracteres promedio por mensaje>,
  "uso_emojis": "<alto|medio|bajo|ninguno>",
  "emojis_frecuentes": ["emoji1", "emoji2"],
  "expresiones_comunes": ["expresión1", "expresión2", "expresión3"],
  "tono": "<formal|informal|amigable|profesional>",
  "caracteristicas": ["característica1", "característica2"],
  "saludo_tipico": "<cómo suele saludar>",
  "despedida_tipica": "<cómo suele despedirse>",
  "usa_signos_exclamacion": <true|false>,
  "usa_abreviaciones": <true|false>
}

Mensajes a analizar:
${messagesText}`,
          },
        ],
      }),
    })

    if (!claudeRes.ok) {
      const claudeError = await claudeRes.text()
      console.error('Claude API error:', claudeError)
      return jsonResponse({ error: 'Claude API error', details: claudeError }, 500)
    }

    const claudeData = await claudeRes.json()
    const rawContent = claudeData.content?.[0]?.text || '{}'

    let estilo: Record<string, unknown>
    try {
      estilo = JSON.parse(rawContent)
    } catch {
      console.error('Failed to parse Claude response:', rawContent)
      return jsonResponse({ error: 'Failed to parse style analysis', raw: rawContent }, 500)
    }

    // === 5. Upsert in ia_estilos_equipo ===
    const { error: upsertErr } = await supabase
      .from('ia_estilos_equipo')
      .upsert(
        {
          agente_id: agenteId,
          usuario_id: usuarioId,
          estilo,
          mensajes_analizados: mensajes.length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agente_id,usuario_id' },
      )

    if (upsertErr) {
      console.error('Error upserting style:', upsertErr)
      return jsonResponse({ error: 'Failed to save style analysis', details: upsertErr.message }, 500)
    }

    // === 6. Log ===
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      tipo: 'info',
      mensaje: `Estilo analizado para usuario ${usuarioId}: ${mensajes.length} mensajes procesados, tono: ${estilo.tono}`,
    })

    return jsonResponse({
      status: 'ok',
      estilo,
      mensajes_analizados: mensajes.length,
    })
  } catch (err) {
    console.error('Fatal error in ia-analizar-estilo:', err)

    try { await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      tipo: 'error',
      mensaje: `Error en ia-analizar-estilo: ${String(err)}`,
      detalles: { error: String(err), stack: String(err) },
    }) } catch (_e) { /* ignore */ }

    return jsonResponse({ error: 'Internal error', details: String(err) }, 500)
  }
})
