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
    // === 0. Check kill switch ===
    const { data: activeConfig } = await supabase
      .from('ia_config')
      .select('value')
      .eq('key', 'noshow_active')
      .maybeSingle()

    if (!activeConfig || activeConfig.value !== 'true') {
      return jsonRes({ status: 'ok', processed: 0, reason: 'system_disabled' })
    }

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

  // === WHATSAPP TEMPLATES (approved in Meta) ===
  // Maps paso → { template_name, params: ordered array of variable values }
  const waTemplates: Record<string, { template: string; params: string[] } | null> = {
    confirmacion: { template: 'confirmacion_cita_utility', params: [vars.nombre, vars.closer, vars.fecha, vars.hora] },
    micro_compromiso: { template: 'micro_compromiso_utility', params: [vars.closer] },
    prueba_social: { template: 'prueba_social_utility3', params: [vars.fecha] },
    video_closer: { template: 'video_director_utility', params: [vars.fecha] },
    d1_escasez: { template: 'recordatorio_d1_utility', params: [vars.nombre, vars.hora, vars.closer] },
    d0_2h: { template: 'recordatorio_2h_utility3', params: [vars.url] },
    d0_15m: { template: 'recordatorio_15m_utility3', params: [vars.url] },
    noshow_5m: { template: 'noshow_5m_utility', params: [vars.nombre, vars.closer] },
    noshow_30m: { template: 'noshow_reagendar_utility', params: [vars.nombre] },
    noshow_24h: { template: 'noshow_reagendar_utility', params: [vars.nombre] },
    post_asistencia: { template: 'post_asistencia_utility', params: [vars.closer] },
  }

  // Fallback text messages (used if template not available or inside 24h window)
  const waMessages: Record<string, string> = {
    confirmacion: `Hola ${vars.nombre}! Tu videollamada con ${vars.closer} queda confirmada para el ${vars.fecha} a las ${vars.hora}. Te envio los detalles por email!`,
    micro_compromiso: `Para que ${vars.closer} pueda preparar tu caso, me dices cuantas bodas hiciste el año pasado?`,
    prueba_social: `Mira lo que consiguen profesionales como tu con nuestro sistema de captacion. Te lo cuento todo en tu llamada del ${vars.fecha}, nos vemos!`,
    video_closer: `El director de Madrigal te ha dejado un mensaje para tu llamada del ${vars.fecha}. Esta preparando tu caso!`,
    d1_escasez: `Hola ${vars.nombre}! Mañana a las ${vars.hora} tienes la videollamada con ${vars.closer}. Tu hueco es uno de los ultimos de esta semana. Todo bien para esa hora?`,
    d0_2h: `En 2 horas tienes tu videollamada con nuestro equipo! Estamos preparando tu caso. Conectate aqui: ${vars.url}`,
    d0_15m: `Tu videollamada empieza en 15 minutos! Nuestro equipo te espera. Conectate aqui: ${vars.url}`,
    noshow_5m: `Hola ${vars.nombre}, ${vars.closer} esta en la llamada esperandote. Todo bien?`,
    noshow_30m: `No te preocupes ${vars.nombre}! Elige otro momento que te venga mejor y lo cuadramos. Responde a este mensaje y te buscamos hueco`,
    noshow_24h: `Oye ${vars.nombre}, que no pudiste venir no pasa nada. Si te sigue interesando, dime y te busco otro hueco esta semana`,
    post_asistencia: `Que tal ha ido la llamada con ${vars.closer}? Todo claro?`,
  }

  // === EMAIL SUBJECTS & BODIES ===
  const emailMessages: Record<string, { asunto: string; cuerpo: string }> = {
    confirmacion: {
      asunto: `Tu videollamada con {{closer}} — {{fecha}} a las {{hora}}`,
      cuerpo: `Hola {{nombre}},\n\nTu videollamada está confirmada:\n\n📅 {{fecha}} a las {{hora}}\n👤 Con {{closer}}\n🔗 Enlace: {{url}}\n\n🔗 Página de tu reunión: https://app.madrigalmarketing.es/reunion/{{token}}\n\nSi necesitas cambiar la hora, responde a este email.\n\nUn saludo,\nMadrigal Marketing`,
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
    const waToken = await resolveWaToken(supabase)
    if (!waToken) { error = 'No WA token available'; }
    else {
      const { data: phoneConfig } = await supabase
        .from('ia_config').select('value').eq('key', 'noshow_whatsapp_phone_id').maybeSingle()
      const phoneId = phoneConfig?.value && phoneConfig.value !== 'PENDING' ? phoneConfig.value : null

      if (!phoneId) { error = 'No WhatsApp phone_id configured'; }
      else {
        const toNum = leadPhone.replace(/\+/g, '')
        const tplConfig = waTemplates[paso]
        let waBody: Record<string, unknown>

        if (tplConfig) {
          // Use approved template (works outside 24h window)
          const components: Array<Record<string, unknown>> = []
          if (tplConfig.params.length > 0) {
            components.push({
              type: 'body',
              parameters: tplConfig.params.map(p => ({ type: 'text', text: p || '' })),
            })
          }
          waBody = {
            messaging_product: 'whatsapp',
            to: toNum,
            type: 'template',
            template: {
              name: tplConfig.template,
              language: { code: 'es_ES' },
              ...(components.length > 0 ? { components } : {}),
            },
          }
        } else {
          // Fallback: plain text (only works inside 24h window)
          waBody = {
            messaging_product: 'whatsapp',
            to: toNum,
            type: 'text',
            text: { body: waMessages[paso] || `Recordatorio de tu videollamada con ${vars.closer}` },
          }
        }

        try {
          const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify(waBody),
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
        } catch (fetchErr) {
          error = `WA fetch error: ${fetchErr}`
        }
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
          // Build email body — HTML for confirmacion, plain text for rest
          const emailBody: Record<string, unknown> = {
            from: 'Madrigal Marketing <confirmaciones@madrigalmarketing.es>',
            to: [leadEmail],
            subject: asunto,
          }

          if (paso === 'confirmacion') {
            // HTML email with ICS attachment for confirmation
            const citaDateObj = new Date(cita.fecha_hora as string)
            const endDate = new Date(citaDateObj.getTime() + ((cita.duracion_minutos as number) || 45) * 60000)
            const fmtICS = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

            const icsContent = [
              'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Madrigal Marketing//NoShow//ES',
              'BEGIN:VEVENT',
              `DTSTART:${fmtICS(citaDateObj)}`,
              `DTEND:${fmtICS(endDate)}`,
              `SUMMARY:Videollamada con ${vars.closer} - Madrigal Marketing`,
              `DESCRIPTION:Enlace: ${vars.url}\\nPágina: https://app.madrigalmarketing.es/reunion/${vars.token}`,
              `URL:${vars.url}`,
              'STATUS:CONFIRMED',
              `UID:${(cita as Record<string,unknown>).id}@madrigalmarketing.es`,
              'END:VEVENT', 'END:VCALENDAR',
            ].join('\r\n')

            emailBody.html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#333;">
  <div style="text-align:center;padding:20px 0;border-bottom:1px solid #eee;">
    <span style="font-size:14px;letter-spacing:0.2em;color:#999;font-weight:700;">MADRIGAL</span>
  </div>
  <div style="padding:30px 20px;">
    <h1 style="font-size:20px;margin:0 0 20px;color:#111;">Tu videollamada está confirmada</h1>
    <div style="background:#f8f9fa;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <div style="margin-bottom:8px;">📅 <strong>${vars.fecha}</strong> a las <strong>${vars.hora}</strong></div>
      <div style="margin-bottom:8px;">👤 Con <strong>${vars.closer}</strong></div>
      <div>⏱️ ${(cita.duracion_minutos as number) || 45} minutos</div>
    </div>
    <div style="margin-bottom:20px;">
      <a href="https://app.madrigalmarketing.es/reunion/${vars.token}" style="display:block;text-align:center;padding:14px;background:#10B981;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:10px;">Ver detalles de tu reunión</a>
      ${vars.url ? `<a href="${vars.url}" style="display:block;text-align:center;padding:12px;border:1px solid #ddd;border-radius:8px;text-decoration:none;color:#333;font-weight:600;font-size:14px;">Enlace videollamada</a>` : ''}
    </div>
    <p style="font-size:13px;color:#666;">Si necesitas cambiar la hora, responde a este email.</p>
  </div>
  <div style="text-align:center;padding:16px;border-top:1px solid #eee;font-size:11px;color:#999;">
    Madrigal Marketing · Captación para el sector bodas
  </div>
</div>`
            emailBody.attachments = [{
              filename: 'reunion-madrigal.ics',
              content: btoa(icsContent),
              content_type: 'text/calendar',
            }]
          } else {
            emailBody.text = cuerpo
          }

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify(emailBody),
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
