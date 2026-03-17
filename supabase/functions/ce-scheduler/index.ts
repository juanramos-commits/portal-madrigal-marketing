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

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns { dayOfWeek (1=Mon…7=Sun), hours, minutes } in the given tz. */
function nowInTz(tz: string): { dayOfWeek: number; hours: number; minutes: number; timeStr: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const weekdayStr = parts.find((p) => p.type === 'weekday')!.value // Mon, Tue, …
  const hours = parseInt(parts.find((p) => p.type === 'hour')!.value, 10)
  const minutes = parseInt(parts.find((p) => p.type === 'minute')!.value, 10)

  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const dayOfWeek = dayMap[weekdayStr] ?? 1

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  return { dayOfWeek, hours, minutes, timeStr }
}

/** Random integer between min and max (inclusive). */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Sleep for ms milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  try {
    // ── 1. Check global pause ────────────────────────────────────────────
    const { data: pauseRow } = await supabase
      .from('ce_config')
      .select('valor')
      .eq('clave', 'pausa_global')
      .maybeSingle()

    if (pauseRow?.valor === true || pauseRow?.valor === 'true') {
      return jsonResponse({ status: 'paused' })
    }

    // ── 2. Read delay config ─────────────────────────────────────────────
    const { data: delayMinRow } = await supabase
      .from('ce_config')
      .select('valor')
      .eq('clave', 'delay_min_segundos')
      .maybeSingle()

    const { data: delayMaxRow } = await supabase
      .from('ce_config')
      .select('valor')
      .eq('clave', 'delay_max_segundos')
      .maybeSingle()

    const delayMinSec = parseInt(delayMinRow?.valor ?? '5', 10)
    const delayMaxSec = parseInt(delayMaxRow?.valor ?? '15', 10)

    // ── 3. Get eligible enrollments ──────────────────────────────────────
    // Uses a raw query to handle the join + timezone window filtering.
    const { data: enrollments, error: enrollErr } = await supabase.rpc(
      'ce_obtener_enrollments_listos',
      { limite: 50 },
    )

    // If the RPC doesn't exist yet, fall back to a manual query
    let readyEnrollments = enrollments

    if (enrollErr) {
      console.warn('ce_obtener_enrollments_listos RPC not available, using fallback query:', enrollErr.message)

      const nowUtc = new Date().toISOString()

      const { data: fallback, error: fbErr } = await supabase
        .from('ce_enrollments')
        .select(`
          id,
          secuencia_id,
          contacto_id,
          cuenta_id,
          paso_actual,
          ce_secuencias!inner (
            id,
            estado,
            dias_envio,
            hora_inicio,
            hora_fin,
            timezone
          )
        `)
        .eq('estado', 'activo')
        .lte('proximo_envio_at', nowUtc)
        .eq('ce_secuencias.estado', 'activa')
        .limit(50)

      if (fbErr) {
        console.error('Fallback query error:', fbErr.message)
        return jsonResponse({ error: 'Failed to query enrollments', detail: fbErr.message }, 500)
      }

      // Filter by time window and day of week in-memory
      readyEnrollments = (fallback ?? []).filter((e: any) => {
        const sec = e.ce_secuencias
        const tz = sec.timezone ?? 'Europe/Madrid'
        const { dayOfWeek, timeStr } = nowInTz(tz)

        // Check day of week
        const diasEnvio: number[] = sec.dias_envio ?? [1, 2, 3, 4, 5]
        if (!diasEnvio.includes(dayOfWeek)) return false

        // Check time window
        const horaInicio: string = sec.hora_inicio ?? '09:00:00'
        const horaFin: string = sec.hora_fin ?? '18:00:00'
        if (timeStr < horaInicio || timeStr > horaFin) return false

        return true
      })
    }

    if (!readyEnrollments || readyEnrollments.length === 0) {
      return jsonResponse({ status: 'ok', dispatched: 0, message: 'No enrollments ready' })
    }

    // ── 4. Dispatch each enrollment ──────────────────────────────────────
    let dispatched = 0
    let succeeded = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    for (const enrollment of readyEnrollments) {
      const enrollmentId = enrollment.id
      const secuenciaId = enrollment.secuencia_id
      let cuentaId = enrollment.cuenta_id

      try {
        // ── 4a. Account rotation if no cuenta assigned ───────────────────
        if (!cuentaId) {
          cuentaId = await pickAccount(supabase, secuenciaId, enrollmentId)
        } else {
          // Verify the assigned account can still send
          const canSend = await accountCanSend(supabase, cuentaId)
          if (!canSend) {
            cuentaId = await pickAccount(supabase, secuenciaId, enrollmentId)
          }
        }

        if (!cuentaId) {
          skipped++
          errors.push(`enrollment=${enrollmentId}: no available account`)
          continue
        }

        // ── 4b. Determine the current paso ───────────────────────────────
        const pasoActual = enrollment.paso_actual ?? 1

        const { data: paso, error: pasoErr } = await supabase
          .from('ce_pasos')
          .select('id')
          .eq('secuencia_id', secuenciaId)
          .eq('orden', pasoActual)
          .maybeSingle()

        if (pasoErr || !paso) {
          skipped++
          errors.push(`enrollment=${enrollmentId}: paso orden=${pasoActual} not found`)
          continue
        }

        // ── 4c. Invoke ce-send ───────────────────────────────────────────
        dispatched++

        const { error: invokeErr } = await supabase.functions.invoke('ce-send', {
          body: {
            enrollment_id: enrollmentId,
            paso_id: paso.id,
            cuenta_id: cuentaId,
          },
        })

        if (invokeErr) {
          failed++
          errors.push(`enrollment=${enrollmentId}: invoke error – ${invokeErr.message}`)
        } else {
          succeeded++
        }

        // ── 4d. Random delay between sends ───────────────────────────────
        const delaySec = randomBetween(delayMinSec, delayMaxSec)
        await sleep(delaySec * 1000)
      } catch (err: any) {
        failed++
        errors.push(`enrollment=${enrollmentId}: ${err.message}`)
      }
    }

    return jsonResponse({
      status: 'ok',
      dispatched,
      succeeded,
      failed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('ce-scheduler fatal error:', err)
    return jsonResponse({ error: err.message }, 500)
  }
})

