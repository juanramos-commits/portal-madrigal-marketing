import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * ia-rgpd-borrar
 *
 * Implements GDPR right-to-erasure for a lead.
 * Deletes all messages, notes, objeciones; anonymizes lead data;
 * deactivates conversations; keeps minimal audit log.
 *
 * POST body:
 *   lead_id: UUID del lead (required)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-supabase-api-version',
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

  const leadId = params.lead_id as string
  if (!leadId) {
    return jsonResponse({ error: 'lead_id is required' }, 400)
  }

  try {
    // === 1. Verify lead exists ===
    const { data: lead, error: leadErr } = await supabase
      .from('ia_leads')
      .select('id, telefono')
      .eq('id', leadId)
      .single()

    if (leadErr || !lead) {
      return jsonResponse({ error: 'Lead not found' }, 404)
    }

    // === 2. Get all conversations for this lead ===
    const { data: conversaciones, error: convosErr } = await supabase
      .from('ia_conversaciones')
      .select('id, agente_id')
      .eq('lead_id', leadId)

    if (convosErr) {
      console.error('Error fetching conversations:', convosErr)
      return jsonResponse({ error: 'Failed to fetch conversations', details: convosErr.message }, 500)
    }

    const convoIds = (conversaciones || []).map(c => c.id)
    const agenteId = conversaciones?.[0]?.agente_id || null

    let deletedMessages = 0
    let deletedNotes = 0
    let deletedObjeciones = 0

    if (convoIds.length > 0) {
      // === 3. Delete all messages from ia_mensajes ===
      const { count: msgCount, error: msgErr } = await supabase
        .from('ia_mensajes')
        .delete({ count: 'exact' })
        .in('conversacion_id', convoIds)

      if (msgErr) {
        console.error('Error deleting messages:', msgErr)
        return jsonResponse({ error: 'Failed to delete messages', details: msgErr.message }, 500)
      }
      deletedMessages = msgCount || 0

      // === 4. Delete all notes from ia_notas ===
      const { count: notesCount, error: notesErr } = await supabase
        .from('ia_notas')
        .delete({ count: 'exact' })
        .in('conversacion_id', convoIds)

      if (notesErr) {
        console.error('Error deleting notes:', notesErr)
        return jsonResponse({ error: 'Failed to delete notes', details: notesErr.message }, 500)
      }
      deletedNotes = notesCount || 0

      // === 5. Delete all objeciones from ia_objeciones ===
      const { count: objCount, error: objErr } = await supabase
        .from('ia_objeciones')
        .delete({ count: 'exact' })
        .in('conversacion_id', convoIds)

      if (objErr) {
        console.error('Error deleting objeciones:', objErr)
        return jsonResponse({ error: 'Failed to delete objeciones', details: objErr.message }, 500)
      }
      deletedObjeciones = objCount || 0

      // === 6. Anonymize conversations ===
      const { error: convoUpdateErr } = await supabase
        .from('ia_conversaciones')
        .update({
          chatbot_activo: false,
          resumen: null,
          metadata: null,
        })
        .in('id', convoIds)

      if (convoUpdateErr) {
        console.error('Error updating conversations:', convoUpdateErr)
        return jsonResponse({ error: 'Failed to update conversations', details: convoUpdateErr.message }, 500)
      }
    }

    // === 7. Anonymize lead data ===
    const { error: leadUpdateErr } = await supabase
      .from('ia_leads')
      .update({
        datos_borrados: true,
        nombre: null,
        email: null,
        telefono: '[BORRADO]',
        servicio: null,
        metadata: null,
      })
      .eq('id', leadId)

    if (leadUpdateErr) {
      console.error('Error updating lead:', leadUpdateErr)
      return jsonResponse({ error: 'Failed to anonymize lead', details: leadUpdateErr.message }, 500)
    }

    // === 8. Log RGPD deletion (minimal audit record) ===
    await supabase.from('ia_logs').insert({
      agente_id: agenteId,
      tipo: 'info',
      mensaje: `RGPD: datos borrados para lead ${leadId}. Mensajes: ${deletedMessages}, Notas: ${deletedNotes}, Objeciones: ${deletedObjeciones}, Conversaciones: ${convoIds.length}`,
    })

    return jsonResponse({
      status: 'ok',
      deleted_messages: deletedMessages,
      deleted_notes: deletedNotes,
      deleted_objeciones: deletedObjeciones,
      conversations_affected: convoIds.length,
    })
  } catch (err) {
    console.error('Fatal error in ia-rgpd-borrar:', err)

    try { await supabase.from('ia_logs').insert({
      tipo: 'error',
      mensaje: `Error en ia-rgpd-borrar para lead ${leadId}: ${String(err)}`,
      detalles: { error: String(err), stack: String(err) },
    }) } catch (_e) { /* ignore */ }

    return jsonResponse({ error: 'Internal error', details: String(err) }, 500)
  }
})
