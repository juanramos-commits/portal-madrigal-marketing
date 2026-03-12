import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-enviar-manual
 *
 * Sends a message from a human operator via the portal.
 * Calls ia-whatsapp-send internally with sender='humano'.
 * Sets handoff_humano if not already set.
 *
 * POST body:
 *   conversacion_id: UUID (required)
 *   content: string (required)
 *   media_url: string (optional)
 *   media_type: 'image' | 'video' | 'audio' | 'document' (optional)
 *   usuario_id: UUID (required)
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const supabase = createClient(supabaseUrl, serviceKey)

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const conversacionId = params.conversacion_id as string
  const content = params.content as string
  const mediaUrl = params.media_url as string | undefined
  const mediaType = params.media_type as string | undefined
  const usuarioId = params.usuario_id as string

  if (!conversacionId || !content || !usuarioId) {
    return jsonResponse({ error: 'conversacion_id, content, and usuario_id are required' }, 400)
  }

  try {
    // === 1. Load conversation ===
    const { data: convo, error: convoErr } = await supabase
      .from('ia_conversaciones')
      .select('id, agente_id, lead_id, handoff_humano')
      .eq('id', conversacionId)
      .single()

    if (convoErr || !convo) {
      return jsonResponse({ error: 'Conversation not found' }, 404)
    }

    // === 2. Load lead ===
    const { data: lead, error: leadErr } = await supabase
      .from('ia_leads')
      .select('id, telefono')
      .eq('id', convo.lead_id)
      .single()

    if (leadErr || !lead) {
      return jsonResponse({ error: 'Lead not found' }, 404)
    }

    // === 3. Build messages array for ia-whatsapp-send ===
    const messages: Array<Record<string, unknown>> = []

    if (mediaUrl && mediaType) {
      messages.push({
        type: mediaType,
        content: content,
        media_url: mediaUrl,
      })
    } else {
      messages.push({
        type: 'text',
        content: content,
      })
    }

    // === 4. Call ia-whatsapp-send ===
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/ia-whatsapp-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        agente_id: convo.agente_id,
        conversacion_id: conversacionId,
        to: lead.telefono,
        sender: 'humano',
        messages,
      }),
    })

    const sendResult = await sendRes.json()

    if (!sendRes.ok || sendResult.error) {
      await supabase.from('ia_logs').insert({
        agente_id: convo.agente_id,
        conversacion_id: conversacionId,
        tipo: 'error',
        mensaje: `Error en envío manual por usuario ${usuarioId}: ${sendResult.error || 'Unknown'}`,
        detalles: sendResult,
      })
      return jsonResponse({
        error: 'Failed to send message',
        details: sendResult.error || 'Unknown error',
      }, 500)
    }

    // === 5. Set handoff_humano if not already set ===
    if (!convo.handoff_humano) {
      await supabase
        .from('ia_conversaciones')
        .update({ handoff_humano: true })
        .eq('id', conversacionId)
    }

    // === 6. Update last_bot_message_at ===
    await supabase
      .from('ia_conversaciones')
      .update({ last_bot_message_at: new Date().toISOString() })
      .eq('id', conversacionId)

    // === 7. Log ===
    await supabase.from('ia_logs').insert({
      agente_id: convo.agente_id,
      conversacion_id: conversacionId,
      tipo: 'info',
      mensaje: `Mensaje manual enviado por usuario ${usuarioId}: "${content.substring(0, 80)}"`,
    })

    return jsonResponse({ status: 'ok' })
  } catch (err) {
    console.error('Fatal error in ia-enviar-manual:', err)

    await supabase.from('ia_logs').insert({
      conversacion_id: conversacionId,
      tipo: 'error',
      mensaje: `Error en ia-enviar-manual: ${String(err)}`,
      detalles: { error: String(err), stack: (err as Error).stack },
    }).catch(() => {})

    return jsonResponse({ error: 'Internal error', details: String(err) }, 500)
  }
})
