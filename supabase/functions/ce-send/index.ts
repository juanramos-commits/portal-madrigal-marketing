/**
 * ce-send — Core sending function for Cold Email.
 *
 * Sends ONE email with full anti-spam logic. Called by ce-scheduler.
 *
 * Input (POST JSON): { enrollment_id, paso_id }
 *
 * Anti-spam: plain text only, no tracking pixel, no unsubscribe link,
 * proper threading headers for follow-ups.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, generateMessageId } from '../_shared/resend-client.ts'
import { checkAccountLimit, checkDomainLimit, isPausedGlobally } from '../_shared/rate-limiter.ts'
import { isBlacklisted } from '../_shared/blacklist-checker.ts'
import { replaceVariables, stripLinks } from '../_shared/variable-replacer.ts'

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Parse input ──────────────────────────────────────────────────
    const { enrollment_id, paso_id } = await req.json()
    if (!enrollment_id || !paso_id) {
      return jsonResponse({ error: 'enrollment_id y paso_id son requeridos' }, 400)
    }

    // ── Supabase client (service role) ───────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 1. Check global pause ────────────────────────────────────────
    const paused = await isPausedGlobally(supabase)
    if (paused) {
      return jsonResponse({ error: 'Sistema pausado globalmente' }, 503)
    }

    // ── 2. Load enrollment with related data ─────────────────────────
    const { data: enrollment, error: enrollErr } = await supabase
      .from('ce_enrollments')
      .select(`
        id, contacto_id, secuencia_id, paso_actual, estado, cuenta_id, metadata,
        contacto:ce_contactos!contacto_id (
          id, email, nombre, empresa, cargo, telefono, categoria, zona, etiquetas, campos_custom, estado
        ),
        secuencia:ce_secuencias!secuencia_id (
          id, nombre, estado, timezone, dias_envio, hora_inicio, hora_fin, ab_testing
        ),
        cuenta:ce_cuentas!cuenta_id (
          id, nombre, email, dominio, resend_api_key, estado
        )
      `)
      .eq('id', enrollment_id)
      .single()

    if (enrollErr || !enrollment) {
      return jsonResponse({ error: 'Enrollment no encontrado', detail: enrollErr?.message }, 404)
    }

    const contacto = enrollment.contacto as any
    const secuencia = enrollment.secuencia as any
    const cuenta = enrollment.cuenta as any

    if (!contacto || !secuencia || !cuenta) {
      return jsonResponse({ error: 'Datos relacionados incompletos (contacto, secuencia o cuenta)' }, 400)
    }

    // ── 3. Load paso ─────────────────────────────────────────────────
    const { data: paso, error: pasoErr } = await supabase
      .from('ce_pasos')
      .select('*')
      .eq('id', paso_id)
      .single()

    if (pasoErr || !paso) {
      return jsonResponse({ error: 'Paso no encontrado', detail: pasoErr?.message }, 404)
    }

    // ── 4. Validate enrollment estado ────────────────────────────────
    if (enrollment.estado !== 'activo') {
      return jsonResponse({
        error: 'Enrollment no esta activo',
        estado: enrollment.estado,
      }, 409)
    }

    // ── 5. Check contacto estado ─────────────────────────────────────
    if (contacto.estado !== 'activo') {
      return jsonResponse({
        error: 'Contacto no esta activo',
        estado: contacto.estado,
        contacto_id: contacto.id,
      }, 409)
    }

    // ── 6. Check blacklist ───────────────────────────────────────────
    const blacklisted = await isBlacklisted(supabase, contacto.email)
    if (blacklisted) {
      return jsonResponse({
        error: 'Contacto o dominio en blacklist',
        email: contacto.email,
      }, 403)
    }

    // ── 7. Check account daily limit ─────────────────────────────────
    const accountLimit = await checkAccountLimit(supabase, cuenta.id)
    if (!accountLimit.allowed) {
      return jsonResponse({
        error: 'Limite diario de cuenta alcanzado',
        sent: accountLimit.sent,
        limit: accountLimit.limit,
        cuenta_id: cuenta.id,
      }, 429)
    }

    // ── 8. Check domain daily limit ──────────────────────────────────
    const domainLimit = await checkDomainLimit(supabase, cuenta.dominio)
    if (!domainLimit.allowed) {
      return jsonResponse({
        error: 'Limite diario de dominio alcanzado',
        sent: domainLimit.sent,
        limit: domainLimit.limit,
        dominio: cuenta.dominio,
      }, 429)
    }

    // ── 9. Select A/B variant ────────────────────────────────────────
    let variante: 'a' | 'b' = 'a'
    if (secuencia.ab_testing && paso.asunto_b && paso.cuerpo_b) {
      variante = Math.random() < 0.5 ? 'a' : 'b'
    }

    // ── 10. Get asunto and cuerpo ────────────────────────────────────
    const rawAsunto = variante === 'b' ? paso.asunto_b : paso.asunto_a
    const rawCuerpo = variante === 'b' ? paso.cuerpo_b : paso.cuerpo_a

    // ── 11. Replace variables & strip links (anti-spam) ──────────────
    const asunto = stripLinks(replaceVariables(rawAsunto, contacto))
    const cuerpo = stripLinks(replaceVariables(rawCuerpo, contacto))

    // ── 12. Build threading headers ──────────────────────────────────
    let threadKey: string
    let inReplyTo: string | undefined
    let references: string | undefined

    if (paso.orden === 1) {
      // First email in sequence: generate new thread key
      threadKey = crypto.randomUUID()
    } else {
      // Follow-up: look up the previous envio in this enrollment
      const { data: prevEnvio } = await supabase
        .from('ce_envios')
        .select('message_id, thread_key')
        .eq('enrollment_id', enrollment_id)
        .not('message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (prevEnvio?.thread_key) {
        threadKey = prevEnvio.thread_key
        inReplyTo = prevEnvio.message_id ?? undefined
        references = prevEnvio.message_id ?? undefined
      } else {
        // Fallback: no previous envio found, generate new thread
        threadKey = crypto.randomUUID()
      }
    }

    // ── 13. Send via Resend API (plain text only) ────────────────────
    const fromAddress = cuenta.nombre
      ? `${cuenta.nombre} <${cuenta.email}>`
      : cuenta.email

    const sendResult = await sendEmail({
      apiKey: cuenta.resend_api_key,
      from: fromAddress,
      to: contacto.email,
      subject: asunto,
      text: cuerpo,
      replyTo: cuenta.email,
      inReplyTo,
      references,
    })

    // ── 14. Create ce_envios record ──────────────────────────────────
    const { data: envio, error: envioErr } = await supabase
      .from('ce_envios')
      .insert({
        enrollment_id: enrollment.id,
        paso_id: paso.id,
        cuenta_id: cuenta.id,
        contacto_id: contacto.id,
        variante,
        message_id: sendResult.messageId,
        thread_key: threadKey,
        in_reply_to: inReplyTo ?? null,
        resend_id: sendResult.id,
        estado: 'enviado',
        enviado_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (envioErr) {
      console.error('Error creating ce_envios record:', envioErr)
      return jsonResponse({
        error: 'Email enviado pero fallo al guardar registro',
        detail: envioErr.message,
        resend_id: sendResult.id,
      }, 500)
    }

    // ── 15. Create ce_eventos record (sent) ──────────────────────────
    const { error: eventoErr } = await supabase
      .from('ce_eventos')
      .insert({
        tipo: 'sent',
        envio_id: envio.id,
        cuenta_id: cuenta.id,
        contacto_id: contacto.id,
        payload: {
          resend_id: sendResult.id,
          message_id: sendResult.messageId,
          variante,
          paso_orden: paso.orden,
        },
      })

    if (eventoErr) {
      console.error('Error creating ce_eventos record:', eventoErr)
      // Non-fatal: the trigger on ce_envios insert already set estado=enviado
    }

    // ── 16. Update enrollment: advance paso_actual, calc next send ───
    // Count total steps in this sequence
    const { count: totalPasos } = await supabase
      .from('ce_pasos')
      .select('id', { count: 'exact', head: true })
      .eq('secuencia_id', secuencia.id)

    const isLastPaso = paso.orden >= (totalPasos ?? 0)

    if (isLastPaso) {
      // Sequence completed
      await supabase
        .from('ce_enrollments')
        .update({
          paso_actual: paso.orden,
          estado: 'completado',
          proximo_envio_at: null,
        })
        .eq('id', enrollment.id)
    } else {
      // Calculate proximo_envio_at for the next step
      const { data: nextPaso } = await supabase
        .from('ce_pasos')
        .select('delay_dias')
        .eq('secuencia_id', secuencia.id)
        .eq('orden', paso.orden + 1)
        .single()

      const delayDias = nextPaso?.delay_dias ?? 1
      const proximoEnvioAt = calcularProximoEnvio(
        delayDias,
        secuencia.timezone,
        secuencia.dias_envio,
        secuencia.hora_inicio,
        secuencia.hora_fin,
      )

      await supabase
        .from('ce_enrollments')
        .update({
          paso_actual: paso.orden + 1,
          proximo_envio_at: proximoEnvioAt,
        })
        .eq('id', enrollment.id)
    }

    // ── 17. Return success ───────────────────────────────────────────
    return jsonResponse({
      ok: true,
      envio_id: envio.id,
      resend_id: sendResult.id,
      message_id: sendResult.messageId,
      thread_key: threadKey,
      variante,
      is_last_paso: isLastPaso,
    })
  } catch (err: any) {
    console.error('ce-send error:', err)

    // Distinguish rate limit errors from Resend
    if (err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit')) {
      return jsonResponse({ error: 'Rate limited by email provider', detail: err.message }, 429)
    }

    return jsonResponse({ error: 'Error interno en ce-send', detail: err.message }, 500)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Calculate the next send time respecting timezone, allowed days, and
// sending window (hora_inicio / hora_fin).
// ─────────────────────────────────────────────────────────────────────────────

function calcularProximoEnvio(
  delayDias: number,
  timezone: string,
  diasEnvio: number[],
  horaInicio: string,
  horaFin: string,
): string {
  // Start from now + delay_dias
  const now = new Date()
  const candidateMs = now.getTime() + delayDias * 24 * 60 * 60 * 1000
  let candidate = new Date(candidateMs)

  // Parse hora_inicio and hora_fin (format "HH:MM" or "HH:MM:SS")
  const [inicioH, inicioM] = horaInicio.split(':').map(Number)
  const [finH, finM] = horaFin.split(':').map(Number)

  // Try up to 14 days to find a valid sending slot
  for (let attempt = 0; attempt < 14; attempt++) {
    // Get the day-of-week in the target timezone (1=Monday ... 7=Sunday)
    // JS getDay: 0=Sunday, so we convert: Sun=7, Mon=1, ..., Sat=6
    const localeDateStr = candidate.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'short',
    })
    const jsDow = candidate.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'narrow',
    })

    // Get numeric day in timezone using Intl
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(candidate)

    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? ''
    const dowMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    }
    const isoDow = dowMap[weekdayStr] ?? 1

    // Check if this day is in dias_envio
    if (diasEnvio.includes(isoDow)) {
      // Pick a random time within the sending window for natural behavior
      const randomMinute = Math.floor(
        Math.random() * ((finH * 60 + finM) - (inicioH * 60 + inicioM)),
      )
      const targetH = Math.floor((inicioH * 60 + inicioM + randomMinute) / 60)
      const targetM = (inicioH * 60 + inicioM + randomMinute) % 60

      // Build an ISO string for the target time in the sequence timezone.
      // We construct the date string and use Intl to get the offset.
      const localParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(candidate)

      const year = localParts.find((p) => p.type === 'year')?.value
      const month = localParts.find((p) => p.type === 'month')?.value
      const day = localParts.find((p) => p.type === 'day')?.value

      // Build a date string and parse with timezone offset
      // Use a reliable approach: construct the target datetime and find the UTC equivalent
      const targetDateStr = `${year}-${month}-${day}T${String(targetH).padStart(2, '0')}:${String(targetM).padStart(2, '0')}:00`

      // Convert local time to UTC by computing offset
      const localRef = new Date(targetDateStr + 'Z')
      const offsetMs = getTimezoneOffsetMs(localRef, timezone)
      const utcTime = new Date(localRef.getTime() - offsetMs)

      // Only use this slot if it's in the future
      if (utcTime.getTime() > now.getTime()) {
        return utcTime.toISOString()
      }
    }

    // Move to next day
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000)
  }

  // Fallback: just return now + delay_dias (should not happen with valid config)
  return new Date(now.getTime() + delayDias * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Get the UTC offset in milliseconds for a given timezone at a given instant.
 */
function getTimezoneOffsetMs(date: Date, timezone: string): number {
  // Format the date in the target timezone and parse back to compare with UTC
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'

  const localMs = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')) % 24,
    Number(get('minute')),
    Number(get('second')),
  )

  return localMs - date.getTime()
}
