/**
 * ce-inbound-reply — Processes inbound email replies from Resend.
 *
 * When a cold email recipient replies, Resend forwards the email here.
 * This function:
 *   1. Matches the reply to the original ce_envios record
 *   2. Creates a ce_respuestas record
 *   3. Inserts a ce_eventos 'replied' event (triggers DB propagation)
 *   4. Calls ce-clasificar-respuesta for AI classification + CRM lead creation
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Webhook signature verification (Svix format used by Resend) ─────────────

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function verifyResendSignature(
  body: string,
  req: Request,
  secret: string,
): Promise<boolean> {
  if (!secret) return true // Skip if not configured

  try {
    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('ce-inbound-reply: missing svix headers, skipping verification')
      return true
    }

    const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
    const secretBytes = base64ToUint8Array(rawSecret)

    const toSign = `${svixId}.${svixTimestamp}.${body}`
    const encoder = new TextEncoder()

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign))
    const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

    const signatures = svixSignature.split(' ')
    for (const sig of signatures) {
      const parts = sig.split(',')
      if (parts.length === 2 && parts[1] === computed) return true
    }

    console.warn('ce-inbound-reply: signature mismatch')
    return false
  } catch (err) {
    console.warn('Signature verification failed:', err)
    return false
  }
}

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

/** Extract the plain text body from Resend inbound payload. */
function extractBody(payload: any): string {
  // Resend inbound sends text in different fields depending on format
  if (payload.text) return payload.text
  if (payload.body) return payload.body
  if (payload.html) {
    // Strip HTML tags as fallback
    return payload.html.replace(/<[^>]*>/g, '').trim()
  }
  return ''
}

/** Extract email address from a "Name <email>" string. */
function extractEmail(str: string): string {
  const match = str.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : str.toLowerCase().trim()
}

