import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-transferir-lead
 *
 * Transfers a conversation to a different agent.
 * Keeps all messages, lead, and history intact.
 * Resets outbound sequence state.
 *
 * POST body:
 *   conversacion_id: UUID (required)
 *   agente_destino_id: UUID (required)
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

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const conversacionId = params.conversacion_id as string
  const agenteDestinoId = params.agente_destino_id as string

  if (!conversacionId || !agenteDestinoId) {
    return jsonResponse({ error: 'conversacion_id and agente_destino_id are required' }, 400)
  }

  try {
    // === 1. Load and verify conversation ===
    const { data: convo, error: convoErr } = await supabase
      .from('ia_conversaciones')
      .select('id, agente_id, lead_id')
      .eq('id', conversacionId)
      .single()

    if (convoErr || !convo) {
      return jsonResponse({ error: 'Conversation not found' }, 404)
    }

    const fromAgenteId = convo.agente_id

    if (fromAgenteId === agenteDestinoId) {
      return jsonResponse({ error: 'Source and destination agents are the same' }, 400)
    }

    // === 2. Load and verify destination agent ===
    const { data: destAgente, error: destErr } = await supabase
      .from('ia_agentes')
      .select('id, activo, nombre')
      .eq('id', agenteDestinoId)
      .single()

    if (destErr || !destAgente) {
      return jsonResponse({ error: 'Destination agent not found' }, 404)
    }

    if (!destAgente.activo) {
      return jsonResponse({ error: 'Destination agent is inactive' }, 400)
    }

    // === 3. Load source agent name for logging ===
    const { data: srcAgente } = await supabase
      .from('ia_agentes')
      .select('nombre')
      .eq('id', fromAgenteId)
      .single()

    // === 4. Transfer conversation ===
    const { error: updateErr } = await supabase
      .from('ia_conversaciones')
      .update({
        agente_id: agenteDestinoId,
        secuencia_outbound_step: null,
        secuencia_outbound_next_at: null,
      })
      .eq('id', conversacionId)

    if (updateErr) {
      console.error('Error transferring conversation:', updateErr)
      return jsonResponse({ error: 'Failed to transfer conversation', details: updateErr.message }, 500)
    }

    // === 5. Log transfer for source agent ===
    await supabase.from('ia_logs').insert({
      agente_id: fromAgenteId,
      conversacion_id: conversacionId,
      tipo: 'info',
      mensaje: `Conversación transferida a agente "${destAgente.nombre || agenteDestinoId}"`,
    })

    // === 6. Log transfer for destination agent ===
    await supabase.from('ia_logs').insert({
      agente_id: agenteDestinoId,
      conversacion_id: conversacionId,
      tipo: 'info',
      mensaje: `Conversación recibida de agente "${srcAgente?.nombre || fromAgenteId}"`,
    })

    return jsonResponse({
      status: 'ok',
      conversacion_id: conversacionId,
      from_agente: fromAgenteId,
      to_agente: agenteDestinoId,
    })
  } catch (err) {
    console.error('Fatal error in ia-transferir-lead:', err)

    await supabase.from('ia_logs').insert({
      conversacion_id: conversacionId,
      tipo: 'error',
      mensaje: `Error en ia-transferir-lead: ${String(err)}`,
      detalles: { error: String(err), stack: (err as Error).stack },
    }).catch(() => {})

    return jsonResponse({ error: 'Internal error', details: String(err) }, 500)
  }
})
