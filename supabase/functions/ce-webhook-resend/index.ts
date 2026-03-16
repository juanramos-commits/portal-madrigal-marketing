import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// ── Event type mapping ─────────────────────────────────────────────────────

const EVENT_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

// ── Webhook signature verification (optional) ──────────────────────────────

async function verifyResendSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret || !signatureHeader) return true // Skip if not configured

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const expected = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return signatureHeader === expected
  } catch (err) {
    console.warn('Signature verification failed:', err)
    return false
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

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

  // Always return 200 to Resend to prevent retries for non-retriable issues
  try {
    // ── 1. Parse webhook body ────────────────────────────────────────────
    const rawBody = await req.text()
    let payload: any

    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.error('ce-webhook-resend: invalid JSON body')
      return jsonResponse({ ok: true, skipped: true, reason: 'invalid JSON' })
    }

    // ── 2. Verify webhook signature (optional) ───────────────────────────
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''
    const signatureHeader = req.headers.get('resend-signature') ?? req.headers.get('svix-signature')

    if (webhookSecret) {
      const valid = await verifyResendSignature(rawBody, signatureHeader, webhookSecret)
      if (!valid) {
        console.warn('ce-webhook-resend: invalid signature')
        return jsonResponse({ ok: true, skipped: true, reason: 'invalid signature' })
      }
    }

    // ── 3. Map event type ────────────────────────────────────────────────
    const eventType: string = payload.type
    const tipo = EVENT_MAP[eventType]

    if (!tipo) {
      console.log(`ce-webhook-resend: unknown event type "${eventType}", ignoring`)
      return jsonResponse({ ok: true, skipped: true, reason: `unknown event type: ${eventType}` })
    }

    const data = payload.data
    if (!data?.email_id) {
      console.warn('ce-webhook-resend: missing data.email_id')
      return jsonResponse({ ok: true, skipped: true, reason: 'missing email_id' })
    }

    const resendId: string = data.email_id

    // ── 4. Find matching ce_envios record ────────────────────────────────
    const { data: envio, error: envioErr } = await supabase
      .from('ce_envios')
      .select('id, cuenta_id, contacto_id, enrollment_id')
      .eq('resend_id', resendId)
      .maybeSingle()

    if (envioErr) {
      console.error('ce-webhook-resend: query error:', envioErr.message)
      return jsonResponse({ ok: true, error: envioErr.message })
    }

    // ── 5. Ignore events for non-CE emails ───────────────────────────────
    if (!envio) {
      return jsonResponse({ ok: true, skipped: true, reason: 'no matching ce_envios record' })
    }

    // ── 6. Insert ce_eventos record ──────────────────────────────────────
    const { error: eventoErr } = await supabase.from('ce_eventos').insert({
      tipo,
      envio_id: envio.id,
      cuenta_id: envio.cuenta_id,
      contacto_id: envio.contacto_id,
      payload,
      resend_event_id: payload.id ?? null,
    })

    if (eventoErr) {
      console.error('ce-webhook-resend: insert ce_eventos error:', eventoErr.message)
      // Still return 200 — the DB trigger may handle dedup or the event is already recorded
      return jsonResponse({ ok: true, error: eventoErr.message })
    }

    // ── 7. The ce_procesar_evento trigger handles propagation ────────────
    //    Updates ce_envios estado, ce_contactos stats, ce_enrollments estado

    // ── 8. For bounce/complaint: check auto-pause on the account ─────────
    if (tipo === 'bounced' || tipo === 'complained') {
      const { error: pausaErr } = await supabase.rpc('ce_check_auto_pausa', {
        p_cuenta_id: envio.cuenta_id,
      })

      if (pausaErr) {
        console.error('ce-webhook-resend: ce_check_auto_pausa error:', pausaErr.message)
        // Non-critical — do not fail the webhook
      }
    }

    console.log(
      `ce-webhook-resend: processed ${tipo} for envio=${envio.id} cuenta=${envio.cuenta_id}`,
    )

    return jsonResponse({ ok: true, tipo, envio_id: envio.id })
  } catch (err: any) {
    // Catch-all: always return 200 to Resend
    console.error('ce-webhook-resend fatal error:', err)
    return jsonResponse({ ok: true, error: err.message })
  }
})
