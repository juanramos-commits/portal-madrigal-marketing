import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-repesca-cron
 *
 * Runs every 30 minutes. For each active agent, finds conversations
 * stuck in 'waiting_reply' and sends follow-up template messages
 * (repesca) based on configured delays.
 *
 * Templates by followup_count:
 *   0 -> ests_por_aqui
 *   1 -> ojitos
 *   2 -> ultimo_toque_y_no_molesto_m
 *
 * After 3 follow-ups without reply, marks conversation as 'no_response'.
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

const REPESCA_TEMPLATES: Record<number, string> = {
  0: 'ests_por_aqui',
  1: 'ojitos',
  2: 'ultimo_toque_y_no_molesto_m',
}

const DEFAULT_DELAYS = [7200, 86400, 259200] // 2h, 24h, 72h in seconds
const MAX_CONVERSATIONS_PER_AGENT = 20

/**
 * Check if current time (in Europe/Madrid) is within agent operating hours.
 */
function isWithinOperatingHours(horario: {
  inicio?: string
  fin?: string
  dias?: number[]
}): boolean {
  if (!horario || !horario.inicio || !horario.fin) {
    return true // No schedule configured = always active
  }

  const now = new Date()
  const madridFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
  })

  // Get current time in Madrid
  const timeParts = madridFormatter.formatToParts(now)
  const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0')
  const currentMinutes = hour * 60 + minute

  // Get current day of week in Madrid (0=Sunday)
  const dayStr = dayFormatter.format(now)
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const currentDay = dayMap[dayStr] ?? 0

  // Check day
  if (horario.dias && horario.dias.length > 0) {
    if (!horario.dias.includes(currentDay)) {
      return false
    }
  }

  // Parse inicio/fin (format "HH:MM")
  const [inicioH, inicioM] = horario.inicio.split(':').map(Number)
  const [finH, finM] = horario.fin.split(':').map(Number)
  const inicioMinutes = inicioH * 60 + inicioM
  const finMinutes = finH * 60 + finM

  return currentMinutes >= inicioMinutes && currentMinutes <= finMinutes
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
  let totalErrors = 0
  const agentResults: Array<{ agente_id: string; processed: number; sent: number; errors: number }> = []

  try {
    // === LOAD ACTIVE AGENTS ===
    const { data: agentes, error: agentesErr } = await supabase
      .from('ia_agentes')
      .select('id, config')
      .eq('activo', true)

    if (agentesErr) {
      throw new Error(`Error loading agents: ${agentesErr.message}`)
    }

    if (!agentes || agentes.length === 0) {
      return jsonResponse({ status: 'ok', message: 'No active agents', processed: 0 })
    }

    // === PROCESS EACH AGENT ===
    for (const agente of agentes) {
      let agentProcessed = 0
      let agentSent = 0
      let agentErrors = 0

      try {
        const config = agente.config || {}
        const delays: number[] = config.delays_repesca || DEFAULT_DELAYS
        const horario = config.horario || {}

        // Check operating hours
        if (!isWithinOperatingHours(horario)) {
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'info',
            mensaje: 'Repesca cron: fuera de horario operativo, saltando agente',
          })
          continue
        }

        // === FIND ELIGIBLE CONVERSATIONS ===
        // Conversations where:
        //   chatbot_activo = true
        //   estado = 'waiting_reply'
        //   followup_count < 3
        const { data: conversations, error: convosErr } = await supabase
          .from('ia_conversaciones')
          .select('id, lead_id, agente_id, followup_count, last_bot_message_at, ab_version')
          .eq('agente_id', agente.id)
          .eq('chatbot_activo', true)
          .eq('estado', 'waiting_reply')
          .lt('followup_count', 3)
          .order('last_bot_message_at', { ascending: true })
          .limit(MAX_CONVERSATIONS_PER_AGENT)

        if (convosErr) {
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'error',
            mensaje: `Repesca cron: error cargando conversaciones: ${convosErr.message}`,
          })
          agentErrors++
          continue
        }

        if (!conversations || conversations.length === 0) {
          continue
        }

        const now = new Date()

        for (const convo of conversations) {
          try {
            const followupCount = convo.followup_count || 0
            const lastBotAt = convo.last_bot_message_at

            if (!lastBotAt) continue

            // Check if enough time has elapsed for this followup step
            const delaySeconds = delays[followupCount] ?? delays[delays.length - 1]
            const eligibleAt = new Date(new Date(lastBotAt).getTime() + delaySeconds * 1000)

            if (now < eligibleAt) {
              continue // Not enough time has passed
            }

            // === GET LEAD ===
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
                mensaje: `Repesca: lead no encontrado (${convo.lead_id})`,
              })
              agentErrors++
              continue
            }

            // Check opt-out
            if (lead.opted_out) {
              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                conversacion_id: convo.id,
                tipo: 'info',
                mensaje: `Repesca: lead opted_out, saltando`,
              })
              continue
            }

            // === PICK TEMPLATE ===
            const templateName = REPESCA_TEMPLATES[followupCount]
            if (!templateName) {
              agentErrors++
              continue
            }

            // === SEND VIA ia-whatsapp-send ===
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
                is_repesca: true,
                template_name: templateName,
              }),
            })

            const sendResult = await sendRes.json()

            if (!sendRes.ok || sendResult.error) {
              await supabase.from('ia_logs').insert({
                agente_id: agente.id,
                conversacion_id: convo.id,
                tipo: 'error',
                mensaje: `Repesca: error enviando plantilla ${templateName}: ${sendResult.error || 'unknown'}`,
                detalles: sendResult,
              })
              agentErrors++
              continue
            }

            // === UPDATE CONVERSATION ===
            const newFollowupCount = followupCount + 1
            const convoUpdate: Record<string, unknown> = {
              followup_count: newFollowupCount,
              last_bot_message_at: new Date().toISOString(),
            }

            // If reached max followups, mark as no_response
            if (newFollowupCount >= 3) {
              convoUpdate.estado = 'no_response'
              convoUpdate.chatbot_activo = false
            }

            const { error: updateErr } = await supabase
              .from('ia_conversaciones')
              .update(convoUpdate)
              .eq('id', convo.id)

            if (updateErr) {
              throw new Error(`Conversation update failed: ${updateErr.message}`)
            }

            // === LOG ===
            await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              conversacion_id: convo.id,
              tipo: 'info',
              mensaje: `Repesca ${newFollowupCount}/3 enviada: ${templateName}${newFollowupCount >= 3 ? ' (conversacion cerrada por no_response)' : ''}`,
              detalles: {
                template: templateName,
                followup_count: newFollowupCount,
                delay_seconds: delaySeconds,
              },
            })

            // === INCREMENT METRICS ===
            const abVersion = convo.ab_version || 'A'
            await supabase.rpc('ia_increment_metricas', {
              p_agente_id: agente.id,
              p_fecha: today,
              p_ab_version: abVersion,
              p_mensajes_enviados: 1,
              ...(newFollowupCount >= 3 ? { p_leads_descartados: 1 } : {}),
            }).catch(() => {
              // Metrics increment is best-effort
            })

            agentSent++
            agentProcessed++
          } catch (convoErr) {
            // One conversation failing should not stop the others
            agentErrors++
            await supabase.from('ia_logs').insert({
              agente_id: agente.id,
              conversacion_id: convo.id,
              tipo: 'error',
              mensaje: `Repesca: error procesando conversacion: ${convoErr}`,
              detalles: { error: String(convoErr) },
            }).catch(() => {})
          }
        }
      } catch (agentErr) {
        agentErrors++
        await supabase.from('ia_logs').insert({
          agente_id: agente.id,
          tipo: 'error',
          mensaje: `Repesca cron: error procesando agente: ${agentErr}`,
          detalles: { error: String(agentErr) },
        }).catch(() => {})
      }

      agentResults.push({
        agente_id: agente.id,
        processed: agentProcessed,
        sent: agentSent,
        errors: agentErrors,
      })

      totalProcessed += agentProcessed
      totalSent += agentSent
      totalErrors += agentErrors
    }

    const runMs = Date.now() - runStart

    // Log summary
    await supabase.from('ia_logs').insert({
      tipo: 'info',
      mensaje: `Repesca cron completado: ${totalSent} enviadas, ${totalErrors} errores, ${runMs}ms`,
      detalles: {
        agents_checked: agentes.length,
        total_processed: totalProcessed,
        total_sent: totalSent,
        total_errors: totalErrors,
        run_ms: runMs,
        agent_results: agentResults,
      },
    }).catch(() => {})

    return jsonResponse({
      status: 'ok',
      agents_checked: agentes.length,
      total_processed: totalProcessed,
      total_sent: totalSent,
      total_errors: totalErrors,
      run_ms: runMs,
      agent_results: agentResults,
    })
  } catch (err) {
    console.error('Repesca cron fatal error:', err)

    await supabase.from('ia_logs').insert({
      tipo: 'error',
      mensaje: `Repesca cron: error fatal: ${err}`,
      detalles: { error: String(err), stack: (err as Error).stack },
    }).catch(() => {})

    return jsonResponse({ error: 'Repesca cron failed', details: String(err) }, 500)
  }
})
