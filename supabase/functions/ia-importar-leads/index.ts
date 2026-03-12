import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-importar-leads
 *
 * Importa un lote de leads para un agente IA.
 * Crea leads, conversaciones, y envia primer mensaje via plantilla.
 *
 * POST body:
 *   agente_id: UUID del agente (required)
 *   leads: Array de { telefono, nombre?, email?, servicio? } (required, max 200)
 *
 * Para cada lead:
 *   1. Normaliza telefono (E.164)
 *   2. Comprueba blacklist
 *   3. Comprueba conversacion activa existente
 *   4. Upsert en ia_leads
 *   5. Crea ia_conversaciones
 *   6. Envia primer mensaje via ia-whatsapp-send (con delay entre envios)
 *   7. Respeta rate_limit_nuevos_dia
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Normalize phone: strip spaces, ensure + prefix, basic E.164 validation */
function normalizePhone(raw: string): { ok: boolean; phone: string; error?: string } {
  let phone = raw.replace(/[\s\-\(\)]/g, '')
  if (!phone.startsWith('+')) {
    phone = '+' + phone
  }
  // Basic E.164 check: + followed by 7-15 digits
  if (!/^\+\d{7,15}$/.test(phone)) {
    return { ok: false, phone, error: `Invalid phone format: ${raw}` }
  }
  return { ok: true, phone }
}

interface LeadInput {
  telefono: string
  nombre?: string
  email?: string
  servicio?: string
}

interface LeadResult {
  telefono: string
  status: 'imported' | 'skipped' | 'error'
  reason?: string
  lead_id?: string
  conversacion_id?: string
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
  const leads = params.leads as LeadInput[] | undefined

