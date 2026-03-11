import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

/**
 * ia-whatsapp-webhook
 *
 * Recibe webhooks de Meta WhatsApp Business API:
 * - GET: Verificación del webhook (challenge)
 * - POST: Mensajes entrantes + status updates (sent/delivered/read)
 *
 * Verifica firma HMAC de Meta para seguridad.
 * Procesa texto, audio, imagen, video, sticker, document.
 * Guarda en ia_mensajes y actualiza ia_conversaciones.
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

// Verify Meta webhook signature (HMAC SHA-256)
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
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return computed === expected
  } catch {
    return false
  }
}

// Normalize phone to E.164 format
function normalizePhone(phone: string): string {
  let p = phone.replace(/[^0-9+]/g, '')
  if (!p.startsWith('+')) p = '+' + p
  return p
}

// Download media from WhatsApp (returns base64 or URL)
async function downloadMedia(
  mediaId: string,
  token: string,
): Promise<{ url: string; mimeType: string } | null> {
  try {
    // Step 1: Get media URL
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!metaRes.ok) return null
    const metaData = await metaRes.json()
    const mediaUrl = metaData.url
    const mimeType = metaData.mime_type || 'application/octet-stream'

    // Step 2: Download media
    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!mediaRes.ok) return null
    const blob = await mediaRes.blob()

    // Convert to base64 data URL for storage
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const dataUrl = `data:${mimeType};base64,${base64}`

    return { url: dataUrl, mimeType }
  } catch (err) {
    console.error('Error downloading media:', err)
    return null
  }
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(
  audioUrl: string,
  mimeType: string,
  openaiKey: string,
): Promise<string | null> {
  try {
    // Decode base64 back to blob
    const base64Data = audioUrl.split(',')[1]
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })

    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'ogg'
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
    console.error('Error transcribing audio:', err)
    return null
  }
}

// Analyze image/video/sticker with GPT-4o Vision
async function analyzeImage(
  imageUrl: string,
  mimeType: string,
  openaiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe brevemente qué contiene esta imagen/sticker en español. Si parece un meme o sticker, describe la emoción o intención. Responde en 1-2 frases cortas.',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 150,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.error('Error analyzing image:', err)
    return null
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // === GET: Webhook verification (Meta challenge) ===
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

  // === POST: Incoming messages & status updates ===
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const appSecret = Deno.env.get('WA_APP_SECRET') ?? ''
  const waToken = Deno.env.get('WA_ACCESS_TOKEN') ?? ''
  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

  // Read body for signature verification
  const rawBody = await req.text()

  // Verify HMAC signature from Meta
  if (appSecret) {
    const signature = req.headers.get('x-hub-signature-256')
    const valid = await verifySignature(rawBody, signature, appSecret)
    if (!valid) {
      console.error('Invalid webhook signature')
      return jsonResponse({ error: 'Invalid signature' }, 401)
    }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Meta sends an array of entries
  const entries = (body.entry as Array<Record<string, unknown>>) || []

  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) || []

    for (const change of changes) {
      const value = change.value as Record<string, unknown>
      if (!value) continue

      const metadata = value.metadata as Record<string, string>
      const phoneNumberId = metadata?.phone_number_id

      // Find the agent that owns this phone number
      const { data: agente } = await supabase
        .from('ia_agentes')
        .select('id, activo, modo_sandbox, sandbox_phones, rate_limit_msg_hora, rate_limit_nuevos_dia')
        .eq('whatsapp_phone_id', phoneNumberId)
        .single()

      if (!agente) {
        console.log(`No agent found for phone_number_id: ${phoneNumberId}`)
        continue
      }

      // === STATUS UPDATES (sent, delivered, read) ===
      const statuses = (value.statuses as Array<Record<string, unknown>>) || []
      for (const status of statuses) {
        const waMessageId = status.id as string
        const waStatus = status.status as string // sent, delivered, read, failed

        if (['sent', 'delivered', 'read'].includes(waStatus)) {
          await supabase
            .from('ia_mensajes')
            .update({ wa_status: waStatus })
            .eq('wa_message_id', waMessageId)
        }

        // If read → update wa_window for the conversation (24h from read)
        if (waStatus === 'read') {
          const { data: msg } = await supabase
            .from('ia_mensajes')
            .select('conversacion_id')
            .eq('wa_message_id', waMessageId)
            .single()

          if (msg) {
            const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            await supabase
              .from('ia_conversaciones')
              .update({ wa_window_expires_at: windowExpires })
              .eq('id', msg.conversacion_id)
          }
        }
      }

      // === INCOMING MESSAGES ===
      const messages = (value.messages as Array<Record<string, unknown>>) || []
      const contacts = (value.contacts as Array<Record<string, unknown>>) || []

      for (const message of messages) {
        const from = normalizePhone(message.from as string)
        const waMessageId = message.id as string
        const timestamp = message.timestamp as string
        const msgType = message.type as string // text, audio, image, video, sticker, document, reaction, etc.

        // Get contact name from Meta
        const contactInfo = contacts.find(
          (c: Record<string, unknown>) =>
            (c.wa_id as string) === (message.from as string),
        )
        const profileName =
          (contactInfo?.profile as Record<string, string>)?.name || ''

        // === CHECK BLACKLIST ===
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

        // === CHECK SANDBOX MODE ===
        if (agente.modo_sandbox) {
          const allowedPhones = agente.sandbox_phones || []
          if (!allowedPhones.includes(from)) {
            await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              tipo: 'info',
              mensaje: `Mensaje ignorado en modo sandbox (número no autorizado): ${from}`,
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
          const { data: newLead } = await supabase
            .from('ia_leads')
            .insert({
              telefono: from,
              nombre: profileName || null,
              origen: 'whatsapp_inbound',
              consentimiento: true,
              consentimiento_at: new Date().toISOString(),
            })
            .select()
            .single()
          lead = newLead
        } else if (!lead.nombre && profileName) {
          // Update name if we didn't have it
          await supabase
            .from('ia_leads')
            .update({ nombre: profileName })
            .eq('id', lead.id)
        }

        if (!lead) {
          console.error('Failed to resolve lead for:', from)
          continue
        }

        // Check opted_out
        if (lead.opted_out) {
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'info',
            mensaje: `Mensaje ignorado de lead opted_out: ${from}`,
          })
          continue
        }

        // === RESOLVE CONVERSATION ===
        let { data: convo } = await supabase
          .from('ia_conversaciones')
          .select('*')
          .eq('agente_id', agente.id)
          .eq('lead_id', lead.id)
          .neq('estado', 'descartado')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!convo) {
          const { data: newConvo } = await supabase
            .from('ia_conversaciones')
            .insert({
              agente_id: agente.id,
              lead_id: lead.id,
              estado: 'needs_reply',
              step: 'qualify',
              chatbot_activo: agente.activo,
              leida: false,
            })
            .select()
            .single()
          convo = newConvo
        }

        if (!convo) {
          console.error('Failed to resolve conversation for lead:', lead.id)
          continue
        }

        // Update conversation: new message arrived
        const convoUpdates: Record<string, unknown> = {
          last_lead_message_at: new Date().toISOString(),
          leida: false,
        }

        // Update 24h window (starts when lead sends a message)
        convoUpdates.wa_window_expires_at = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString()

        // If was waiting_reply or scheduled_followup, switch to needs_reply
        if (['waiting_reply', 'scheduled_followup', 'no_response'].includes(convo.estado)) {
          convoUpdates.estado = 'needs_reply'
          convoUpdates.followup_count = 0
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
              const media = await downloadMedia(audioInfo.id, waToken)
              if (media) {
                mediaUrl = media.url
                // Transcribe with Whisper
                if (openaiKey) {
                  transcription = await transcribeAudio(media.url, media.mimeType, openaiKey)
                  content = transcription || '[Audio no transcrito]'

                  // Log Whisper cost
                  await supabase.from('ia_costes').upsert(
                    {
                      agente_id: agente.id,
                      fecha: new Date().toISOString().split('T')[0],
                      whisper_calls: 1,
                      whisper_coste: 0.006, // ~$0.006/min estimate
                    },
                    { onConflict: 'agente_id,fecha', ignoreDuplicates: false },
                  )
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
              const media = await downloadMedia(imgInfo.id, waToken)
              if (media) {
                mediaUrl = media.url
                // Analyze with GPT-4o
                if (openaiKey) {
                  transcription = await analyzeImage(media.url, media.mimeType, openaiKey)
                  content = transcription || `[${msgType === 'sticker' ? 'Sticker' : 'Imagen'} recibida]`

                  await supabase.from('ia_costes').upsert(
                    {
                      agente_id: agente.id,
                      fecha: new Date().toISOString().split('T')[0],
                      gpt4o_calls: 1,
                      gpt4o_coste: 0.005, // ~$0.005 per image
                    },
                    { onConflict: 'agente_id,fecha', ignoreDuplicates: false },
                  )
                } else {
                  content = `[${msgType === 'sticker' ? 'Sticker' : 'Imagen'} recibida]`
                }
              }
            }
            if (imgInfo?.caption) {
              content = (imgInfo.caption as string) + (content ? ` (${content})` : '')
            }
            break
          }

          case 'video': {
            messageType = 'video'
            const videoInfo = message.video as Record<string, string>
            if (videoInfo?.id) {
              const media = await downloadMedia(videoInfo.id, waToken)
              if (media) {
                mediaUrl = media.url
                content = '[Video recibido]'
              }
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
              const media = await downloadMedia(docInfo.id, waToken)
              if (media) mediaUrl = media.url
            }
            break
          }

          case 'reaction': {
            // Reactions don't need full processing, just log
            const reaction = message.reaction as Record<string, string>
            content = reaction?.emoji || '👍'
            messageType = 'text'
            break
          }

          default: {
            content = `[Tipo de mensaje no soportado: ${msgType}]`
            messageType = 'text'
          }
        }

        // === CHECK RGPD / STOP ===
        const stopPhrases = [
          'no me escribas más',
          'no me escribas mas',
          'no me contactes',
          'borra mis datos',
          'stop',
          'no quiero recibir',
          'deja de escribirme',
          'elimina mis datos',
          'para de escribirme',
        ]
        const contentLower = content.toLowerCase().trim()
        const isStop = stopPhrases.some(phrase => contentLower.includes(phrase))

        if (isStop) {
          // Opt-out immediately
          await supabase
            .from('ia_leads')
            .update({
              opted_out: true,
              opted_out_at: new Date().toISOString(),
            })
            .eq('id', lead.id)

          await supabase
            .from('ia_conversaciones')
            .update({
              estado: 'descartado',
              chatbot_activo: false,
            })
            .eq('id', convo.id)

          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            conversacion_id: convo.id,
            tipo: 'info',
            mensaje: `Lead opted-out automático (RGPD): "${content}"`,
          })

          // Still save the message
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

        // === TRIGGER AI PROCESSING ===
        // If chatbot is active, invoke ia-process-message to generate a response
        if (convo.chatbot_activo && agente.activo) {
          // Fire-and-forget call to process the message
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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
          })
        }

        // Log
        await supabase.from('ia_logs').insert({
          agente_id: agente.id,
          conversacion_id: convo.id,
          tipo: 'whatsapp',
          mensaje: `Mensaje ${msgType} recibido de ${from}`,
          detalles: {
            wa_message_id: waMessageId,
            message_type: msgType,
            content_preview: content.substring(0, 100),
          },
        })
      }
    }
  }

  // Always return 200 to Meta (they retry on non-200)
  return jsonResponse({ status: 'ok' })
})
