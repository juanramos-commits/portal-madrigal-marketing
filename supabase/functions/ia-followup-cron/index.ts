import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-followup-cron
 *
 * Runs every 15 minutes to reactivate scheduled followup conversations.
 *
 * 1. Finds conversations with estado='scheduled_followup', chatbot_activo=false,
 *    followup_at in the past.
 * 2. For each: validates agent active, operating hours, lead not opted out.
 * 3. Updates conversation state to needs_reply, sends follow_up template,
 *    logs and increments metrics.
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

/**
 * Check if the current time in Europe/Madrid falls within the agent's
 * configured operating hours (config.horario).
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  try {
    // === 1. Find conversations ready for followup ===
    const { data: convos, error: convosErr } = await supabase
      .from('ia_conversaciones')
      .select('id, agente_id, lead_id, ab_version')
      .eq('estado', 'scheduled_followup')
      .eq('chatbot_activo', false)
      .not('followup_at', 'is', null)
      .lt('followup_at', new Date().toISOString())
      .limit(30)

    if (convosErr) {
      console.error('Error querying conversations:', convosErr)
      return jsonResponse({ error: 'Query failed', details: convosErr.message }, 500)
    }

    if (!convos || convos.length === 0) {
      return jsonResponse({ status: 'ok', processed: 0, message: 'No followups pending' })
    }

    const results: Array<{ conversacion_id: string; status: string; error?: string }> = []
    const today = new Date().toISOString().split('T')[0]

    // === 2. Process each conversation independently ===
    for (const convo of convos) {
      try {
        // --- Load agent ---
        const { data: agente } = await supabase
          .from('ia_agentes')
          .select('id, activo, config')
          .eq('id', convo.agente_id)
          .single()

        if (!agente || !agente.activo) {
          results.push({
            conversacion_id: convo.id,
            status: 'skipped',
            error: 'agent_inactive',
          })
          continue
        }

        // --- Check operating hours ---
        if (!isWithinOperatingHours(agente.config as Record<string, unknown> | null)) {
          results.push({
            conversacion_id: convo.id,
            status: 'skipped',
            error: 'outside_operating_hours',
          })
          continue
        }

        // --- Load lead ---
        const { data: lead } = await supabase
          .from('ia_leads')
          .select('id, telefono, opted_out')
          .eq('id', convo.lead_id)
          .single()

        if (!lead || lead.opted_out) {
          results.push({
            conversacion_id: convo.id,
            status: 'skipped',
            error: lead ? 'lead_opted_out' : 'lead_not_found',
          })
          continue
        }

        // --- Send follow_up template via ia-whatsapp-send ---
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/ia-whatsapp-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agente_id: convo.agente_id,
            conversacion_id: convo.id,
            to: lead.telefono,
            sender: 'bot',
            template_name: 'follow_up',
            template_params: {},
          }),
        })

        const sendResult = await sendRes.json()

        if (!sendRes.ok || sendResult.sent === 0) {
          await supabase.from('ia_logs').insert({
            agente_id: convo.agente_id,
            conversacion_id: convo.id,
            tipo: 'error',
            mensaje: `Followup template send failed: ${JSON.stringify(sendResult).substring(0, 300)}`,
          })
          results.push({
            conversacion_id: convo.id,
            status: 'error',
            error: 'send_failed',
          })
          continue
        }

        // --- Update conversation state (only after successful send) ---
        const { error: updateErr } = await supabase
          .from('ia_conversaciones')
          .update({
            estado: 'needs_reply',
            chatbot_activo: true,
            step: 'followup',
            followup_at: null,
          })
          .eq('id', convo.id)

        if (updateErr) {
          throw new Error(`Update failed: ${updateErr.message}`)
        }

        // --- Log ---
        await supabase.from('ia_logs').insert({
          agente_id: convo.agente_id,
          conversacion_id: convo.id,
          tipo: 'info',
          mensaje: `Followup reactivado: conversación reactivada y plantilla follow_up enviada`,
        })

        // --- Increment metrics ---
        const abVersion = convo.ab_version || 'A'
        await supabase.rpc('ia_increment_metricas', {
          p_agente_id: convo.agente_id,
          p_fecha: today,
          p_ab_version: abVersion,
          p_mensajes_enviados: 1,
        })

        results.push({ conversacion_id: convo.id, status: 'ok' })
      } catch (err) {
        console.error(`Error processing followup for ${convo.id}:`, err)

        await supabase.from('ia_logs').insert({
          agente_id: convo.agente_id,
          conversacion_id: convo.id,
          tipo: 'error',
          mensaje: `Error en followup cron: ${String(err)}`,
          detalles: { error: String(err), stack: (err as Error).stack },
        }).catch(() => {})

        results.push({
          conversacion_id: convo.id,
          status: 'error',
          error: String(err),
        })
      }
    }

    const succeeded = results.filter(r => r.status === 'ok').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status === 'error').length

    return jsonResponse({
      status: 'ok',
      processed: convos.length,
      succeeded,
      skipped,
      failed,
      results,
    })
  } catch (err) {
    console.error('Fatal error in ia-followup-cron:', err)
    return jsonResponse({ error: 'Cron failed', details: String(err) }, 500)
  }
})
