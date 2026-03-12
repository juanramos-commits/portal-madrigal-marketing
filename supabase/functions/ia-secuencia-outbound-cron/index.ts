import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * ia-secuencia-outbound-cron
 *
 * Runs every 15 minutes. Two responsibilities:
 *
 * A) FIRST CONTACT — Send first messages to queued leads (estado='queued')
 *    - Respects rate_limit_nuevos_dia per agent
 *    - Spreads contacts evenly across operating hours
 *    - Picks template based on agent tipo
 *
 * B) FOLLOW-UP SEQUENCE — Advance sequences for already-contacted leads
 *    - Finds conversations with secuencia_outbound_next_at in the past
 *    - Sends next template or marks as no_response
 *
 * Sequence templates:
 *   step 0 = first message (re_contacto_rosalia_1 for repescadora/outbound_frio)
 *   step 1 → re_contacto_rosalia_2
 *   step 2 → re_contacto_rosalia_3
 *   step 3+ → sequence complete → estado='no_response', chatbot_activo=false
 *
 * Delays between steps come from agent.config.secuencia_delays (array of ms).
 * Default: [172800000, 172800000] = 2 days each.
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

const SEQUENCE_TEMPLATES: Record<number, string> = {
  1: 're_contacto_rosalia_2',
  2: 're_contacto_rosalia_3',
}

// First message template per agent type
const FIRST_MESSAGE_TEMPLATES: Record<string, { template: string; paramsFn: (nombre: string | null) => Record<string, unknown> }> = {
  repescadora: { template: 're_contacto_rosalia_1', paramsFn: () => ({}) },
  outbound_frio: { template: 're_contacto_rosalia_1', paramsFn: () => ({}) },
  setter: { template: 'primer_mensaje_formulario', paramsFn: (nombre) => ({ body: { nombre: nombre || 'amigo/a' } }) },
}

const DEFAULT_DELAYS = [172800000, 172800000] // 2 days each in ms
const MAX_CONVERSATIONS_PER_AGENT = 20
const CRON_INTERVAL_MINUTES = 15

/**
 * Check if current time (in Europe/Madrid) is within agent operating hours.
 *
 * Expected format:
 *   config.horario = { lunes: { inicio: "09:00", fin: "19:00" }, ... }
 *   or config.horario = { inicio: "09:00", fin: "19:00" }  (same every day)
 */