/** Try to find the original envio by In-Reply-To header or recipient email. */
async function findOriginalEnvio(
  supabase: ReturnType<typeof createClient>,
  inReplyTo: string | null,
  references: string | null,
  fromEmail: string,
  toEmail: string,
) {
  // Strategy 1: Match by In-Reply-To → ce_envios.message_id
  if (inReplyTo) {
    const cleanId = inReplyTo.replace(/[<>]/g, '').trim()
    const { data } = await supabase
      .from('ce_envios')
      .select('id, enrollment_id, contacto_id, cuenta_id, thread_key')
      .eq('message_id', cleanId)
      .maybeSingle()
    if (data) return data
  }

  // Strategy 2: Match by References header (may contain multiple message IDs)
  if (references) {
    const refIds = references.split(/\s+/).map((r: string) => r.replace(/[<>]/g, '').trim()).filter(Boolean)
    for (const refId of refIds) {
      const { data } = await supabase
        .from('ce_envios')
        .select('id, enrollment_id, contacto_id, cuenta_id, thread_key')
        .eq('message_id', refId)
        .maybeSingle()
      if (data) return data
    }
  }

  // Strategy 3: Match by from email (recipient) → contacto, and to email → cuenta
  const { data: contacto } = await supabase
    .from('ce_contactos')
    .select('id')
    .eq('email', fromEmail)
    .maybeSingle()

  if (contacto) {
    // Find the most recent envio to this contact
    const { data: envio } = await supabase
      .from('ce_envios')
      .select('id, enrollment_id, contacto_id, cuenta_id, thread_key')
      .eq('contacto_id', contacto.id)
      .order('enviado_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (envio) return envio
  }

  return null
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

  try {
    const bodyText = await req.text()

    // ── Webhook signature verification (Svix format) ──────────────
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''

    if (webhookSecret) {
      const valid = await verifyResendSignature(bodyText, req, webhookSecret)
      if (!valid) {
        console.warn('ce-inbound-reply: invalid signature')
        return jsonResponse({ ok: true, skipped: true, reason: 'invalid signature' })
      }
    }

    const rawPayload = JSON.parse(bodyText)

    console.log('ce-inbound-reply: received payload type:', rawPayload.type, 'keys:', Object.keys(rawPayload))

    // Resend wraps webhook data inside a "data" field
    const payload = rawPayload.data || rawPayload

    // ── 1. Extract reply data ──────────────────────────────────────────
    const fromRaw: string = payload.from || payload.sender || ''
    const toRaw: string = Array.isArray(payload.to) ? payload.to[0] : (payload.to || '')
    const subject: string = payload.subject || ''
    const inReplyTo: string | null = payload.in_reply_to || payload.inReplyTo || payload.headers?.['in-reply-to'] || null
    const references: string | null = payload.references || payload.headers?.references || null

    const fromEmail = extractEmail(fromRaw)
    const toEmail = extractEmail(toRaw)

    // Resend email.received webhook doesn't include the body directly.
    // Fetch the full email content via Resend API using the email_id.
    let body = extractBody(payload)
    const emailId = payload.email_id || payload.id

    if (!body && emailId) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (resendApiKey) {
        try {
          const emailResp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
            headers: { 'Authorization': `Bearer ${resendApiKey}` },
          })
          if (emailResp.ok) {
            const emailData = await emailResp.json()
            body = emailData.text || emailData.html?.replace(/<[^>]*>/g, '').trim() || ''
            console.log('ce-inbound-reply: fetched email body from Resend API, length:', body.length)
          } else {
            console.warn('ce-inbound-reply: Resend API error:', emailResp.status)
          }
        } catch (fetchErr: any) {
          console.warn('ce-inbound-reply: failed to fetch email from Resend:', fetchErr.message)
        }
      }
    }

    // If still no body, use the subject as fallback so we don't skip the reply
    if (!body) {
      body = subject || '(sin contenido)'
      console.log('ce-inbound-reply: using subject/fallback as body')
    }

    if (!fromEmail) {
      console.warn('ce-inbound-reply: missing from')
      return jsonResponse({ ok: true, skipped: true, reason: 'missing from or body' })
    }

    // ── 2. Find original envio ─────────────────────────────────────────
    const envio = await findOriginalEnvio(supabase, inReplyTo, references, fromEmail, toEmail)

    if (!envio) {
      console.warn(`ce-inbound-reply: no matching envio for from=${fromEmail} to=${toEmail}`)
      return jsonResponse({ ok: true, skipped: true, reason: 'no matching envio found' })
    }

    // ── 3. Create ce_respuestas record ─────────────────────────────────
    const { data: respuesta, error: respErr } = await supabase
      .from('ce_respuestas')
      .insert({
        envio_id: envio.id,
        contacto_id: envio.contacto_id,
        enrollment_id: envio.enrollment_id,
        thread_key: envio.thread_key,
        de: fromEmail,
        para: toEmail,
        asunto: subject,
        cuerpo: body,
        clasificacion: 'pendiente',
      })
      .select('id')
      .single()

    if (respErr) {
      console.error('ce-inbound-reply: error creating ce_respuestas:', respErr.message)
      return jsonResponse({ ok: true, error: respErr.message })
    }

    // ── 4. Insert ce_eventos 'replied' event ───────────────────────────
    //    The DB trigger ce_procesar_evento will update ce_envios.estado
    //    and ce_enrollments.estado automatically.
    const { error: eventoErr } = await supabase.from('ce_eventos').insert({
      tipo: 'replied',
      envio_id: envio.id,
      cuenta_id: envio.cuenta_id,
      contacto_id: envio.contacto_id,
      payload: {
        respuesta_id: respuesta.id,
        from: fromEmail,
        subject,
      },
    })

    if (eventoErr) {
      console.error('ce-inbound-reply: error creating ce_eventos:', eventoErr.message)
    }

    // ── 5. Call ce-clasificar-respuesta for AI classification ──────────
    //    This will classify the reply and create a CRM lead if interested.
    const { error: clasifErr } = await supabase.functions.invoke('ce-clasificar-respuesta', {
      body: { respuesta_id: respuesta.id },
    })

    if (clasifErr) {
      console.error('ce-inbound-reply: error calling ce-clasificar-respuesta:', clasifErr.message)
      // Non-fatal: the respuesta is saved, classification can be retried
    }

    console.log(
      `ce-inbound-reply: processed reply from=${fromEmail} envio=${envio.id} respuesta=${respuesta.id}`,
    )

    return jsonResponse({
      ok: true,
      respuesta_id: respuesta.id,
      envio_id: envio.id,
    })
  } catch (err: any) {
    console.error('ce-inbound-reply fatal error:', err)
    return jsonResponse({ ok: true, error: err.message })
  }
})
