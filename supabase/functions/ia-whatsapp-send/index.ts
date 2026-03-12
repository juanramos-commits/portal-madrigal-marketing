import { createClient } from 'jsr:@supabase/supabase-js@2'

// Actual text of WhatsApp templates as approved in Meta
// Used to store the real message in ia_mensajes so AI and UI can read it
function resolveTemplateText(
  templateName: string,
  params: Record<string, unknown>,
): string {
  const bodyParams = params.body as Record<string, string> | undefined
  const nombre = bodyParams?.nombre || 'amigo/a'

  const TEMPLATES: Record<string, string> = {
    'primer_mensaje_formulario':
      `Hola ${nombre}, soy Rosalía, del equipo de Madrigal Marketing. Hemos recibido tu solicitud de información sobre nuestros servicios. Cuéntame, qué es lo que más te está frenando ahora mismo para conseguir más clientes?`,
    'hola_he_visto_que_nos_has_vuelto_a_rellenar_el_formulario_en_que_te_puedo_ayudar':
      `Hola! He visto que nos has vuelto a rellenar el formulario, en qué te puedo ayudar?`,
    'ests_por_aqui':
      `Estás por aquí?`,
    'ojitos':
      `👀`,
    'ultimo_toque_y_no_molesto_mas__seguimos_o_lo_dejamos_aqui':
      `Último toque y no molesto más, seguimos o lo dejamos aquí?`,
    're_contacto_rosalia_1':
      `Hola! Soy Rosalía de Madrigal Marketing. Acabo de incorporarme como directora del Departamento de Desarrollo de Proveedores y estoy revisando nuestra base de contactos.`,
    're_contacto_rosalia_2':
      `He visto que en su momento solicitaste información sobre nuestros servicios y quería saber si sigues en el sector y te interesaría que te cuente las novedades para la campaña 2026.`,
    're_contacto_rosalia_3':
      `Un saludo!`,
  }

  return TEMPLATES[templateName] || `[Plantilla: ${templateName}]`
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey, x-supabase-api-version',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getMadridDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

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
    if (!res.ok)
      return { ok: false, error: data.error?.message || 'Unknown error' }
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
  if (!templateName) {
    return { ok: false, error: 'template_name is required' }
  }
  try {
    const components: Array<Record<string, unknown>> = []

    const rawBody = templateParams.body
    if (rawBody) {
      if (Array.isArray(rawBody)) {
        components.push({
          type: 'body',
          parameters: (rawBody as string[]).map((p) => ({
            type: 'text',
            text: p,
          })),
        })
      } else if (typeof rawBody === 'object') {
        components.push({
          type: 'body',
          parameters: Object.entries(rawBody as Record<string, string>).map(
            ([name, value]) => ({
              type: 'text',
              parameter_name: name,
              text: String(value),
            }),
          ),
        })
      }
    }

    const rawHeader = templateParams.header
    if (rawHeader) {
      if (Array.isArray(rawHeader)) {
        components.push({
          type: 'header',
          parameters: (rawHeader as string[]).map((p) => ({
            type: 'text',
            text: p,
          })),
        })
      } else if (typeof rawHeader === 'object') {
        components.push({
          type: 'header',
          parameters: Object.entries(rawHeader as Record<string, string>).map(
            ([name, value]) => ({
              type: 'text',
              parameter_name: name,
              text: String(value),
            }),
          ),
        })
      }
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: stripPlus(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length > 0 ? { components } : {}),
      },
    }
    console.log('[sendTemplate] payload:', JSON.stringify(payload))

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      console.error('[sendTemplate] Meta error:', JSON.stringify(data))
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
  mediaType: string,
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
    if (!res.ok)
      return { ok: false, error: data.error?.message || 'Unknown error' }
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
  } catch (_e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const agenteId = params.agente_id as string
  const conversacionId = params.conversacion_id as string
  const to = params.to as string
  const sender = (params.sender as string) || 'bot'
  const isRepesca = (params.is_repesca as boolean) || false

  if (!agenteId || !to || !conversacionId) {
    return jsonResponse(
      { error: 'agente_id, conversacion_id and to are required' },
      400,
    )
  }

  // Load agent
  const { data: agente, error: agenteErr } = await supabase
    .from('ia_agentes')
    .select(
      'id, whatsapp_phone_id, modo_sandbox, sandbox_phones, rate_limit_msg_hora, config, created_at',
    )
    .eq('id', agenteId)
    .single()

  if (agenteErr || !agente) {
    return jsonResponse({ error: 'Agent not found' }, 404)
  }

  const phoneNumberId = agente.whatsapp_phone_id
  if (!phoneNumberId) {
    return jsonResponse({ error: 'Agent has no WhatsApp phone configured' }, 400)
  }

  // Check blacklist
  const { data: blacklisted } = await supabase
    .from('ia_blacklist')
    .select('id')
    .eq('telefono', to)
    .maybeSingle()

  if (blacklisted) {
    return jsonResponse({ error: 'Phone is blacklisted', blocked: true }, 403)
  }

  // Check sandbox
  if (agente.modo_sandbox) {
    const allowed = agente.sandbox_phones || []
    if (!allowed.includes(to)) {
      return jsonResponse(
        { error: 'Phone not in sandbox list', blocked: true },
        403,
      )
    }
  }

  const now = new Date()
  const today = getMadridDate()

  // Check 24h window
  const { data: convo } = await supabase
    .from('ia_conversaciones')
    .select('wa_window_expires_at')
    .eq('id', conversacionId)
    .single()

  let windowOpen = false
  if (convo?.wa_window_expires_at) {
    windowOpen = new Date(convo.wa_window_expires_at) > now
  }

  // Send messages
  const results: Array<{
    ok: boolean
    waMessageId?: string
    error?: string
    type: string
  }> = []

  const messages = (params.messages as Array<Record<string, unknown>>) || []

  // Direct template send
  if (params.template_name && messages.length === 0) {
    const templateName = params.template_name as string
    const templateParams =
      (params.template_params as Record<string, unknown>) || {}

    const result = await sendTemplateMessage(
      phoneNumberId,
      waToken,
      to,
      templateName,
      templateParams,
    )
    results.push({ ...result, type: 'template' })

    if (result.ok) {
      await supabase.from('ia_mensajes').insert({
        conversacion_id: conversacionId,
        direction: 'outbound',
        sender,
        content: resolveTemplateText(templateName, templateParams),
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
      // Simulate typing: ~50ms per character + random 3-6s "reading" pause
      // Typical delay: 5-15 seconds (feels like reading + typing)
      const readingPause = 3000 + Math.random() * 3000
      const typingTime = content.length * 50
      const typingDelay = Math.min(
        15000,
        Math.max(4000, readingPause + typingTime),
      )
      await sleep(typingDelay)
    }

    let result: { ok: boolean; waMessageId?: string; error?: string } = {
      ok: false,
      error: 'unhandled type',
    }

    if (!windowOpen && type !== 'template') {
      results.push({ ok: false, error: '24h window closed', type })
      continue
    }

    if (type === 'text') {
      result = await sendTextMessage(phoneNumberId, waToken, to, content)
    } else if (
      type === 'image' ||
      type === 'video' ||
      type === 'audio' ||
      type === 'document'
    ) {
      if (!mediaUrl) {
        results.push({ ok: false, error: 'media_url required', type })
        continue
      }
      result = await sendMediaMessage(
        phoneNumberId,
        waToken,
        to,
        type,
        mediaUrl,
        content || undefined,
      )
    } else if (type === 'template') {
      if (!msg.template_name) {
        results.push({
          ok: false,
          error: 'template_name required for template type',
          type,
        })
        continue
      }
      result = await sendTemplateMessage(
        phoneNumberId,
        waToken,
        to,
        msg.template_name as string,
        (msg.template_params as Record<string, unknown>) || {},
      )
    } else {
      results.push({ ok: false, error: `Unknown type: ${type}`, type })
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
        template_name:
          type === 'template' ? (msg.template_name as string) : null,
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

  // Update conversation
  if (results.some((r) => r.ok)) {
    await supabase
      .from('ia_conversaciones')
      .update({
        last_bot_message_at: new Date().toISOString(),
        ...(sender === 'bot' ? { estado: 'waiting_reply' } : {}),
      })
      .eq('id', conversacionId)
  }

  // Update costs
  const sentCount = results.filter((r) => r.ok).length
  if (sentCount > 0) {
    const agentConfig = (agente.config as Record<string, unknown>) || {}
    const costPerMsg =
      (agentConfig.wa_cost_per_msg as number) || 0.005
    try {
      await supabase.rpc('ia_increment_costes', {
        p_agente_id: agenteId,
        p_fecha: today,
        p_whatsapp_mensajes: sentCount,
        p_whatsapp_coste: sentCount * costPerMsg,
      })
    } catch (err) {
      console.error('Error incrementing costs:', err)
    }
  }

  return jsonResponse({
    status: 'ok',
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
})
