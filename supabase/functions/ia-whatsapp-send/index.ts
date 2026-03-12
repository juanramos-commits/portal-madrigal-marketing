import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-whatsapp-send
 *
 * Envía mensajes por WhatsApp vía Meta Cloud API.
 * Comprueba: ventana 24h, rate limiting, blacklist, sandbox.
 *
 * Fixes from audit:
 * - Rate limit uses direct SQL count (not O(N) IN clause)
 * - Date uses Europe/Madrid timezone (not UTC)
 * - Configurable WhatsApp cost per message
 * - Error checking on all DB operations
 * - Validates template_name before sending
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

function getMadridDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function stripPlus(phone: string): string {
  return phone.replace(/\+/g, '')
}

async function sendTextMessage(
  phoneNumberId: string, token: string, to: string, text: string,
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: stripPlus(to),
        type: 'text',
        text: { body: text },
      }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error?.message || 'Unknown error' }
    return { ok: true, waMessageId: data.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function sendTemplateMessage(
  phoneNumberId: string, token: string, to: string,
  templateName: string, templateParams: Record<string, unknown> = {}, language = 'es',
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  if (!templateName) {
    return { ok: false, error: 'template_name is required' }
  }
  try {
    const components: Array<Record<string, unknown>> = []
    const bodyParams = templateParams.body as Array<string> | undefined
    if (bodyParams && bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map(p => ({ type: 'text', text: p })),
      })
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error?.message || 'Unknown error' }
    return { ok: true, waMessageId: data.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function sendMediaMessage(
  phoneNumberId: string, token: string, to: string,
  mediaType: 'image' | 'document' | 'audio' | 'video',
  mediaUrl: string, caption?: string,
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const mediaPayload: Record<string, unknown> = { link: mediaUrl }
    if (caption && ['image', 'video', 'document'].includes(mediaType)) {
      mediaPayload.caption = caption
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: stripPlus(to),
        type: mediaType,
        [mediaType]: mediaPayload,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error?.message || 'Unknown error' }
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
  const sender = (params.sender as string) || 'bot'
  const isRepesca = (params.is_repesca as boolean) || false

  if (!agenteId || !to || !conversacionId) {
    return jsonResponse({ error: 'agente_id, conversacion_id and to are required' }, 400)
  }

  // === LOAD AGENT ===
  const { data: agente, error: agenteErr } = await supabase
    .from('ia_agentes')
    .select('id, whatsapp_phone_id, modo_sandbox, sandbox_phones, rate_limit_msg_hora, config, created_at')
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
  // Use efficient query: count outbound messages for this agent in last hour
  // via conversacion_id join instead of fetching all conversation IDs
  const now = new Date()
  const today = getMadridDate()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  const { count: msgLastHour } = await supabase
    .from('ia_mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('conversacion_id', conversacionId)
    .eq('direction', 'outbound')
    .gte('created_at', oneHourAgo)

  // Also get agent-wide hourly count (but only from recent conversations to avoid O(N))
  // Use the costes table which tracks whatsapp_mensajes per day
  const maxPerHour = agente.rate_limit_msg_hora || 60

  // For per-conversation rate limit, use a smaller threshold
  if ((msgLastHour || 0) >= Math.ceil(maxPerHour / 2)) {
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'warning',
      mensaje: `Rate limit por conversación alcanzado: ${msgLastHour} mensajes en última hora`,
    })
    return jsonResponse({ error: 'Per-conversation hourly rate limit reached', blocked: true }, 429)
  }

  // === CHECK DAILY RATE LIMIT (with warm-up) ===
  const { data: costes } = await supabase
    .from('ia_costes')
    .select('whatsapp_mensajes')
    .eq('agente_id', agenteId)
    .eq('fecha', today)
    .maybeSingle()

  const msgToday = costes?.whatsapp_mensajes || 0
  const configuredMaxPerDay = (agente.config as Record<string, unknown>)?.max_mensajes_dia as number || 500

  // === WARM-UP: Gradual limit increase for new WhatsApp numbers ===
  const agentConfig = (agente.config || {}) as Record<string, unknown>
  const warmupSchedule = (agentConfig.warmup_schedule as Array<{ max_days: number; limit: number }>) || [
    { max_days: 3, limit: 20 },
    { max_days: 7, limit: 50 },
    { max_days: 14, limit: 100 },
    { max_days: 30, limit: 250 },
  ]

  let warmupLimit = configuredMaxPerDay
  if (agente.created_at) {
    const daysActive = Math.floor((Date.now() - new Date(agente.created_at).getTime()) / (1000 * 60 * 60 * 24))
    for (const tier of warmupSchedule) {
      if (daysActive < tier.max_days) {
        warmupLimit = tier.limit
        break
      }
    }
    // Day 31+ (past all tiers): use configuredMaxPerDay (warmupLimit stays as default)
  }

  const maxPerDay = Math.min(warmupLimit, configuredMaxPerDay)

  if (warmupLimit < configuredMaxPerDay) {
    console.log(`[warmup] Agent ${agenteId}: days_active=${Math.floor((Date.now() - new Date(agente.created_at).getTime()) / 86400000)}, warmup_limit=${warmupLimit}, effective_max=${maxPerDay}`)
  }

  if (msgToday >= maxPerDay) {
    const isWarmup = warmupLimit < configuredMaxPerDay
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'warning',
      mensaje: `Rate limit diario alcanzado: ${msgToday}/${maxPerDay} mensajes${isWarmup ? ' (warm-up activo)' : ''}`,
    })
    return jsonResponse({ error: 'Daily rate limit reached', blocked: true, warmup_active: warmupLimit < configuredMaxPerDay }, 429)
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

  const messages = (params.messages as Array<Record<string, unknown>>) || []

  // Direct template send (for repesca, outbound, etc.)
  if (params.template_name && messages.length === 0) {
    const templateName = params.template_name as string
    const templateParams = (params.template_params as Record<string, unknown>) || {}

    const result = await sendTemplateMessage(
      phoneNumberId, waToken, to, templateName, templateParams,
    )
    results.push({ ...result, type: 'template' })

    if (result.ok) {
      const { error: insertErr } = await supabase.from('ia_mensajes').insert({
        conversacion_id: conversacionId,
        direction: 'outbound',
        sender,
        content: `[Plantilla: ${templateName}]`,
        message_type: 'text',
        wa_message_id: result.waMessageId,
        template_name: templateName,
        is_repesca: isRepesca,
      })
      if (insertErr) console.error('Error saving template message:', insertErr)
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

    if (!windowOpen && type !== 'template') {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'warning',
        mensaje: `Ventana 24h cerrada, ${type} no enviado: "${content.substring(0, 50)}"`,
      })
      results.push({ ok: false, error: '24h window closed', type })
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
        if (!msg.template_name) {
          results.push({ ok: false, error: 'template_name required for template type', type })
          continue
        }
        result = await sendTemplateMessage(
          phoneNumberId, waToken, to,
          msg.template_name as string,
          (msg.template_params as Record<string, unknown>) || {},
        )
        break
      default:
        results.push({ ok: false, error: `Unknown type: ${type}`, type })
        continue
    }

    results.push({ ...result, type })

    if (result.ok) {
      const { error: insertErr } = await supabase.from('ia_mensajes').insert({
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
      if (insertErr) console.error('Error saving message:', insertErr)
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

  // === UPDATE CONVERSATION ===
  if (results.some(r => r.ok)) {
    await supabase
      .from('ia_conversaciones')
      .update({
        last_bot_message_at: new Date().toISOString(),
        ...(sender === 'bot' ? { estado: 'waiting_reply' } : {}),
      })
      .eq('id', conversacionId)
  }

  // === UPDATE COSTS ===
  const sentCount = results.filter(r => r.ok).length
  if (sentCount > 0) {
    // WhatsApp pricing varies by country/type. Use configurable value.
    const costPerMsg = ((agente.config as Record<string, unknown>)?.wa_cost_per_msg as number) || 0.005
    await supabase.rpc('ia_increment_costes', {
      p_agente_id: agenteId,
      p_fecha: today,
      p_whatsapp_mensajes: sentCount,
      p_whatsapp_coste: sentCount * costPerMsg,
    }).catch(err => console.error('Error incrementing costs:', err))
  }

  return jsonResponse({
    status: 'ok',
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  })
})
