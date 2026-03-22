import { createClient } from 'jsr:@supabase/supabase-js@2'
import { resolveWaToken } from '../_shared/wa-token.ts'

/**
 * noshow-cron
 *
 * Runs every 5 minutes. Finds programmed confirmaciones with
 * programado_at <= now() and executes them (sends WhatsApp/email).
 *
 * Also:
 * - Cancels all pending steps if cita was cancelled/reagendada
 * - Skips no-show steps if lead already confirmed or attended
 * - Updates risk score based on responses
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

// Template variable replacement
function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
  }
  return result
}

// Format date in Spanish
function formatDateES(date: Date): string {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${dias[date.getDay()]} ${date.getDate()} de ${meses[date.getMonth()]}`
}

function formatTimeES(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    // === 1. Find pending confirmaciones ready to execute ===
    const { data: pending, error: pendErr } = await supabase
      .from('ventas_cita_confirmaciones')
      .select(`
        id, cita_id, paso, canal, programado_at,
        cita:ventas_citas(
          id, fecha_hora, estado, closer_id, lead_id, google_meet_url,
          noshow_confirmado, noshow_token, duracion_minutos,
          lead:ventas_leads(id, nombre, telefono, email, categoria:ventas_categorias(nombre)),
          closer:usuarios!ventas_citas_closer_id_fkey(id, nombre)
        )
      `)
      .eq('estado', 'programado')
      .lte('programado_at', new Date().toISOString())
      .order('programado_at')
      .limit(20)

    if (pendErr) {
      console.error('Error fetching pending:', pendErr)
      return jsonRes({ error: 'Failed to fetch pending', details: pendErr.message }, 500)
    }

    if (!pending || pending.length === 0) {
      return jsonRes({ status: 'ok', processed: 0 })
    }

    const results: Array<{ paso: string; status: string; error?: string }> = []

    for (const conf of pending) {
      const cita = conf.cita as Record<string, unknown>
      if (!cita) {
        await markAs(supabase, conf.id, 'saltado', 'Cita not found')
        results.push({ paso: conf.paso, status: 'skipped', error: 'no_cita' })
        continue
      }

      const lead = cita.lead as Record<string, unknown> | null
      const closer = cita.closer as Record<string, unknown> | null

      // === Cancel all pending if cita is no longer agendada ===
      if (cita.estado !== 'agendada') {
        await supabase
          .from('ventas_cita_confirmaciones')
          .update({ estado: 'cancelado' })
          .eq('cita_id', conf.cita_id)
          .eq('estado', 'programado')
        results.push({ paso: conf.paso, status: 'cancelled', error: 'cita_not_agendada' })
        continue
      }

      // === Skip no-show steps if lead already confirmed ===
      const noshowSteps = ['noshow_5m', 'noshow_30m', 'noshow_24h']
      if (noshowSteps.includes(conf.paso) && cita.noshow_confirmado) {
        await markAs(supabase, conf.id, 'saltado', 'Lead already confirmed')
        results.push({ paso: conf.paso, status: 'skipped', error: 'already_confirmed' })
        continue
      }

      // === Skip D-1 email if lead already responded to D-1 WhatsApp ===
      if (conf.paso === 'd1_email') {
        const { data: d1wa } = await supabase
          .from('ventas_cita_confirmaciones')
          .select('estado')
          .eq('cita_id', conf.cita_id)
          .eq('paso', 'd1_escasez')
          .in('estado', ['respondido', 'confirmado'])
          .maybeSingle()
        if (d1wa) {
          await markAs(supabase, conf.id, 'saltado', 'D-1 WA already responded')
          results.push({ paso: conf.paso, status: 'skipped' })
          continue
        }
      }

      // === Build template variables ===
      const citaDate = new Date(cita.fecha_hora as string)
      const leadName = (lead as Record<string, unknown>)?.nombre as string || 'amigo/a'
      const closerName = (closer as Record<string, unknown>)?.nombre as string || 'nuestro equipo'
      const meetUrl = (cita.google_meet_url as string) || ''
      let leadPhone = ((lead as Record<string, unknown>)?.telefono as string || '').replace(/[\s\-\(\)\.]/g, '')
      // Normalize phone: add +34 if missing
      if (leadPhone && !leadPhone.startsWith('+')) {
        if (/^[679]\d{8}$/.test(leadPhone)) leadPhone = '+34' + leadPhone
        else if (/^34[679]\d{8}$/.test(leadPhone)) leadPhone = '+' + leadPhone
        else leadPhone = '+' + leadPhone
      }
      const leadEmail = (lead as Record<string, unknown>)?.email as string || ''
      const categoriaObj = (lead as Record<string, unknown>)?.categoria as Record<string, unknown> | null
      const categoria = (categoriaObj?.nombre as string) || 'profesional bodas'
      const token = (cita.noshow_token as string) || ''

      const vars: Record<string, string> = {
        nombre: leadName,
        closer: closerName,
        fecha: formatDateES(citaDate),
        hora: formatTimeES(citaDate),
        url: meetUrl,
        categoria: categoria,
        token: token,
      }

      // === Execute based on paso ===
      try {
        const result = await executePaso(supabase, conf, vars, leadPhone, leadEmail, cita)
        results.push({ paso: conf.paso, status: result.status, error: result.error })
      } catch (err) {
        await markAs(supabase, conf.id, 'enviado', `Error: ${err}`)
        results.push({ paso: conf.paso, status: 'error', error: String(err) })
      }
    }

    return jsonRes({
      status: 'ok',
      processed: results.length,
      results,
    })
  } catch (err) {
    console.error('noshow-cron error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})

async function executePaso(
  supabase: ReturnType<typeof createClient>,
  conf: Record<string, unknown>,
  vars: Record<string, string>,
  leadPhone: string,
  leadEmail: string,
  cita: Record<string, unknown>,
): Promise<{ status: string; error?: string }> {
  const paso = conf.paso as string
  const canal = conf.canal as string
  const confId = conf.id as string

  // === WHATSAPP MESSAGES ===
  const waMessages: Record<string, string> = {
    confirmacion: `Hola {{nombre}}! Tu videollamada con {{closer}} queda confirmada para el {{fecha}} a las {{hora}}. Te envío los detalles por email!`,
    micro_compromiso: `Para que {{closer}} pueda preparar tu caso, me dices cuántas bodas hiciste el año pasado?`,
    prueba_social: `Por cierto {{nombre}}, mira lo que consiguen {{categoria}}s como tú con nuestro sistema. Te cuento en la llamada del {{fecha}}!`,
    video_closer: `{{closer}} te ha dejado un mensaje para la llamada del {{fecha}}. Está preparando tu caso!`,
    d1_escasez: `Hola {{nombre}}! Mañana a las {{hora}} tienes la videollamada con {{closer}}. Tu hueco es uno de los últimos de esta semana. Todo bien para esa hora?`,
    d0_2h: `En 2 horas tienes la videollamada! {{closer}} está preparando tu caso. Enlace: {{url}}`,
    d0_15m: `{{closer}} te espera! {{url}}`,
    noshow_5m: `Hola {{nombre}}, {{closer}} está en la llamada esperándote. Todo bien?`,
    noshow_30m: `No te preocupes {{nombre}}! Elige otro momento que te venga mejor y lo cuadramos`,
    noshow_24h: `Oye {{nombre}}, que no pudiste venir no pasa nada. Si te sigue interesando, dime y te busco otro hueco esta semana`,
    post_asistencia: `Qué tal ha ido la llamada con {{closer}}? Todo claro?`,
  }

  // === EMAIL SUBJECTS & BODIES ===
  const emailMessages: Record<string, { asunto: string; cuerpo: string }> = {
    confirmacion: {
      asunto: `Tu videollamada con {{closer}} — {{fecha}} a las {{hora}}`,
      cuerpo: `Hola {{nombre}},\n\nTu videollamada está confirmada:\n\n📅 {{fecha}} a las {{hora}}\n👤 Con {{closer}}\n🔗 Enlace: {{url}}\n\nSi necesitas cambiar la hora, responde a este email.\n\nUn saludo,\nMadrigal Marketing`,
    },
    d1_email: {
      asunto: `Mañana a las {{hora}} — confirmamos?`,
      cuerpo: `Hola {{nombre}},\n\nSolo un recordatorio: mañana a las {{hora}} tienes tu videollamada con {{closer}}.\n\n🔗 Enlace: {{url}}\n\nSi no puedes, responde y buscamos otro momento.\n\nUn saludo,\nMadrigal Marketing`,
    },
    recurso_valor: {
      asunto: `Para que le saques más jugo a la llamada del {{fecha}}`,
      cuerpo: `Hola {{nombre}},\n\nEl {{fecha}} a las {{hora}} tienes tu videollamada con {{closer}}.\n\nPara que la aproveches al máximo, te recomiendo pensar en estas 3 preguntas:\n\n1. Cuántas bodas quieres conseguir esta temporada?\n2. Cuánto inviertes ahora en captación?\n3. Qué canal te funciona mejor y cuál peor?\n\nAsí {{closer}} puede prepararte un análisis personalizado.\n\nNos vemos el {{fecha}}!\n\nMadrigal Marketing`,
    },
    noshow_24h: {
      asunto: `{{nombre}}, buscamos otro momento?`,
      cuerpo: `Hola {{nombre}},\n\nVimos que no pudiste venir a la videollamada con {{closer}}. No pasa nada!\n\nSi te sigue interesando, responde a este email y te buscamos otro hueco esta semana.\n\nUn saludo,\nMadrigal Marketing`,
    },
  }

  let sent = false
  let error: string | undefined

  // === SEND WHATSAPP ===
  if (canal.includes('whatsapp') && leadPhone) {
    const template = waMessages[paso]
    if (template) {
      const text = replaceVars(template, vars)
      const waToken = await resolveWaToken(supabase)

      if (waToken) {
        // Get WhatsApp phone_id from the noshow config or use a default
        // For now, use the same phone as Rosalía's agent
        const { data: agente } = await supabase
          .from('ia_agentes')
          .select('whatsapp_phone_id')
          .eq('activo', true)
          .limit(1)
          .maybeSingle()

        const phoneId = agente?.whatsapp_phone_id
        if (phoneId) {
          const toNum = leadPhone.replace(/\+/g, '')
          const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: toNum,
              type: 'text',
              text: { body: text },
            }),
          })
          const data = await res.json()

          if (res.ok && data.messages?.[0]?.id) {
            await supabase
              .from('ventas_cita_confirmaciones')
              .update({
                estado: 'enviado',
                enviado_at: new Date().toISOString(),
                wa_message_id: data.messages[0].id,
              })
              .eq('id', confId)
            sent = true
          } else {
            error = data.error?.message || 'WhatsApp send failed'
          }
        } else {
          error = 'No WhatsApp phone_id configured'
        }
      } else {
        error = 'No WA token available'
      }
    }
  }

  // === SEND EMAIL ===
  if (canal.includes('email') && leadEmail) {
    const emailTpl = emailMessages[paso]
    if (emailTpl) {
      const asunto = replaceVars(emailTpl.asunto, vars)
      const cuerpo = replaceVars(emailTpl.cuerpo, vars)

      try {
        const resendKey = Deno.env.get('RESEND_API_KEY') || ''
        if (resendKey) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              from: 'Madrigal Marketing <confirmaciones@madrigalmarketing.es>',
              to: [leadEmail],
              subject: asunto,
              text: cuerpo,
            }),
          })
          const data = await res.json()

          if (res.ok && data.id) {
            if (!sent) {
              await supabase
                .from('ventas_cita_confirmaciones')
                .update({
                  estado: 'enviado',
                  enviado_at: new Date().toISOString(),
                  email_resend_id: data.id,
                })
                .eq('id', confId)
              sent = true
            } else {
              // WA already sent, just update email ID
              await supabase
                .from('ventas_cita_confirmaciones')
                .update({ email_resend_id: data.id })
                .eq('id', confId)
            }
          } else {
            if (!error) error = data.message || 'Email send failed'
          }
        }
      } catch (emailErr) {
        if (!error) error = `Email error: ${emailErr}`
      }
    }
  }

  // === FALLBACK: mark as sent even if only partial ===
  if (!sent && !error) {
    // No channel could send (no phone, no email, no template)
    await markAs(supabase, confId, 'saltado', 'No channel available')
    return { status: 'skipped', error: 'no_channel' }
  }

  if (!sent && error) {
    await markAs(supabase, confId, 'enviado', error)
    return { status: 'error', error }
  }

  return { status: 'sent' }
}

async function markAs(
  supabase: ReturnType<typeof createClient>,
  confId: string,
  estado: string,
  error?: string,
) {
  await supabase
    .from('ventas_cita_confirmaciones')
    .update({
      estado,
      enviado_at: new Date().toISOString(),
      error: error || null,
    })
    .eq('id', confId)
}
