import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function detectProvider(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail'
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.es'].includes(domain)) return 'outlook'
  if (['yahoo.com', 'yahoo.es', 'ymail.com'].includes(domain)) return 'yahoo'
  return 'other'
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

  try {
    // Get existing contact lead_ids to filter
    const { data: existingContacts } = await supabase
      .from('ventas_em_contacts')
      .select('lead_id')
      .not('lead_id', 'is', null)

    const existingLeadIds = new Set(
      (existingContacts || []).map((c: { lead_id: string }) => c.lead_id)
    )

    // Fetch all leads with email
    const { data: leads, error: leadsErr } = await supabase
      .from('ventas_leads')
      .select('id, email, nombre, nombre_negocio')
      .not('email', 'is', null)

    if (leadsErr) {
      return jsonResponse({ error: 'Failed to fetch leads', detail: leadsErr.message }, 500)
    }

    let synced = 0
    let skipped = 0

    for (const lead of (leads || [])) {
      if (!lead.email || existingLeadIds.has(lead.id)) {
        skipped++
        continue
      }

      const email = (lead.email as string).trim().toLowerCase()
      if (!email) {
        skipped++
        continue
      }

      const provider = detectProvider(email)

      const { error: insertErr } = await supabase
        .from('ventas_em_contacts')
        .insert({
          lead_id: lead.id,
          email,
          nombre: lead.nombre || null,
          empresa: lead.nombre_negocio || null,
          provider,
          status: 'active',
        })

      if (insertErr) {
        // Likely duplicate email — skip
        skipped++
        continue
      }

      synced++
    }

    return jsonResponse({ success: true, synced, skipped })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
