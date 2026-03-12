import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ia-crm-sync
 *
 * Syncs AI agent actions to the CRM pipeline.
 * Handles stage transitions, activity logging, and resumen updates.
 *
 * POST body:
 *   conversacion_id: UUID (required)
 *   action: 'etapa_contactado' | 'etapa_agendado' | 'etapa_ghosting' | 'etapa_lost' | 'update_resumen' (required)
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

const VALID_ACTIONS = [
  'etapa_contactado',
  'etapa_agendado',
  'etapa_ghosting',
  'etapa_lost',
  'update_resumen',
] as const

type CrmAction = typeof VALID_ACTIONS[number]

const ETAPA_MAP: Record<string, string> = {
  etapa_contactado: 'Contactado',
  etapa_agendado: 'Agendado',
  etapa_ghosting: 'Ghosting',
  etapa_lost: 'Lost',
}

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

  let params: Record<string, unknown>
  try {
    params = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const conversacionId = params.conversacion_id as string
  const action = params.action as CrmAction

  if (!conversacionId || !action) {
    return jsonResponse({ error: 'conversacion_id and action are required' }, 400)
  }

  if (!VALID_ACTIONS.includes(action)) {
    return jsonResponse({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, 400)
  }

  try {
    // === 1. Load conversation ===
    const { data: convo, error: convoErr } = await supabase
      .from('ia_conversaciones')
      .select('id, agente_id, lead_id, resumen, metadata')
      .eq('id', conversacionId)
      .single()

    if (convoErr || !convo) {
      return jsonResponse({ error: 'Conversation not found' }, 404)
    }

    // === 2. Load agent ===
    const { data: agente, error: agenteErr } = await supabase
      .from('ia_agentes')
      .select('id, nombre, usuario_id')
      .eq('id', convo.agente_id)
      .single()

    if (agenteErr || !agente) {
      return jsonResponse({ error: 'Agent not found' }, 404)
    }

    // === 3. Load lead ===
    const { data: lead, error: leadErr } = await supabase
      .from('ia_leads')
      .select('id, crm_lead_id, nombre, telefono')
      .eq('id', convo.lead_id)
      .single()

    if (leadErr || !lead) {
      return jsonResponse({ error: 'Lead not found' }, 404)
    }

    // === 4. Check prerequisites for CRM sync ===
    if (!agente.usuario_id) {
      await supabase.from('ia_logs').insert({
        agente_id: agente.id,
        conversacion_id: conversacionId,
        tipo: 'info',
        mensaje: `CRM sync skipped: agente "${agente.nombre}" sin usuario_id`,
      })
      return jsonResponse({ status: 'ok', synced: false, reason: 'agent_has_no_usuario_id' })
    }

    if (!lead.crm_lead_id) {
      await supabase.from('ia_logs').insert({
        agente_id: agente.id,
        conversacion_id: conversacionId,
        tipo: 'info',
        mensaje: `CRM sync skipped: lead "${lead.nombre || lead.id}" sin crm_lead_id`,
      })
      return jsonResponse({ status: 'ok', synced: false, reason: 'lead_has_no_crm_lead_id' })
    }

    const crmLeadId = lead.crm_lead_id

    // === 5. Handle action ===
    if (action === 'update_resumen') {
      // Update ventas_leads.resumen_setter with conversation resumen
      const { error: updateErr } = await supabase
        .from('ventas_leads')
        .update({ resumen_setter: convo.resumen || '' })
        .eq('id', crmLeadId)

      if (updateErr) {
        console.error('Error updating resumen:', updateErr)
        return jsonResponse({ error: 'Failed to update resumen', details: updateErr.message }, 500)
      }

      await supabase.from('ia_logs').insert({
        agente_id: agente.id,
        conversacion_id: conversacionId,
        tipo: 'info',
        mensaje: `CRM sync: resumen actualizado para lead CRM ${crmLeadId}`,
      })

      return jsonResponse({ status: 'ok', synced: true, action: 'update_resumen' })
    }

    // Pipeline stage actions
    const etapaNombre = ETAPA_MAP[action]

    // === 6. Find the target etapa in the pipeline ===
    // First get the pipeline for this lead
    const { data: ventasLead } = await supabase
      .from('ventas_leads')
      .select('pipeline_id')
      .eq('id', crmLeadId)
      .single()

    if (!ventasLead?.pipeline_id) {
      return jsonResponse({ error: 'Lead has no pipeline assigned' }, 400)
    }

    const { data: etapa, error: etapaErr } = await supabase
      .from('ventas_lead_pipeline')
      .select('id, nombre')
      .eq('pipeline_id', ventasLead.pipeline_id)
      .eq('nombre', etapaNombre)
      .maybeSingle()

    if (etapaErr) {
      console.error('Error fetching etapa:', etapaErr)
      return jsonResponse({ error: 'Failed to find pipeline stage', details: etapaErr.message }, 500)
    }

    if (!etapa) {
      return jsonResponse({ error: `Pipeline stage "${etapaNombre}" not found` }, 404)
    }

    // === 7. Handle ghosting special logic ===
    if (action === 'etapa_ghosting') {
      // Increment contador_intentos
      const { data: currentLead } = await supabase
        .from('ventas_leads')
        .select('contador_intentos, max_intentos')
        .eq('id', crmLeadId)
        .single()

      const intentos = (currentLead?.contador_intentos || 0) + 1
      const maxIntentos = currentLead?.max_intentos || 3

      const updates: Record<string, unknown> = {
        contador_intentos: intentos,
      }

      // Only move to Ghosting if max attempts reached
      if (intentos >= maxIntentos) {
        updates.etapa_actual_id = etapa.id

        // Upsert pipeline estado
        await supabase
          .from('ventas_lead_pipeline_estado')
          .upsert(
            {
              lead_id: crmLeadId,
              etapa_id: etapa.id,
              entered_at: new Date().toISOString(),
            },
            { onConflict: 'lead_id,etapa_id' },
          )
      }

      await supabase
        .from('ventas_leads')
        .update(updates)
        .eq('id', crmLeadId)

      // Log activity
      await supabase.from('ventas_actividad').insert({
        lead_id: crmLeadId,
        usuario_id: agente.usuario_id,
        tipo: 'nota',
        descripcion: intentos >= maxIntentos
          ? `IA: Lead movido a Ghosting (${intentos}/${maxIntentos} intentos)`
          : `IA: Intento de contacto ${intentos}/${maxIntentos}`,
      })

      await supabase.from('ia_logs').insert({
        agente_id: agente.id,
        conversacion_id: conversacionId,
        tipo: 'info',
        mensaje: `CRM sync: ghosting intento ${intentos}/${maxIntentos}${intentos >= maxIntentos ? ' → movido a Ghosting' : ''}`,
      })

      return jsonResponse({
        status: 'ok',
        synced: true,
        action,
        intentos,
        max_intentos: maxIntentos,
        moved: intentos >= maxIntentos,
      })
    }

    // === 8. Standard pipeline move (contactado, agendado, lost) ===
    // Update etapa_actual_id on ventas_leads
    const { error: moveErr } = await supabase
      .from('ventas_leads')
      .update({ etapa_actual_id: etapa.id })
      .eq('id', crmLeadId)

    if (moveErr) {
      console.error('Error moving lead in pipeline:', moveErr)
      return jsonResponse({ error: 'Failed to move lead in pipeline', details: moveErr.message }, 500)
    }

    // Upsert pipeline estado
    await supabase
      .from('ventas_lead_pipeline_estado')
      .upsert(
        {
          lead_id: crmLeadId,
          etapa_id: etapa.id,
          entered_at: new Date().toISOString(),
        },
        { onConflict: 'lead_id,etapa_id' },
      )

    // Log activity in ventas_actividad
    const activityDescriptions: Record<string, string> = {
      etapa_contactado: `IA: Lead contactado por agente "${agente.nombre}"`,
      etapa_agendado: `IA: Cita agendada por agente "${agente.nombre}"`,
      etapa_lost: `IA: Lead perdido - gestionado por agente "${agente.nombre}"`,
    }

    await supabase.from('ventas_actividad').insert({
      lead_id: crmLeadId,
      usuario_id: agente.usuario_id,
      tipo: action === 'etapa_lost' ? 'nota' : 'llamada',
      descripcion: activityDescriptions[action] || `IA: ${action}`,
    })

    // Log in ia_logs
    await supabase.from('ia_logs').insert({
      agente_id: agente.id,
      conversacion_id: conversacionId,
      tipo: 'info',
      mensaje: `CRM sync: lead movido a "${etapaNombre}" (CRM lead: ${crmLeadId})`,
    })

    return jsonResponse({
      status: 'ok',
      synced: true,
      action,
      etapa: etapaNombre,
      etapa_id: etapa.id,
    })
  } catch (err) {
    console.error('Fatal error in ia-crm-sync:', err)

    await supabase.from('ia_logs').insert({
      conversacion_id: conversacionId,
      tipo: 'error',
      mensaje: `Error en ia-crm-sync (${action}): ${String(err)}`,
      detalles: { error: String(err), stack: (err as Error).stack },
    }).catch(() => {})

    return jsonResponse({ error: 'Internal error', details: String(err) }, 500)
  }
})