  // === VALIDATE REQUIRED PARAMS ===
  if (!agenteId) {
    return jsonResponse({ error: 'agente_id is required' }, 400)
  }
  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return jsonResponse({ error: 'leads array is required and must not be empty' }, 400)
  }
  if (leads.length > 200) {
    return jsonResponse({ error: 'Maximum 200 leads per batch' }, 400)
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

    // === CHECK DAILY LIMIT BEFORE STARTING ===
    const today = new Date().toISOString().split('T')[0]
    const maxNuevos = agente.rate_limit_nuevos_dia || 50

    const { count: convosHoy } = await supabase
      .from('ia_conversaciones')
      .select('id', { count: 'exact', head: true })
      .eq('agente_id', agenteId)
      .gte('created_at', today + 'T00:00:00.000Z')

    let dailyCount = convosHoy || 0

    if (dailyCount >= maxNuevos) {
      await supabase.from('ia_logs').insert({
        agente_id: agenteId,
        tipo: 'warning',
        mensaje: `Importacion bloqueada: rate limit diario alcanzado ${dailyCount}/${maxNuevos}`,
      })
      return jsonResponse({ error: 'Daily new leads rate limit already reached', blocked: true }, 429)
    }

    // === LOAD BLACKLIST (batch) ===
    const allPhones = leads
      .map(l => {
        const n = normalizePhone(l.telefono)
        return n.ok ? n.phone : null
      })
      .filter(Boolean) as string[]

    const { data: blacklistEntries } = await supabase
      .from('ia_blacklist')
      .select('telefono')
      .in('telefono', allPhones)

    const blacklistSet = new Set((blacklistEntries || []).map(b => b.telefono))

    // === SELECT TEMPLATE BASED ON AGENT TYPE ===
    let templateName: string
    let templateParamsFn: (nombre: string | null) => Record<string, unknown>

    switch (agente.tipo) {
      case 'setter':
        templateName = 'primer_mensaje_formulario'
        templateParamsFn = (nombre) => ({ body: [nombre || 'amigo/a'] })
        break
      case 'repescadora':
        templateName = 'hola_he_visto_que_nos_has_v'
        templateParamsFn = () => ({})
        break
      case 'outbound_frio':
        templateName = 're_contacto_rosalia_1'
        templateParamsFn = () => ({})
        break
      default:
        templateName = 'primer_mensaje_formulario'
        templateParamsFn = (nombre) => ({ body: [nombre || 'amigo/a'] })
        break
    }

    // === PROCESS EACH LEAD ===
    const details: LeadResult[] = []
    let imported = 0
    let skipped = 0
    let errors = 0

    for (const leadInput of leads) {
      // Check daily limit during processing
      if (dailyCount >= maxNuevos) {
        details.push({
          telefono: leadInput.telefono,
          status: 'skipped',
          reason: `Daily rate limit reached (${maxNuevos})`,
        })
        skipped++
        continue
      }

      // Normalize phone
      const normalized = normalizePhone(leadInput.telefono)
      if (!normalized.ok) {
        details.push({
          telefono: leadInput.telefono,
          status: 'error',
          reason: normalized.error,
        })
        errors++
        continue
      }

      const telefono = normalized.phone
      const nombre = leadInput.nombre || null
      const email = leadInput.email || null
      const servicio = leadInput.servicio || null

      try {
        // Check blacklist
        if (blacklistSet.has(telefono)) {
          details.push({
            telefono,
            status: 'skipped',
            reason: 'blacklisted',
          })
          skipped++
          continue
        }

        // Check existing lead
        const { data: existingLead } = await supabase
          .from('ia_leads')
          .select('id')
          .eq('telefono', telefono)
          .maybeSingle()

        let leadId: string

        if (existingLead) {
          leadId = existingLead.id

          // Check active conversation for this agent
          const { data: existingConvo } = await supabase
            .from('ia_conversaciones')
            .select('id, estado')
            .eq('agente_id', agenteId)
            .eq('lead_id', leadId)
            .in('estado', ['needs_reply', 'waiting_reply', 'scheduled_followup'])
            .maybeSingle()

          if (existingConvo) {
            details.push({
              telefono,
              status: 'skipped',
              reason: 'active_conversation_exists',
              lead_id: leadId,
              conversacion_id: existingConvo.id,
            })
            skipped++
            continue
          }

          // Update lead info if provided
          if (nombre || email || servicio) {
            const updates: Record<string, unknown> = {}
            if (nombre) updates.nombre = nombre
            if (email) updates.email = email
            if (servicio) updates.servicio = servicio
            await supabase.from('ia_leads').update(updates).eq('id', leadId)
          }
        } else {
          // Create new lead
          const { data: newLead, error: leadErr } = await supabase
            .from('ia_leads')
            .insert({
              telefono,
              nombre,
              email,
              servicio,
              origen: 'importado',
              consentimiento: true,
              consentimiento_at: new Date().toISOString(),
            })
            .select('id')
            .single()

          if (leadErr || !newLead) {
            details.push({
              telefono,
              status: 'error',
              reason: `Failed to create lead: ${leadErr?.message}`,
            })
            errors++
            continue
          }

          leadId = newLead.id
        }

        // Assign A/B version
        let abVersion = 'A'
        if (agente.ab_test_activo) {
          const split = agente.ab_split || 50
          abVersion = Math.random() * 100 < split ? 'A' : 'B'
        }

        // Create conversation
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
          details.push({
            telefono,
            status: 'error',
            reason: `Failed to create conversation: ${convoErr?.message}`,
          })
          errors++
          continue
        }

        const conversacionId = convo.id

        // Send first message via ia-whatsapp-send
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
            template_params: templateParamsFn(nombre),
          }),
        })

        const sendResult = await sendRes.json()

        if (!sendRes.ok || sendResult.error) {
          await supabase.from('ia_logs').insert({
            agente_id: agenteId,
            conversacion_id: conversacionId,
            tipo: 'error',
            mensaje: `Error enviando primer mensaje importado a ${telefono}: ${sendResult.error || 'Unknown'}`,
            detalles: sendResult,
          })

          details.push({
            telefono,
            status: 'error',
            reason: `Failed to send first message: ${sendResult.error || 'Unknown'}`,
            lead_id: leadId,
            conversacion_id: conversacionId,
          })
          errors++
        } else {
          // Increment metrics
          await supabase.rpc('ia_increment_metricas', {
            p_agente_id: agenteId,
            p_fecha: today,
            p_ab_version: abVersion,
            p_leads_contactados: 1,
            p_mensajes_enviados: 1,
          })

          details.push({
            telefono,
            status: 'imported',
            lead_id: leadId,
            conversacion_id: conversacionId,
          })
          imported++
          dailyCount++
        }

        // Delay between sends to avoid rate limiting (1s + random jitter)
        await sleep(1000 + Math.random() * 500)
      } catch (leadErr) {
        details.push({
          telefono,
          status: 'error',
          reason: `Unexpected error: ${leadErr}`,
        })
        errors++
      }
    }

    // === LOG SUMMARY ===
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      tipo: 'info',
      mensaje: `Importacion completada: ${imported} importados, ${skipped} omitidos, ${errors} errores (de ${leads.length} total)`,
      detalles: {
        total: leads.length,
        imported,
        skipped,
        errors,
      },
    })

    return jsonResponse({
      status: 'ok',
      imported,
      skipped,
      errors,
      details,
    })
  } catch (err) {
    console.error('Error in ia-importar-leads:', err)

    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      tipo: 'error',
      mensaje: `Error en ia-importar-leads: ${err}`,
      detalles: { error: String(err), stack: (err as Error).stack },
    }).catch(() => {})

    return jsonResponse({ error: 'Internal error', details: String(err) }, 500)
  }
})
