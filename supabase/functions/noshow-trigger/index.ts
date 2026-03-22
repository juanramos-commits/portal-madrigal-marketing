import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * noshow-trigger
 *
 * Called when a cita is created or updated to 'agendada'.
 * Programs all confirmation/reminder steps based on ventas_noshow_config.
 *
 * For each active step, calculates the exact send time based on:
 * - offset_after: X minutes after agendamiento
 * - fixed_time_before: X minutes before the cita
 * - fixed_time_day_before: specific hour (HHMM) the day before
 * - offset_after_noshow: X minutes after the cita time (for no-show recovery)
 *
 * Also generates a unique token for the pre-meeting landing page
 * and calculates initial no-show risk score.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-supabase-api-version',
}

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonRes({ error: 'Invalid JSON' }, 400)
  }

  const citaId = params.cita_id as string
  if (!citaId) {
    return jsonRes({ error: 'cita_id required' }, 400)
  }

  try {
    // === 1. Load cita with lead and closer info ===
    const { data: cita, error: citaErr } = await supabase
      .from('ventas_citas')
      .select(`
        id, fecha_hora, duracion_minutos, estado, closer_id, lead_id,
        google_meet_url, noshow_secuencia_activa, noshow_token,
        lead:ventas_leads(id, nombre, telefono, email, categoria_id, categoria:ventas_categorias(nombre)),
        closer:usuarios!ventas_citas_closer_id_fkey(id, nombre)
      `)
      .eq('id', citaId)
      .single()

    if (citaErr || !cita) {
      return jsonRes({ error: 'Cita not found', details: citaErr?.message }, 404)
    }

    if (cita.estado !== 'agendada') {
      return jsonRes({ status: 'skipped', reason: 'Cita not in agendada state' })
    }

    // Don't re-trigger if sequence already active
    if (cita.noshow_secuencia_activa) {
      return jsonRes({ status: 'skipped', reason: 'Sequence already active' })
    }

    const citaTime = new Date(cita.fecha_hora as string)
    const now = new Date()
    const lead = cita.lead as Record<string, unknown> | null
    const closer = cita.closer as Record<string, unknown> | null

    if (citaTime <= now) {
      return jsonRes({ status: 'skipped', reason: 'Cita is in the past' })
    }

    // === 2. Load active config steps ===
    const { data: steps } = await supabase
      .from('ventas_noshow_config')
      .select('*')
      .eq('activo', true)
      .order('orden')

    if (!steps || steps.length === 0) {
      return jsonRes({ status: 'skipped', reason: 'No active steps configured' })
    }

    // === 3. Generate token for pre-meeting page ===
    const token = cita.noshow_token || generateToken()

    // === 4. Calculate initial risk score ===
    let riskScore = 50 // baseline

    // Day of week risk
    const dayOfWeek = citaTime.getDay()
    if (dayOfWeek === 1) riskScore += 10 // Monday
    if (dayOfWeek === 5) riskScore += 15 // Friday

    // Time risk
    const hour = citaTime.getHours()
    if (hour < 10) riskScore += 10 // Early morning
    if (hour >= 17) riskScore += 10 // Late afternoon

    // Time gap risk (more days = more risk)
    const hoursUntilCita = (citaTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursUntilCita > 120) riskScore += 15 // 5+ days out
    else if (hoursUntilCita > 72) riskScore += 10 // 3+ days

    riskScore = Math.min(100, Math.max(0, riskScore))

    // === 5. Calculate send time for each step ===
    const confirmaciones: Array<Record<string, unknown>> = []
    const citaDuration = (cita.duracion_minutos as number) || 45

    for (const step of steps) {
      let sendAt: Date | null = null
      const timingValor = step.timing_valor as number

      switch (step.timing_tipo) {
        case 'offset_after': {
          // X minutes after NOW (agendamiento)
          sendAt = new Date(now.getTime() + timingValor * 60 * 1000)

          // Special: recurso_valor only if cita is 2+ days away
          if (step.paso === 'recurso_valor' && hoursUntilCita < 48) {
            continue // Skip this step
          }

          // Special: post_asistencia is after cita END, not after agendamiento
          if (step.paso === 'post_asistencia') {
            sendAt = new Date(citaTime.getTime() + (citaDuration + timingValor) * 60 * 1000)
          }
          break
        }

        case 'fixed_time_before': {
          // X minutes before the cita
          sendAt = new Date(citaTime.getTime() - timingValor * 60 * 1000)
          break
        }

        case 'fixed_time_day_before': {
          // Specific hour (HHMM) the day before the cita
          const dayBefore = new Date(citaTime)
          dayBefore.setDate(dayBefore.getDate() - 1)
          const hh = Math.floor(timingValor / 100)
          const mm = timingValor % 100
          dayBefore.setHours(hh, mm, 0, 0)
          sendAt = dayBefore

          // If cita is tomorrow and we're past the send time, skip
          if (sendAt <= now) continue
          break
        }

        case 'offset_after_noshow': {
          // X minutes after the cita time (for no-show steps)
          sendAt = new Date(citaTime.getTime() + timingValor * 60 * 1000)
          break
        }
      }

      if (!sendAt || sendAt <= now) {
        // Don't schedule steps in the past
        // Exception: confirmacion should always be sent (even if calculated as "now")
        if (step.paso === 'confirmacion') {
          sendAt = new Date(now.getTime() + 5000) // 5 seconds from now
        } else {
          continue
        }
      }

      confirmaciones.push({
        cita_id: citaId,
        paso: step.paso,
        canal: step.canal,
        estado: 'programado',
        programado_at: sendAt.toISOString(),
      })
    }

    // === 6. Insert all confirmaciones ===
    if (confirmaciones.length > 0) {
      const { error: insertErr } = await supabase
        .from('ventas_cita_confirmaciones')
        .insert(confirmaciones)

      if (insertErr) {
        console.error('Error inserting confirmaciones:', insertErr)
        return jsonRes({ error: 'Failed to create sequence', details: insertErr.message }, 500)
      }
    }

    // === 7. Update cita with token, risk score, sequence active ===
    await supabase
      .from('ventas_citas')
      .update({
        noshow_secuencia_activa: true,
        noshow_token: token,
        noshow_risk_score: riskScore,
      })
      .eq('id', citaId)

    return jsonRes({
      status: 'ok',
      steps_programmed: confirmaciones.length,
      risk_score: riskScore,
      token,
      lead_name: (lead as Record<string, unknown>)?.nombre,
      closer_name: (closer as Record<string, unknown>)?.nombre,
      cita_time: cita.fecha_hora,
    })
  } catch (err) {
    console.error('noshow-trigger error:', err)
    return jsonRes({ error: 'Internal error', details: String(err) }, 500)
  }
})
