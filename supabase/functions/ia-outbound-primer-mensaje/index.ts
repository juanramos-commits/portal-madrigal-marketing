import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-outbound-primer-mensaje
 *
 * Envia el primer mensaje a un nuevo lead asignado a un agente IA.
 * Llamado via POST desde el portal UI o desde el webhook de formulario.
 *
 * 1. Valida params y normaliza telefono
 * 2. Comprueba blacklist y rate limit diario de nuevos leads
 * 3. Busca o crea lead en ia_leads
 * 4. Busca o crea conversacion en ia_conversaciones
 * 5. Selecciona plantilla segun tipo de agente
 * 6. Envia via ia-whatsapp-send
 * 7. Registra logs y metricas
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const supabase = createClient(supabaseUrl, serviceKey)

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const agenteId = params.agente_id as string
  let telefono = params.telefono as string
  const nombre = (params.nombre as string) || null
  const email = (params.email as string) || null
  const servicio = (params.servicio as string) || null
  const origen = (params.origen as string) || 'formulario'

  // === VALIDATE REQUIRED PARAMS ===
  if (!agenteId || !telefono) {
    return jsonResponse({ error: 'agente_id and telefono are required' }, 400)
  }

  // === NORMALIZE PHONE ===
  telefono = telefono.replace(/[\s\-\(\)]/g, '')
  if (!telefono.startsWith('+')) {
    telefono = '+' + telefono
  }
  // Basic E.164 validation
  if (!/^\+\d{7,15}$/.test(telefono)) {
    return jsonResponse({ error: 'Invalid phone format' }, 400)
  }

  try {
    // === LOAD AGENT ===
    const { data: agente, error: agenteErr } = await supabase
      .from('ia_agentes')
      .select('id, tipo, activo, ab_test_activo, ab_split, rate_limit_nuevos_dia, whatsapp_phone_id')
      .eq('id', agenteId)
      .single()

    if (agenteErr || !agente) {
      return jsonResponse({ error: 'Agent not found' }, 404)
    }

    if (!agente.activo) {
      return jsonResponse({ error: 'Agent is inactive' }, 400)
    }

    if (!agente.whatsapp_phone_id) {
      return jsonResponse({ error: 'Agent has no WhatsApp phone configured' }, 400)
    }

    // === CHECK BLACKLIST ===
    const { data: blacklisted } = await supabase
      .from('ia_blacklist')
      .select('id')
      .eq('telefono', telefono)
      .maybeSingle()

    if (blacklisted) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        tipo: 'info',
        mensaje: `Primer mensaje bloqueado: ${telefono} esta en blacklist`,
      })
      return jsonResponse({ error: 'Phone is blacklisted', blocked: true }, 403)
    }

    // === RATE LIMIT: nuevos leads por dia ===
    const today = new Date().toISOString().split('T')[0]
    const maxNuevos = agente.rate_limit_nuevos_dia || 50

    const { count: convosHoy } = await supabase
      .from('ia_conversaciones')
      .select('id', { count: 'exact', head: true })
      .eq('agente_id', agenteId)
      .gte('created_at', today + 'T00:00:00.000Z')

    if ((convosHoy || 0) >= maxNuevos) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        tipo: 'warning',
        mensaje: `Rate limit diario de nuevos leads alcanzado: ${convosHoy}/${maxNuevos}`,
      })
      return jsonResponse({ error: 'Daily new leads rate limit reached', blocked: true }, 429)
    }

    // === CHECK EXISTING LEAD ===
    const { data: existingLead } = await supabase
      .from('ia_leads')
      .select('id')
      .eq('telefono', telefono)
      .maybeSingle()

    let leadId: string

    if (existingLead) {
      leadId = existingLead.id

      // Check if there is already an active conversation with this agent
      const { data: existingConvo } = await supabase
        .from('ia_conversaciones')
        .select('id, estado')
        .eq('agente_id', agenteId)
        .eq('lead_id', leadId)
        .in('estado', ['needs_reply', 'waiting_reply', 'scheduled_followup'])
        .maybeSingle()

      if (existingConvo) {
        // Active conversation exists → skip, return existing
        await supabase.from('ia_logs').insert({
          agente_id: agenteId,
          conversacion_id: existingConvo.id,
          tipo: 'info',
          mensaje: `Primer mensaje omitido: ya existe conversacion activa con ${telefono}`,
        })
        return jsonResponse({
          status: 'skipped',
          reason: 'active_conversation_exists',
          lead_id: leadId,
          conversacion_id: existingConvo.id,
        })
      }

      // Lead exists but no active conversation → update lead info if provided
      if (nombre || email || servicio) {
        const updates: Record<string, unknown> = {}
        if (nombre) updates.nombre = nombre
        if (email) updates.email = email
        if (servicio) updates.servicio = servicio
        await supabase.from('ia_leads').update(updates).eq('id', leadId)
      }
    } else {
      // === CREATE NEW LEAD ===
      const { data: newLead, error: leadErr } = await supabase
        .from('ia_leads')
        .insert({
          telefono,
          nombre,
          email,
          servicio,
          origen,
          consentimiento: true,
          consentimiento_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (leadErr || !newLead) {
        return jsonResponse({ error: 'Failed to create lead', details: leadErr?.message }, 500)
      }

      leadId = newLead.id
    }

    // === ASSIGN A/B VERSION ===
    let abVersion = 'A'
    if (agente.ab_test_activo) {
      const split = agente.ab_split || 50
      abVersion = Math.random() * 100 < split ? 'A' : 'B'
    }

    // === CREATE CONVERSATION ===
    const { data: convo, error: convoErr } = await supabase
      .from('ia_conversaciones')
      .insert({
        agente_id: agenteId,
        lead_id: leadId,
        estado: 'waiting_reply',
        step: 'first_message',
        chatbot_activo: true,
        first_message_sent_at: new Date().toISOString(),
        ab_version: abVersion,
        wa_window_expires_at: null,
      })
      .select('id')
      .single()

    if (convoErr || !convo) {
      return jsonResponse({ error: 'Failed to create conversation', details: convoErr?.message }, 500)
    }

    const conversacionId = convo.id

    // === SELECT TEMPLATE BASED ON AGENT TYPE ===
    let templateName: string
    let templateParams: Record<string, unknown> = {}

    switch (agente.tipo) {
      case 'setter':
        templateName = 'primer_mensaje_formulario'
        templateParams = { body: [nombre || 'amigo/a'] }
        break
      case 'repescadora':
        templateName = 'hola_he_visto_que_nos_has_v'
        break
      case 'outbound_frio':
        templateName = 're_contacto_rosalia_1'
        break
      default:
        templateName = 'primer_mensaje_formulario'
        templateParams = { body: [nombre || 'amigo/a'] }
        break
    }

    // === SEND VIA ia-whatsapp-send ===
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/ia-whatsapp-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        to: telefono,
        sender: 'bot',
        template_name: templateName,
        template_params: templateParams,
      }),
    })

    const sendResult = await sendRes.json()

    if (!sendRes.ok || sendResult.error) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        conversacion_id: conversacionId,
        tipo: 'error',
        mensaje: `Error enviando primer mensaje a ${telefono}: ${sendResult.error || 'Unknown'}`,
        detalles: sendResult,
      })
      return jsonResponse({
        error: 'Failed to send first message',
        details: sendResult.error || sendResult,
        lead_id: leadId,
        conversacion_id: conversacionId,
      }, 502)
    }

    // === LOG ===
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      conversacion_id: conversacionId,
      tipo: 'info',
      mensaje: `Primer mensaje enviado a ${telefono} (plantilla: ${templateName}, ab: ${abVersion})`,
      detalles: {
        template_name: templateName,
        template_params: templateParams,
        origen,
        ab_version: abVersion,
      },
    })

    // === INCREMENT METRICS ===
    await supabase.rpc('ia_increment_metricas', {
      p_agente_id: agenteId,
      p_fecha: today,
      p_ab_version: abVersion,
      p_leads_contactados: 1,
      p_mensajes_enviados: 1,
    })

    // === CRM SYNC — create ventas_leads + pipeline entry if agent has usuario_id ===
    if (agente.usuario_id) {
      try {
        // Find the "Por Contactar" or first etapa in the active pipeline
        const { data: pipeline } = await supabase
          .from('ventas_pipelines')
          .select('id')
          .eq('activo', true)
          .limit(1)
          .single()

        if (pipeline) {
          const { data: etapa } = await supabase
            .from('ventas_pipeline_etapas')
            .select('id')
            .eq('pipeline_id', pipeline.id)
            .order('orden', { ascending: true })
            .limit(1)
            .single()

          // Create CRM lead
          const { data: crmLead } = await supabase
            .from('ventas_leads')
            .insert({
              nombre: nombre || telefono,
              telefono,
              email: email || null,
              servicio_interesado: servicio || null,
              origen: origen === 'whatsapp' ? 'whatsapp' : 'referido',
              setter_asignado_id: agente.usuario_id,
              etapa_actual_id: etapa?.id || null,
            })
            .select('id')
            .single()

          if (crmLead && etapa) {
            // Create pipeline estado
            await supabase.from('ventas_lead_pipeline_estado').insert({
              lead_id: crmLead.id,
              pipeline_id: pipeline.id,
              etapa_id: etapa.id,
            })

            // Link ia_lead to CRM lead
            await supabase
              .from('ia_leads')
              .update({ crm_lead_id: crmLead.id })
              .eq('id', leadId)

            // Log activity
            await supabase.from('ventas_actividad').insert({
              lead_id: crmLead.id,
              usuario_id: agente.usuario_id,
              tipo: 'creacion',
              descripcion: `Lead creado por agente IA "${agente.nombre}" — primer contacto enviado`,
            })
          }
        }
      } catch (crmErr) {
        console.error('CRM sync error (non-fatal):', crmErr)
        await supabase.from('ia_logs').insert({
          agente_id: agenteId,
          conversacion_id: conversacionId,
          tipo: 'warning',
          mensaje: `CRM sync falló (no crítico): ${crmErr}`,
        }).catch(() => {})
      }
    }

    return jsonResponse({
      status: 'ok',
      lead_id: leadId,
      conversacion_id: conversacionId,
    })
  } catch (err) {
    console.error('Error in ia-outbound-primer-mensaje:', err)

    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      tipo: 'error',
      mensaje: `Error en ia-outbound-primer-mensaje: ${err}`,
      detalles: { error: String(err), stack: (err as Error).stack },
    }).catch(() => {})

    return jsonResponse({ error: 'Internal error', details: String(err) }, 500)
  }
})
