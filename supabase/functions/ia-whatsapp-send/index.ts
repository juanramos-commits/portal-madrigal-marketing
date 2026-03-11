import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-whatsapp-send
 *
 * Envía mensajes por WhatsApp vía Meta Cloud API.
 * Comprueba: ventana 24h, rate limiting, blacklist, sandbox.
 *
 * Soporta:
 * - Texto libre (dentro de ventana 24h)
 * - Plantillas (fuera de ventana 24h)
 * - Media: imágenes, documentos, audio, video
 *
 * Params (POST body):
 *   agente_id: UUID del agente (required)
 *   conversacion_id: UUID de la conversación (required)
 *   to: Teléfono destino E.164 (required)
 *   messages: Array de { type, content, media_url?, template_name?, template_params? }
 *   sender: 'bot' | 'humano' (default 'bot')
 *   is_repesca: boolean (default false)
 *   template_name: string (para envío directo de plantilla sin messages)
 *   template_params: object (params de la plantilla)
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

// Strip all '+' characters for Meta API (use regex for global replace)
function stripPlus(phone: string): string {
  return phone.replace(/\+/g, '')
}

async function sendTextMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  text: string,
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: stripPlus(to),
          type: 'text',
          text: { body: text },
        }),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error?.message || 'Unknown error' }
    }
    return { ok: true, waMessageId: data.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function sendTemplateMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  templateName: string,
  templateParams: Record<string, unknown> = {},
  language = 'es',
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const components: Array<Record<string, unknown>> = []
    const bodyParams = templateParams.body as Array<string> | undefined
    if (bodyParams && bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map(p => ({ type: 'text', text: p })),
      })
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: stripPlus(to),
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error?.message || 'Unknown error' }
    }
    return { ok: true, waMessageId: data.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function sendMediaMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  mediaType: 'image' | 'document' | 'audio' | 'video',
  mediaUrl: string,
  caption?: string,
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const mediaPayload: Record<string, unknown> = { link: mediaUrl }
    if (caption && ['image', 'video', 'document'].includes(mediaType)) {
      mediaPayload.caption = caption
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: stripPlus(to),
          type: mediaType,
          [mediaType]: mediaPayload,
        }),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error?.message || 'Unknown error' }
    }
    return { ok: true, waMessageId: data.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
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
  const waToken = Deno.env.get('WA_ACCESS_TOKEN') ?? ''

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const agenteId = params.agente_id as string
  const conversacionId = params.conversacion_id as string
  const to = params.to as string
  const sender = (params.sender as string) ?? 'bot'
  const isRepesca = (params.is_repesca as boolean) ?? false

  if (!agenteId || !to || !conversacionId) {
    return jsonResponse({ error: 'agente_id, conversacion_id and to are required' }, 400)
  }

  // === LOAD AGENT (only needed fields) ===
  const { data: agente, error: agenteErr } = await supabase
    .from('ia_agentes')
    .select('id, whatsapp_phone_id, modo_sandbox, sandbox_phones, rate_limit_msg_hora, config')
    .eq('id', agenteId)
    .single()

  if (agenteErr || !agente) {
    return jsonResponse({ error: 'Agent not found' }, 404)
  }

  const phoneNumberId = agente.whatsapp_phone_id
  if (!phoneNumberId) {
    return jsonResponse({ error: 'Agent has no WhatsApp phone configured' }, 400)
  }

  // === CHECK BLACKLIST ===
  const { data: blacklisted } = await supabase
    .from('ia_blacklist')
    .select('id')
    .eq('telefono', to)
    .maybeSingle()

  if (blacklisted) {
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'info',
      mensaje: `Envío bloqueado: ${to} está en blacklist`,
    })
    return jsonResponse({ error: 'Phone is blacklisted', blocked: true }, 403)
  }

  // === CHECK SANDBOX MODE ===
  if (agente.modo_sandbox) {
    const allowed = agente.sandbox_phones || []
    if (!allowed.includes(to)) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'info',
        mensaje: `Envío bloqueado en sandbox: ${to} no autorizado`,
      })
      return jsonResponse({ error: 'Phone not in sandbox list', blocked: true }, 403)
    }
  }

  // === CHECK RATE LIMITING (hourly) ===
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  // Get agent's conversation IDs first, then count messages
  const { data: agentConvos } = await supabase
    .from('ia_conversaciones')
    .select('id')
    .eq('agente_id', agenteId)

  const convoIds = (agentConvos || []).map(c => c.id)

  if (convoIds.length > 0) {
    const { count: msgLastHour } = await supabase
      .from('ia_mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('created_at', oneHourAgo)
      .in('conversacion_id', convoIds)

    const maxPerHour = agente.rate_limit_msg_hora || 60
    if ((msgLastHour || 0) >= maxPerHour) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'warning',
        mensaje: `Rate limit horario alcanzado: ${msgLastHour}/${maxPerHour} mensajes/hora`,
      })
      return jsonResponse({ error: 'Hourly rate limit reached', blocked: true }, 429)
    }
  }

  // === CHECK DAILY RATE LIMIT ===
  const { data: costes } = await supabase
    .from('ia_costes')
    .select('whatsapp_mensajes')
    .eq('agente_id', agenteId)
    .eq('fecha', today)
    .maybeSingle()

  const msgToday = costes?.whatsapp_mensajes || 0
  const maxPerDay = agente.config?.max_mensajes_dia || 500

  if (msgToday >= maxPerDay) {
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'warning',
      mensaje: `Rate limit diario alcanzado: ${msgToday}/${maxPerDay} mensajes`,
    })
    return jsonResponse({ error: 'Daily rate limit reached', blocked: true }, 429)
  }

  // === CHECK 24H WINDOW ===
  const { data: convo } = await supabase
    .from('ia_conversaciones')
    .select('wa_window_expires_at')
    .eq('id', conversacionId)
    .single()

  let windowOpen = false
  if (convo?.wa_window_expires_at) {
    windowOpen = new Date(convo.wa_window_expires_at) > now
  }

  // === SEND MESSAGES ===
  const results: Array<{
    ok: boolean
    waMessageId?: string
    error?: string
    type: string
  }> = []

  // Direct template send (for repesca, outbound, etc.)
  // Only if there are no messages in the array (avoid duplicates)
  const messages = (params.messages as Array<Record<string, unknown>>) || []

  if (params.template_name && messages.length === 0) {
    const templateName = params.template_name as string
    const templateParams = (params.template_params as Record<string, unknown>) || {}

    const result = await sendTemplateMessage(
      phoneNumberId, waToken, to, templateName, templateParams,
    )
    results.push({ ...result, type: 'template' })

    if (result.ok) {
      await supabase.from('ia_mensajes').insert({
        conversacion_id: conversacionId,
        direction: 'outbound',
        sender,
        content: `[Plantilla: ${templateName}]`,
        message_type: 'text',
        wa_message_id: result.waMessageId,
        template_name: templateName,
        is_repesca: isRepesca,
      })
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const type = msg.type as string
    const content = (msg.content as string) || ''
    const mediaUrl = msg.media_url as string | undefined

    if (i > 0) {
      await sleep(1000 + Math.random() * 1000)
    }

    let result: { ok: boolean; waMessageId?: string; error?: string }

    // If window is closed, block ALL free-form messages (text AND media)
    // Only templates can be sent outside the 24h window
    if (!windowOpen && type !== 'template') {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'warning',
        mensaje: `Ventana 24h cerrada, ${type} no enviado (requiere plantilla): "${content.substring(0, 50)}"`,
      })
      results.push({
        ok: false,
        error: '24h window closed, template required',
        type,
      })
      continue
    }

    switch (type) {
      case 'text':
        result = await sendTextMessage(phoneNumberId, waToken, to, content)
        break
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        if (!mediaUrl) {
          results.push({ ok: false, error: 'media_url required', type })
          continue
        }
        result = await sendMediaMessage(
          phoneNumberId, waToken, to,
          type as 'image' | 'video' | 'audio' | 'document',
          mediaUrl, content || undefined,
        )
        break
      case 'template':
        result = await sendTemplateMessage(
          phoneNumberId, waToken, to,
          msg.template_name as string,
          (msg.template_params as Record<string, unknown>) || {},
        )
        break
      default:
        results.push({ ok: false, error: `Unknown message type: ${type}`, type })
        continue
    }

    results.push({ ...result, type })

    if (result.ok) {
      await supabase.from('ia_mensajes').insert({
        conversacion_id: conversacionId,
        direction: 'outbound',
        sender,
        content: content || `[${type}]`,
        message_type: type === 'template' ? 'text' : type,
        media_url: mediaUrl || null,
        wa_message_id: result.waMessageId,
        template_name: type === 'template' ? (msg.template_name as string) : null,
        is_repesca: isRepesca,
      })
    }

    if (!result.ok) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'error',
        mensaje: `Error enviando ${type} a ${to}: ${result.error}`,
      })
    }
  }

  // === UPDATE CONVERSATION TIMESTAMPS ===
  if (results.some(r => r.ok)) {
    await supabase
      .from('ia_conversaciones')
      .update({
        last_bot_message_at: new Date().toISOString(),
        ...(sender === 'bot' ? { estado: 'waiting_reply' } : {}),
      })
      .eq('id', conversacionId)
  }

  // === UPDATE COSTS (atomic increment via RPC) ===
  const sentCount = results.filter(r => r.ok).length
  if (sentCount > 0) {
    const costPerMsg = 0.005
    await supabase.rpc('ia_increment_costes', {
      p_agente_id: agenteId,
      p_fecha: today,
      p_whatsapp_mensajes: sentCount,
      p_whatsapp_coste: sentCount * costPerMsg,
    })
  }

  return jsonResponse({
    status: 'ok',
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  })
})