// ── Account rotation helpers ───────────────────────────────────────────────

/**
 * Pick the best available account for a secuencia using least-used-today logic.
 * Saves the picked cuenta_id to the enrollment for future threading consistency.
 */
async function pickAccount(
  supabase: ReturnType<typeof createClient>,
  secuenciaId: string,
  enrollmentId: string,
): Promise<string | null> {
  // Get all accounts linked to this secuencia
  const { data: cuentasLink, error: linkErr } = await supabase
    .from('ce_secuencias_cuentas')
    .select('cuenta_id')
    .eq('secuencia_id', secuenciaId)

  if (linkErr || !cuentasLink || cuentasLink.length === 0) {
    return null
  }

  const cuentaIds = cuentasLink.map((c: any) => c.cuenta_id)

  // Get account details
  const { data: cuentas, error: cErr } = await supabase
    .from('ce_cuentas')
    .select('id, estado')
    .in('id', cuentaIds)
    .in('estado', ['ramping', 'resting'])

  if (cErr || !cuentas || cuentas.length === 0) {
    return null
  }

  // Check limits via SQL functions for each account
  const available: { id: string; enviados: number }[] = []
  for (const cuenta of cuentas) {
    const [{ data: limite }, { data: enviados }] = await Promise.all([
      supabase.rpc('ce_limite_efectivo', { p_cuenta_id: cuenta.id }),
      supabase.rpc('ce_enviados_hoy', { p_cuenta_id: cuenta.id }),
    ])
    const limiteVal = limite ?? 0
    const enviadosVal = enviados ?? 0
    if (enviadosVal < limiteVal) {
      available.push({ id: cuenta.id, enviados: enviadosVal })
    }
  }

  if (available.length === 0) {
    return null
  }

  // Pick the one with fewest sends today (spread the load)
  available.sort((a, b) => a.enviados - b.enviados)
  const picked = available[0]

  // Save cuenta_id to enrollment for threading consistency
  await supabase
    .from('ce_enrollments')
    .update({ cuenta_id: picked.id })
    .eq('id', enrollmentId)

  return picked.id
}

/**
 * Check if an already-assigned account can still send today.
 */
async function accountCanSend(
  supabase: ReturnType<typeof createClient>,
  cuentaId: string,
): Promise<boolean> {
  const { data: cuenta, error } = await supabase
    .from('ce_cuentas')
    .select('estado')
    .eq('id', cuentaId)
    .maybeSingle()

  if (error || !cuenta) return false
  if (!['ramping', 'resting'].includes(cuenta.estado)) return false

  const [{ data: limite }, { data: enviados }] = await Promise.all([
    supabase.rpc('ce_limite_efectivo', { p_cuenta_id: cuentaId }),
    supabase.rpc('ce_enviados_hoy', { p_cuenta_id: cuentaId }),
  ])

  if ((enviados ?? 0) >= (limite ?? 0)) return false

  return true
}
