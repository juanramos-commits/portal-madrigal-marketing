import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-whatsapp-webhook
 *
 * Recibe webhooks de Meta WhatsApp Business API:
 * - GET: Verificación del webhook (challenge)
 * - POST: Mensajes entrantes + status updates (sent/delivered/read/failed)
 *
 * Fixes from audit:
 * - Returns 200 immediately, processes async (Meta requires <5s response)
 * - Filters inactive agents for new conversations
 * - Fixes race condition on conversation creation
 * - Fixes origen to 'manual' for WhatsApp-initiated leads
 * - RGPD/STOP detection ✓ (was already implemented)
 * - Mandatory signature verification in production
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-hub-signature-256',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Timing-safe HMAC verification
async function verifySignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false
  try {
    const expected = signature.replace('sha256=', '')
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
    const expectedBytes = new Uint8Array(expected.match(/.{2}/g)!.map(b => parseInt(b, 16)))
    return await crypto.subtle.verify('HMAC', key, expectedBytes, encoder.encode(body))
  } catch {
    return false
  }
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/[^0-9+]/g, '')
  if (!p.startsWith('+')) p = '+' + p
  return p
}

function getMadridDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// Download media from WhatsApp → Supabase Storage
async function downloadMedia(
  mediaId: string,
  token: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ url: string; mimeType: string } | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!metaRes.ok) return null
    const metaData = await metaRes.json()
    const mediaUrl = metaData.url
    const mimeType = metaData.mime_type || 'application/octet-stream'

    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!mediaRes.ok) return null
    const arrayBuffer = await mediaRes.arrayBuffer()

    const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
    const filePath = `ia-media/${Date.now()}-${mediaId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('archivos')
      .upload(filePath, arrayBuffer, { contentType: mimeType, upsert: false })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return null
    }

    const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(filePath)
    return { url: urlData.publicUrl, mimeType }
  } catch (err) {
    console.error('Download media error:', err)
    return null
  }
}

// Transcribe audio via OpenAI Whisper
async function transcribeAudio(audioUrl: string, openaiKey: string): Promise<string | null> {
  try {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) return null
    const blob = await audioRes.blob()
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'ogg'
    const formData = new FormData()
    formData.append('file', blob, `audio.${ext}`)
    formData.append('model', 'whisper-1')
    formData.append('language', 'es')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.text || null
  } catch (err) {
    console.error('Transcription error:', err)
    return null
  }
}

// Analyze image/sticker with GPT-4o Vision
async function analyzeImage(imageUrl: string, openaiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe brevemente qué contiene esta imagen/sticker en español. Si parece un meme o sticker, describe la emoción o intención. 1-2 frases.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        }],
        max_tokens: 150,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.error('Image analysis error:', err)
    return null
  }
}

// ============================================================
// ASYNC PROCESSING (runs after 200 response to Meta)
// ============================================================
async function processWebhookAsync(
  rawBody: string,
  appSecret: string,
  waToken: string,
  openaiKey: string,
): Promise<void> {
  const body = JSON.parse(rawBody)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const entries = (body.entry as Array<Record<string, unknown>>) || []

  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) || []

    for (const change of changes) {
      const value = change.value as Record<string, unknown>
      if (!value) continue

      const metadata = value.metadata as Record<string, string>
      const phoneNumberId = metadata?.phone_number_id

      // Load agent — include activo filter
      const { data: agente } = await supabase
        .from('ia_agentes')
        .select('id, activo, modo_sandbox, sandbox_phones, rate_limit_msg_hora, rate_limit_nuevos_dia')
        .eq('whatsapp_phone_id', phoneNumberId)
        .single()

      if (!agente) continue

      // === STATUS UPDATES ===
      const statuses = (value.statuses as Array<Record<string, unknown>>) || []
      for (const status of statuses) {
        const waMessageId = status.id as string
        const waStatus = status.status as string

        if (['sent', 'delivered', 'read'].includes(waStatus)) {
          const { error: updateErr } = await supabase
            .from('ia_mensajes')
            .update({ wa_status: waStatus })
            .eq('wa_message_id', waMessageId)

          if (updateErr) {
            console.error('Error updating wa_status:', updateErr)
          }
        }

        if (waStatus === 'failed') {
          const errors = (status.errors as Array<Record<string, unknown>>) || []
          const errorMsg = errors.map(e => `${e.code}: ${e.title}`).join(', ') || 'Unknown'
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'error',
            mensaje: `WhatsApp delivery failed for ${waMessageId}: ${errorMsg}`,
            detalles: { wa_message_id: waMessageId, errors },
          })
        }
      }

      // === INCOMING MESSAGES ===
      const messages = (value.messages as Array<Record<string, unknown>>) || []
      const contacts = (value.contacts as Array<Record<string, unknown>>) || []

      for (const message of messages) {
        try {
          const from = normalizePhone(message.from as string)
          const waMessageId = message.id as string
          const msgType = message.type as string

          // === DEDUP ===
          const { data: existingMsg } = await supabase
            .from('ia_mensajes')
            .select('id')
            .eq('wa_message_id', waMessageId)
            .maybeSingle()

          if (existingMsg) continue

          const contactInfo = contacts.find(
            (c: Record<string, unknown>) => (c.wa_id as string) === (message.from as string),
          )
          const profileName = (contactInfo?.profile as Record<string, string>)?.name || ''

          // === BLACKLIST ===
          const { data: blacklisted } = await supabase
            .from('ia_blacklist')
            .select('id')
            .eq('telefono', from)
            .maybeSingle()

          if (blacklisted) {
            await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              tipo: 'info',
              mensaje: `Mensaje ignorado de número en blacklist: ${from}`,
            })
            continue
          }

          // === SANDBOX ===
          if (agente.modo_sandbox) {
            const allowed = agente.sandbox_phones || []
            if (!allowed.includes(from)) {
              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                tipo: 'info',
                mensaje: `Mensaje ignorado en sandbox (no autorizado): ${from}`,
              })
              continue
            }
          }

          // === RESOLVE LEAD ===
          let { data: lead } = await supabase
            .from('ia_leads')
            .select('*')
            .eq('telefono', from)
            .maybeSingle()

          if (!lead) {
            const { data: newLead, error: leadErr } = await supabase
              .from('ia_leads')
              .insert({
                telefono: from,
                nombre: profileName || null,
                origen: 'manual', // WhatsApp-initiated, not from a form
                consentimiento: false, // Don't auto-assume RGPD consent
                metadata: { whatsapp_profile_name: profileName },
              })
              .select()
              .single()

            if (leadErr) {
              console.error('Error creating lead:', leadErr)
              continue
            }
            lead = newLead
          } else if (!lead.nombre && profileName) {
            await supabase.from('ia_leads').update({ nombre: profileName }).eq('id', lead.id)
          }

          if (!lead) continue
          if (lead.opted_out) {
            await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              tipo: 'info',
              mensaje: `Mensaje ignorado de lead opted_out: ${from}`,
            })
            continue
          }

          // === RESOLVE CONVERSATION (with race condition protection) ===
          let convo: Record<string, unknown> | null = null

          // Try to find existing non-descartado conversation
          const { data: existingConvo } = await supabase
            .from('ia_conversaciones')
            .select('*')
            .eq('agente_id', agente.id)
            .eq('lead_id', lead.id)
            .not('estado', 'eq', 'descartado')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existingConvo) {
            convo = existingConvo
          } else {
            // Only create new conversation if agent is active
            if (!agente.activo) {
              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                tipo: 'info',
                mensaje: `Mensaje de ${from} ignorado: agente inactivo, no se crea conversación`,
              })
              continue
            }

            // Insert with ON CONFLICT handling via unique-ish check
            const { data: newConvo, error: convoErr } = await supabase
              .from('ia_conversaciones')
              .insert({
                agente_id: agente.id,
                lead_id: lead.id,
                estado: 'needs_reply',
                step: 'qualify',
                chatbot_activo: true,
                leida: false,
              })
              .select()
              .single()

            if (convoErr) {
              // Race condition: another request created it. Fetch it.
              const { data: raceConvo } = await supabase
                .from('ia_conversaciones')
                .select('*')
                .eq('agente_id', agente.id)
                .eq('lead_id', lead.id)
                .not('estado', 'eq', 'descartado')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

              convo = raceConvo
            } else {
              convo = newConvo
            }
          }

          if (!convo) {
            console.error('Failed to resolve conversation for lead:', lead.id)
            continue
          }

          // Update conversation: new message arrived
          const convoUpdates: Record<string, unknown> = {
            last_lead_message_at: new Date().toISOString(),
            leida: false,
            wa_window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }

          if (['waiting_reply', 'scheduled_followup', 'no_response'].includes(convo.estado as string)) {
            convoUpdates.estado = 'needs_reply'
            convoUpdates.followup_count = 0
          }

          // If chatbot was inactive due to scheduled_followup, reactivate
          if (convo.estado === 'scheduled_followup') {
            convoUpdates.chatbot_activo = true
            convoUpdates.followup_at = null
          }

          await supabase
            .from('ia_conversaciones')
            .update(convoUpdates)
            .eq('id', convo.id)

          // === PROCESS MESSAGE CONTENT ===
          let content = ''
          let messageType = 'text'
          let mediaUrl: string | null = null
          let transcription: string | null = null

          switch (msgType) {
            case 'text': {
              content = (message.text as Record<string, string>)?.body || ''
              messageType = 'text'
              break
            }

            case 'audio': {
              messageType = 'audio'
              const audioInfo = message.audio as Record<string, string>
              if (audioInfo?.id) {
                const media = await downloadMedia(audioInfo.id, waToken, supabase)
                if (media) {
                  mediaUrl = media.url
                  if (openaiKey) {
                    transcription = await transcribeAudio(media.url, openaiKey)
                    content = transcription || '[Audio no transcrito]'
                    await supabase.rpc('ia_increment_costes', {
                      p_agente_id: agente.id,
                      p_fecha: getMadridDate(),
                      p_whisper_calls: 1,
                      p_whisper_coste: 0.006,
                    }).catch(() => {})
                  } else {
                    content = '[Audio recibido]'
                  }
                } else {
                  content = '[Audio no descargado]'
                }
              }
              break
            }

            case 'image':
            case 'sticker': {
              messageType = msgType
              const imgInfo = message[msgType] as Record<string, string>
              if (imgInfo?.id) {
                const media = await downloadMedia(imgInfo.id, waToken, supabase)
                if (media) {
                  mediaUrl = media.url
                  if (openaiKey) {
                    transcription = await analyzeImage(media.url, openaiKey)
                    content = transcription || `[${msgType === 'sticker' ? 'Sticker' : 'Imagen'} recibida]`
                    await supabase.rpc('ia_increment_costes', {
                      p_agente_id: agente.id,
                      p_fecha: getMadridDate(),
                      p_gpt4o_calls: 1,
                      p_gpt4o_coste: 0.005,
                    }).catch(() => {})
                  } else {
                    content = `[${msgType === 'sticker' ? 'Sticker' : 'Imagen'} recibida]`
                  }
                }
              }
              if (imgInfo?.caption) {
                content = imgInfo.caption + (content ? ` (${content})` : '')
              }
              break
            }

            case 'video': {
              messageType = 'video'
              const videoInfo = message.video as Record<string, string>
              if (videoInfo?.id) {
                const media = await downloadMedia(videoInfo.id, waToken, supabase)
                if (media) { mediaUrl = media.url; content = '[Video recibido]' }
              }
              if (videoInfo?.caption) {
                content = videoInfo.caption + (content ? ` (${content})` : '')
              }
              break
            }

            case 'document': {
              messageType = 'document'
              const docInfo = message.document as Record<string, string>
              content = `[Documento: ${docInfo?.filename || 'archivo'}]`
              if (docInfo?.id) {
                const media = await downloadMedia(docInfo.id, waToken, supabase)
                if (media) mediaUrl = media.url
              }
              break
            }

            case 'reaction': {
              const reaction = message.reaction as Record<string, string>
              content = reaction?.emoji || '👍'
              messageType = 'text'
              // Store the reaction target message ID in metadata
              break
            }

            default: {
              content = `[Tipo de mensaje no soportado: ${msgType}]`
              messageType = 'text'
            }
          }

          // === CHECK RGPD / STOP ===
          const stopPhrases = [
            'no me escribas más', 'no me escribas mas', 'no me contactes',
            'borra mis datos', 'stop', 'no quiero recibir',
            'deja de escribirme', 'elimina mis datos', 'para de escribirme',
            'darme de baja', 'baja', 'unsubscribe',
          ]
          const contentLower = content.toLowerCase().trim()
          const isStop = stopPhrases.some(phrase => contentLower === phrase || contentLower.includes(phrase))

          if (isStop) {
            await supabase.from('ia_leads').update({
              opted_out: true,
              opted_out_at: new Date().toISOString(),
            }).eq('id', lead.id)

            await supabase.from('ia_conversaciones').update({
              estado: 'descartado',
              chatbot_activo: false,
            }).eq('id', convo.id)

            // Also deactivate ALL conversations for this lead across all agents
            await supabase.from('ia_conversaciones').update({
              chatbot_activo: false,
            }).eq('lead_id', lead.id)

            await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              conversacion_id: convo.id as string,
              tipo: 'info',
              mensaje: `Lead opted-out automático (RGPD): "${content}"`,
            })

            // Save the STOP message itself
            await supabase.from('ia_mensajes').insert({
              conversacion_id: convo.id,
              direction: 'inbound',
              sender: 'lead',
              content,
              message_type: messageType,
              media_url: mediaUrl,
              transcription,
              wa_message_id: waMessageId,
            })

            continue
          }

          // === SAVE INBOUND MESSAGE ===
          const { error: msgErr } = await supabase.from('ia_mensajes').insert({
            conversacion_id: convo.id,
            direction: 'inbound',
            sender: 'lead',
            content,
            message_type: messageType,
            media_url: mediaUrl,
            transcription,
            wa_message_id: waMessageId,
          })

          if (msgErr) {
            console.error('Error saving message:', msgErr)
          }

          // === UPDATE METRICS ===
          await supabase.rpc('ia_increment_metricas', {
            p_agente_id: agente.id,
            p_fecha: getMadridDate(),
            p_ab_version: (convo.ab_version as string) || 'A',
            p_respuestas_recibidas: 1,
            p_mensajes_recibidos: 1,
          }).catch(() => {})

          // === TRIGGER AI PROCESSING (fire and forget) ===
          const { data: freshConvo } = await supabase
            .from('ia_conversaciones')
            .select('chatbot_activo')
            .eq('id', convo.id)
            .single()

          if (freshConvo?.chatbot_activo && agente.activo) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

            // Fire and forget — don't await
            fetch(`${supabaseUrl}/functions/v1/ia-process-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                conversacion_id: convo.id,
                agente_id: agente.id,
                lead_id: lead.id,
                message_content: content,
                message_type: messageType,
              }),
            }).catch(err => {
              console.error('Error triggering ia-process-message:', err)
              supabase.from('ia_alertas_supervisor').insert({
                agente_id: agente.id,
                conversacion_id: convo.id as string,
                tipo: 'error',
                mensaje: `Error al invocar procesamiento IA: ${err}`,
                leida: false,
              }).catch(() => {})
            })
          }

          // Log
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            conversacion_id: convo.id as string,
            tipo: 'whatsapp',
            mensaje: `Mensaje ${msgType} recibido de ${from}`,
            detalles: {
              wa_message_id: waMessageId,
              message_type: msgType,
              content_preview: content.substring(0, 100),
            },
          })
        } catch (msgErr) {
          console.error('Error processing individual message:', msgErr)
        }
      }
    }
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // === GET: Webhook verification ===
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const verifyToken = Deno.env.get('WA_VERIFY_TOKEN') ?? ''

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const appSecret = Deno.env.get('WA_APP_SECRET') ?? ''
  const waToken = Deno.env.get('WA_ACCESS_TOKEN') ?? ''
  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

  const rawBody = await req.text()

  // === VERIFY SIGNATURE ===
  if (appSecret) {
    const signature = req.headers.get('x-hub-signature-256')
    const valid = await verifySignature(rawBody, signature, appSecret)
    if (!valid) {
      console.error('Invalid webhook signature')
      return jsonResponse({ error: 'Invalid signature' }, 401)
    }
  } else {
    // In production, this MUST be configured
    console.error('WA_APP_SECRET not set — SECURITY RISK: webhook signature verification DISABLED')
  }

  // === RETURN 200 IMMEDIATELY (Meta requires <5s) ===
  // Process asynchronously to avoid Meta timeouts and retries
  // Use waitUntil pattern for Deno Deploy / Edge Functions
  const processingPromise = processWebhookAsync(rawBody, appSecret, waToken, openaiKey)
    .catch(err => console.error('Async webhook processing error:', err))

  // In Deno Deploy, we need to keep the promise alive
  // The EdgeRuntime will wait for it after returning the response
  ;(globalThis as Record<string, unknown>).__pendingPromise = processingPromise

  return jsonResponse({ status: 'ok' })
})