function isWithinOperatingHours(
  config: Record<string, unknown> | null,
): boolean {
  if (!config) return true
  const horario = config.horario as Record<string, unknown> | undefined
  if (!horario) return true

  const now = new Date()

  // Use Intl.DateTimeFormat.formatToParts for reliable timezone conversion
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
  })

  const timeParts = timeFmt.formatToParts(now)
  const currentHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0')
  const currentMinute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0')
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`

  const dayStr = dayFmt.format(now)
  const dayMap: Record<string, string> = {
    Sun: 'domingo', Mon: 'lunes', Tue: 'martes', Wed: 'miercoles',
    Thu: 'jueves', Fri: 'viernes', Sat: 'sabado',
  }
  const diaActual = dayMap[dayStr] ?? 'lunes'

  // Check day-specific schedule first, then fallback to global inicio/fin
  let inicio: string | undefined
  let fin: string | undefined

  const diaConfig = horario[diaActual] as
    | { inicio?: string; fin?: string }
    | undefined

  if (diaConfig && typeof diaConfig === 'object') {
    inicio = diaConfig.inicio
    fin = diaConfig.fin
  } else if (horario.inicio && horario.fin) {
    inicio = horario.inicio as string
    fin = horario.fin as string
  }

  if (!inicio || !fin) return true // No schedule configured → allow

  return currentTimeStr >= inicio && currentTimeStr < fin
}

/**
 * Calculate how many contacts to send this cron run to spread evenly across operating hours.
 * Returns the number of contacts to send in this 15-minute slot.
 */
function contactsPerRun(
  config: Record<string, unknown> | null,
  dailyLimit: number,
  sentToday: number,
): number {
  const remaining = dailyLimit - sentToday
  if (remaining <= 0) return 0

  // Calculate operating hours to determine how many cron runs per day
  let operatingMinutes = 10 * 60 // default 10h if no schedule

  if (config) {
    const horario = config.horario as Record<string, unknown> | undefined
    if (horario) {
      let inicio: string | undefined
      let fin: string | undefined

      // Try today's schedule first, then global
      const now = new Date()
      const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short' })
      const dayStr = dayFmt.format(now)
      const dayMap: Record<string, string> = {
        Sun: 'domingo', Mon: 'lunes', Tue: 'martes', Wed: 'miercoles',
        Thu: 'jueves', Fri: 'viernes', Sat: 'sabado',
      }
      const diaActual = dayMap[dayStr] ?? 'lunes'
      const diaConfig = horario[diaActual] as { inicio?: string; fin?: string } | undefined

      if (diaConfig && typeof diaConfig === 'object') {
        inicio = diaConfig.inicio
        fin = diaConfig.fin
      } else if (horario.inicio && horario.fin) {
        inicio = horario.inicio as string
        fin = horario.fin as string
      }

      if (inicio && fin) {
        const [ih, im] = inicio.split(':').map(Number)
        const [fh, fm] = fin.split(':').map(Number)
        operatingMinutes = (fh * 60 + fm) - (ih * 60 + im)
        if (operatingMinutes <= 0) operatingMinutes = 10 * 60
      }
    }
  }

  const runsPerDay = Math.floor(operatingMinutes / CRON_INTERVAL_MINUTES)
  if (runsPerDay <= 0) return Math.min(1, remaining)

  // Spread evenly: ceil so we don't under-deliver
  const perRun = Math.ceil(dailyLimit / runsPerDay)
  return Math.min(perRun, remaining)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const supabase = createClient(supabaseUrl, serviceKey)

  const runStart = Date.now()
  const today = new Date().toISOString().split('T')[0]
  let totalProcessed = 0
  let totalSent = 0
  let totalCompleted = 0
  let totalErrors = 0
  const agentResults: Array<{
    agente_id: string
    processed: number
    sent: number
    completed: number
    errors: number
  }> = []

  try {
    // === 1. FIND ACTIVE OUTBOUND_FRIO AGENTS ===
    const { data: agentes, error: agentesErr } = await supabase
      .from('ia_agentes')
      .select('id, tipo, config, rate_limit_nuevos_dia')
      .eq('activo', true)
      .in('tipo', ['outbound_frio', 'repescadora'])

    if (agentesErr) {
      throw new Error(`Error loading agents: ${agentesErr.message}`)
    }

    if (!agentes || agentes.length === 0) {
      return jsonResponse({ status: 'ok', message: 'No active outbound_frio agents', processed: 0 })
    }

    // === 2. PROCESS EACH AGENT ===
    for (const agente of agentes) {
      let agentProcessed = 0
      let agentSent = 0
      let agentCompleted = 0
      let agentErrors = 0

      try {
        const config = (agente.config || {}) as Record<string, unknown>
        const delays: number[] = (config.secuencia_delays as number[]) || DEFAULT_DELAYS

        // --- Check operating hours ---
        if (!isWithinOperatingHours(config)) {
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'info',
            mensaje: 'Secuencia outbound cron: fuera de horario operativo, saltando agente',
          })
          continue
        }

        // === A) PROCESS QUEUED FIRST CONTACTS ===
        const dailyLimit = agente.rate_limit_nuevos_dia || 20
        const todayStart = today + 'T00:00:00.000Z'

        // Count how many first contacts were already sent today
        const { count: sentTodayCount } = await supabase
          .from('ia_conversaciones')
          .select('id', { count: 'exact', head: true })
          .eq('agente_id', agente.id)
          .not('first_message_sent_at', 'is', null)
          .gte('first_message_sent_at', todayStart)

        const toSendThisRun = contactsPerRun(config, dailyLimit, sentTodayCount || 0)

        if (toSendThisRun > 0) {
          // Fetch queued conversations
          const { data: queued, error: queuedErr } = await supabase
            .from('ia_conversaciones')
            .select('id, lead_id, ab_version')
            .eq('agente_id', agente.id)
            .eq('estado', 'queued')
            .eq('chatbot_activo', true)
            .order('created_at', { ascending: true })
            .limit(toSendThisRun)

          if (queuedErr) {
            try { await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              tipo: 'error',
              mensaje: `Outbound cron: error cargando queued: ${queuedErr.message}`,
            }) } catch (_e) { /* ignore */ }
          } else if (queued && queued.length > 0) {
            const tmplConfig = FIRST_MESSAGE_TEMPLATES[agente.tipo] || FIRST_MESSAGE_TEMPLATES['repescadora']

            for (const qConvo of queued) {
              try {
                // Load lead
                const { data: qLead } = await supabase
                  .from('ia_leads')
                  .select('id, telefono, nombre, opted_out')
                  .eq('id', qConvo.lead_id)
                  .single()

                if (!qLead || qLead.opted_out) {
                  if (qLead?.opted_out) {
                    await supabase.from('ia_conversaciones')
                      .update({ estado: 'descartado', chatbot_activo: false })
                      .eq('id', qConvo.id)
                  }
                  continue
                }

                // Send first message
                const sendRes = await fetch(`${supabaseUrl}/functions/v1/ia-whatsapp-send`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({
                    agente_id: agente.id,
                    conversacion_id: qConvo.id,
                    to: qLead.telefono,
                    sender: 'bot',
                    template_name: tmplConfig.template,
                    template_params: tmplConfig.paramsFn(qLead.nombre),
                  }),
                })

                const sendResult = await sendRes.json()

                if (!sendRes.ok || sendResult.error) {
                  try { await supabase.from('ia_logs').insert({
                    agente_id: agente.id,
                    conversacion_id: qConvo.id,
                    tipo: 'error',
                    mensaje: `Outbound cron: error enviando primer mensaje a ${qLead.telefono}: ${sendResult.error || 'unknown'}`,
                  }) } catch (_e) { /* ignore */ }
                  agentErrors++
                  continue
                }

                // Update conversation: queued → waiting_reply, schedule sequence
                const nextAt = new Date(Date.now() + delays[0]).toISOString()
                await supabase
                  .from('ia_conversaciones')
                  .update({
                    estado: 'waiting_reply',
                    first_message_sent_at: new Date().toISOString(),
                    secuencia_outbound_step: 0,
                    secuencia_outbound_next_at: nextAt,
                  })
                  .eq('id', qConvo.id)

                // Increment metrics
                const abV = qConvo.ab_version || 'A'
                try { await supabase.rpc('ia_increment_metricas', {
                  p_agente_id: agente.id,
                  p_fecha: today,
                  p_ab_version: abV,
                  p_leads_contactados: 1,
                  p_mensajes_enviados: 1,
                }) } catch (_e) { /* ignore */ }

                agentSent++
                agentProcessed++
              } catch (qErr) {
                agentErrors++
                try { await supabase.from('ia_logs').insert({
                  agente_id: agente.id,
                  conversacion_id: qConvo.id,
                  tipo: 'error',
                  mensaje: `Outbound cron: error procesando queued: ${qErr}`,
                }) } catch (_e) { /* ignore */ }
              }
            }

            try { await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              tipo: 'info',
              mensaje: `Outbound cron: ${queued.length} primeros mensajes procesados (${sentTodayCount || 0}+${queued.length}/${dailyLimit} hoy)`,
            }) } catch (_e) { /* ignore */ }
          }
        }

        // === B) FIND ELIGIBLE FOLLOW-UP CONVERSATIONS ===
        const { data: conversations, error: convosErr } = await supabase
          .from('ia_conversaciones')
          .select('id, lead_id, agente_id, secuencia_outbound_step, ab_version')
          .eq('agente_id', agente.id)
          .eq('chatbot_activo', true)
          .not('secuencia_outbound_next_at', 'is', null)
          .lt('secuencia_outbound_next_at', new Date().toISOString())
          .not('estado', 'in', '("agendado","descartado","no_response","queued")')
          .order('secuencia_outbound_next_at', { ascending: true })
          .limit(MAX_CONVERSATIONS_PER_AGENT)

        if (convosErr) {
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'error',
            mensaje: `Secuencia outbound cron: error cargando conversaciones: ${convosErr.message}`,
          })
          agentErrors++
          continue
        }

        if (!conversations || conversations.length === 0) {
          continue
        }

        // === 3. PROCESS EACH CONVERSATION ===
        for (const convo of conversations) {
          try {
            agentProcessed++

            // --- Load lead ---
            const { data: lead, error: leadErr } = await supabase
              .from('ia_leads')
              .select('id, telefono, opted_out')
              .eq('id', convo.lead_id)
              .single()

            if (leadErr || !lead) {
              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                conversacion_id: convo.id,
                tipo: 'error',
                mensaje: `Secuencia outbound: lead no encontrado (${convo.lead_id})`,
              })
              agentErrors++
              continue
            }

            if (lead.opted_out) {
              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                conversacion_id: convo.id,
                tipo: 'info',
                mensaje: 'Secuencia outbound: lead opted_out, saltando',
              })
              continue
            }

            // --- Check if lead has responded (any inbound message after last outbound) ---
            const { data: lastOutbound } = await supabase
              .from('ia_mensajes')
              .select('created_at')
              .eq('conversacion_id', convo.id)
              .eq('direction', 'outbound')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (lastOutbound) {
              const { count: inboundAfter } = await supabase
                .from('ia_mensajes')
                .select('id', { count: 'exact', head: true })
                .eq('conversacion_id', convo.id)
                .eq('direction', 'inbound')
                .gt('created_at', lastOutbound.created_at)

              if (inboundAfter && inboundAfter > 0) {
                // Lead has responded → exit sequence, clear next_at
                await supabase
                  .from('ia_conversaciones')
                  .update({ secuencia_outbound_next_at: null })
                  .eq('id', convo.id)

                await supabase.from('ia_logs').insert({
                  agente_id: agente.id,
                  conversacion_id: convo.id,
                  tipo: 'info',
                  mensaje: 'Secuencia outbound: lead ha respondido, saliendo de secuencia',
                })
                continue
              }
            }

            // --- Check wa_status of last outbound message ---
            // If last message wasn't delivered at all, skip (might be blocked)
            if (lastOutbound) {
              const { data: lastOutMsg } = await supabase
                .from('ia_mensajes')
                .select('wa_status')
                .eq('conversacion_id', convo.id)
                .eq('direction', 'outbound')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

              if (lastOutMsg && !lastOutMsg.wa_status) {
                // No delivery status at all — possibly blocked, skip for now
                try { await supabase.from('ia_logs').insert({
                  agente_id: agente.id,
                  conversacion_id: convo.id,
                  tipo: 'info',
                  mensaje: 'Secuencia outbound: último mensaje sin confirmación de entrega, saltando',
                }) } catch (_e) { /* ignore */ }
                continue
              }
            }

            // --- Determine current step ---
            const step = convo.secuencia_outbound_step || 0

            // Step 0 = primer mensaje (already sent by ia-outbound-primer-mensaje)
            // This cron handles step 1+
            const effectiveStep = step < 1 ? 1 : step

            // --- Check if sequence is complete ---
            const templateName = SEQUENCE_TEMPLATES[effectiveStep]

            if (!templateName) {
              // Step 3+ → sequence complete
              await supabase
                .from('ia_conversaciones')
                .update({
                  estado: 'no_response',
                  chatbot_activo: false,
                  secuencia_outbound_next_at: null,
                })
                .eq('id', convo.id)

              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                conversacion_id: convo.id,
                tipo: 'info',
                mensaje: `Secuencia outbound completada sin respuesta: ${effectiveStep} pasos enviados, marcado como no_response`,
              })

              // Increment no_response metric
              const abVersionEnd = convo.ab_version || 'A'
              try { await supabase.rpc('ia_increment_metricas', {
                p_agente_id: agente.id,
                p_fecha: today,
                p_ab_version: abVersionEnd,
                p_leads_descartados: 1,
              }) } catch (_e) { /* ignore */ }

              agentCompleted++
              continue
            }

            // --- Send template via ia-whatsapp-send ---
            const sendRes = await fetch(`${supabaseUrl}/functions/v1/ia-whatsapp-send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                agente_id: agente.id,
                conversacion_id: convo.id,
                to: lead.telefono,
                sender: 'bot',
                template_name: templateName,
                template_params: {},
              }),
            })

            const sendResult = await sendRes.json()

            if (!sendRes.ok || sendResult.error) {
              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                conversacion_id: convo.id,
                tipo: 'error',
                mensaje: `Secuencia outbound: error enviando plantilla ${templateName}: ${sendResult.error || 'unknown'}`,
                detalles: sendResult,
              })
              agentErrors++
              continue
            }

            // --- Calculate next step delay ---
            const nextStep = effectiveStep + 1
            const delayIndex = effectiveStep - 1 // step 1 uses delays[0], step 2 uses delays[1]
            const delayMs = delays[delayIndex] ?? delays[delays.length - 1] ?? DEFAULT_DELAYS[0]
            const nextAt = new Date(Date.now() + delayMs).toISOString()

            // --- Update conversation ---
            await supabase
              .from('ia_conversaciones')
              .update({
                secuencia_outbound_step: nextStep,
                secuencia_outbound_next_at: nextAt,
              })
              .eq('id', convo.id)

            // --- Log ---
            await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              conversacion_id: convo.id,
              tipo: 'info',
              mensaje: `Secuencia outbound paso ${effectiveStep}: plantilla ${templateName} enviada. Siguiente paso en ${Math.round(delayMs / 3600000)}h`,
              detalles: {
                template: templateName,
                step: effectiveStep,
                next_step: nextStep,
                delay_ms: delayMs,
                next_at: nextAt,
              },
            })

            // --- Increment metrics ---
            const abVersionSend = convo.ab_version || 'A'
            try { await supabase.rpc('ia_increment_metricas', {
              p_agente_id: agente.id,
              p_fecha: today,
              p_ab_version: abVersionSend,
              p_mensajes_enviados: 1,
            }) } catch (_e) { /* ignore */ }

            agentSent++
          } catch (convoErr) {
            agentErrors++
            try { await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              conversacion_id: convo.id,
              tipo: 'error',
              mensaje: `Secuencia outbound: error procesando conversacion: ${convoErr}`,
              detalles: { error: String(convoErr) },
            }) } catch (_e) { /* ignore */ }
          }
        }
      } catch (agentErr) {
        agentErrors++
        try { await supabase.from('ia_logs').insert({
          agente_id: agente.id,
          tipo: 'error',
          mensaje: `Secuencia outbound cron: error procesando agente: ${agentErr}`,
          detalles: { error: String(agentErr) },
        }) } catch (_e) { /* ignore */ }
      }

      agentResults.push({
        agente_id: agente.id,
        processed: agentProcessed,
        sent: agentSent,
        completed: agentCompleted,
        errors: agentErrors,
      })

      totalProcessed += agentProcessed
      totalSent += agentSent
      totalCompleted += agentCompleted
      totalErrors += agentErrors
    }

    const runMs = Date.now() - runStart

    // Log summary
    try { await supabase.from('ia_logs').insert({
      tipo: 'info',
      mensaje: `Secuencia outbound cron completado: ${totalSent} enviadas, ${totalCompleted} completadas, ${totalErrors} errores, ${runMs}ms`,
      detalles: {
        agents_checked: agentes.length,
        total_processed: totalProcessed,
        total_sent: totalSent,
        total_completed: totalCompleted,
        total_errors: totalErrors,
        run_ms: runMs,
        agent_results: agentResults,
      },
    }) } catch (_e) { /* ignore */ }

    return jsonResponse({
      status: 'ok',
      agents_checked: agentes.length,
      total_processed: totalProcessed,
      total_sent: totalSent,
      total_completed: totalCompleted,
      total_errors: totalErrors,
      run_ms: runMs,
      agent_results: agentResults,
    })
  } catch (err) {
    console.error('Secuencia outbound cron fatal error:', err)

    try { await supabase.from('ia_logs').insert({
      tipo: 'error',
      mensaje: `Secuencia outbound cron: error fatal: ${err}`,
      detalles: { error: String(err), stack: String(err) },
    }) } catch (_e) { /* ignore */ }

    return jsonResponse({ error: 'Secuencia outbound cron failed', details: String(err) }, 500)
  }
})
