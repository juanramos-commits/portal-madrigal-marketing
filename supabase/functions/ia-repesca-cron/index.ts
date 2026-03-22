import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-supabase-api-version',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const TEMPLATES: Record<number, string> = {
  0: 'ests_por_aqui',
  1: 'ojitos',
  2: 'ultimo_toque_y_no_molesto_mas__seguimos_o_lo_dejamos_aqui',
}

const DEFAULT_DELAYS = [7200, 86400, 259200]
const MAX_CONVOS = 20

function inHours(h: Record<string, unknown>): boolean {
  if (!h || !h.inicio || !h.fin) return true
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
  })
  const parts = fmt.formatToParts(now)
  const hr = parseInt(parts.find((p: Intl.DateTimeFormatPart) => p.type === 'hour')?.value || '0')
  const mn = parseInt(parts.find((p: Intl.DateTimeFormatPart) => p.type === 'minute')?.value || '0')
  const cur = hr * 60 + mn
  const dayStr = dayFmt.format(now)
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const curDay = dayMap[dayStr] ?? 0
  const dias = h.dias as number[] | undefined
  if (dias && dias.length > 0 && !dias.includes(curDay)) return false
  const inicio = (h.inicio as string).split(':').map(Number)
  const fin = (h.fin as string).split(':').map(Number)
  const iMin = inicio[0] * 60 + inicio[1]
  const fMin = fin[0] * 60 + fin[1]
  return cur >= iMin && cur <= fMin
}

async function safeLog(sb: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  try { await sb.from('ia_logs').insert(row) } catch (_e) { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const sbUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const sb = createClient(sbUrl, sbKey)
  const t0 = Date.now()
  const today = new Date().toISOString().split('T')[0]
  let totSent = 0
  let totErr = 0

  try {
    const { data: agentes, error: aErr } = await sb
      .from('ia_agentes').select('id, config').eq('activo', true)
    if (aErr) throw new Error(aErr.message)
    if (!agentes || agentes.length === 0) {
      return json({ status: 'ok', message: 'No active agents' })
    }

    for (const ag of agentes) {
      try {
        const cfg = ag.config || {}
        const delays: number[] = cfg.delays_repesca || DEFAULT_DELAYS
        if (!inHours(cfg.horario || {})) continue

        const { data: convos, error: cErr } = await sb
          .from('ia_conversaciones')
          .select('id, lead_id, followup_count, last_bot_message_at, ab_version')
          .eq('agente_id', ag.id)
          .eq('chatbot_activo', true)
          .eq('estado', 'waiting_reply')
          .lt('followup_count', 3)
          .order('last_bot_message_at', { ascending: true })
          .limit(MAX_CONVOS)

        if (cErr || !convos) continue
        const now = new Date()

        for (const c of convos) {
          try {
            const fc = c.followup_count || 0
            if (!c.last_bot_message_at) continue
            const delay = delays[fc] ?? delays[delays.length - 1]
            const eligible = new Date(new Date(c.last_bot_message_at).getTime() + delay * 1000)
            if (now < eligible) continue

            const { data: lead } = await sb
              .from('ia_leads').select('id, telefono, opted_out')
              .eq('id', c.lead_id).single()
            if (!lead || lead.opted_out) continue

            const tpl = TEMPLATES[fc]
            if (!tpl) continue

            const res = await fetch(`${sbUrl}/functions/v1/ia-whatsapp-send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sbKey}` },
              body: JSON.stringify({
                agente_id: ag.id,
                conversacion_id: c.id,
                to: lead.telefono,
                sender: 'bot',
                is_repesca: true,
                template_name: tpl,
              }),
            })
            const rd = await res.json()
            if (!res.ok || rd.error) {
              totErr++
              await safeLog(sb, {
                agente_id: ag.id, conversacion_id: c.id, tipo: 'error',
                mensaje: `Repesca: error plantilla ${tpl}: ${rd.error || 'unknown'}`,
              })
              continue
            }

            const nfc = fc + 1
            const upd: Record<string, unknown> = {
              followup_count: nfc,
              last_bot_message_at: new Date().toISOString(),
            }
            if (nfc >= 3) { upd.estado = 'no_response'; upd.chatbot_activo = false }
            await sb.from('ia_conversaciones').update(upd).eq('id', c.id)

            await safeLog(sb, {
              agente_id: ag.id, conversacion_id: c.id, tipo: 'info',
              mensaje: `Repesca ${nfc}/3: ${tpl}${nfc >= 3 ? ' (cerrada)' : ''}`,
            })

            try {
              await sb.rpc('ia_increment_metricas', {
                p_agente_id: ag.id, p_fecha: today,
                p_ab_version: c.ab_version || 'A',
                p_mensajes_enviados: 1,
                ...(nfc >= 3 ? { p_leads_descartados: 1 } : {}),
              })
            } catch (_e) { /* best-effort */ }

            totSent++
          } catch (_ce) { totErr++ }
        }
      } catch (_ae) { totErr++ }
    }

    await safeLog(sb, {
      tipo: 'info',
      mensaje: `Repesca cron: ${totSent} enviadas, ${totErr} errores, ${Date.now() - t0}ms`,
    })

    return json({ status: 'ok', sent: totSent, errors: totErr, ms: Date.now() - t0 })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
