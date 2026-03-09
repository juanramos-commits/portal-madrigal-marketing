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
    const today = new Date().toISOString().split('T')[0]

    // ── Daily campaign analytics ─────────────────────────────────────
    // Find campaigns that had sends today
    const { data: todaySends, error: sendsErr } = await supabase
      .from('ventas_em_sends')
      .select('campaign_id, status')
      .gte('sent_at', `${today}T00:00:00Z`)
      .lte('sent_at', `${today}T23:59:59Z`)

    if (sendsErr) {
      return jsonResponse({ error: 'Failed to fetch sends', detail: sendsErr.message }, 500)
    }

    // Aggregate by campaign_id and status
    const campaignStats = new Map<string, Record<string, number>>()
    for (const send of (todaySends || [])) {
      const cid = send.campaign_id as string
      if (!cid) continue
      if (!campaignStats.has(cid)) {
        campaignStats.set(cid, {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          complained: 0,
          unsubscribed: 0,
          converted: 0,
        })
      }
      const stats = campaignStats.get(cid)!
      stats.sent++
      const status = send.status as string
      if (status === 'delivered') stats.delivered++
      else if (status === 'opened') { stats.delivered++; stats.opened++ }
      else if (status === 'clicked') { stats.delivered++; stats.opened++; stats.clicked++ }
      else if (status === 'bounced') stats.bounced++
      else if (status === 'complained') { stats.delivered++; stats.complained++ }
    }

    let campaignsRolled = 0
    for (const [campaignId, stats] of campaignStats) {
      await supabase
        .from('ventas_em_analytics_daily')
        .upsert(
          {
            campaign_id: campaignId,
            date: today,
            ...stats,
          },
          { onConflict: 'campaign_id,date' },
        )
      campaignsRolled++
    }

    // ── Reputation metrics by provider ───────────────────────────────
    // Get all sends from today with contact provider info
    const { data: sendsWithContact } = await supabase
      .from('ventas_em_sends')
      .select('status, contact:ventas_em_contacts(provider)')
      .gte('sent_at', `${today}T00:00:00Z`)
      .lte('sent_at', `${today}T23:59:59Z`)

    const providerStats = new Map<string, {
      sent: number
      delivered: number
      bounced: number
      complained: number
      opened: number
    }>()

    for (const send of (sendsWithContact || [])) {
      const contact = send.contact as Record<string, unknown> | null
      const provider = (contact?.provider as string) || 'unknown'
      if (!providerStats.has(provider)) {
        providerStats.set(provider, {
          sent: 0,
          delivered: 0,
          bounced: 0,
          complained: 0,
          opened: 0,
        })
      }
      const stats = providerStats.get(provider)!
      stats.sent++
      const status = send.status as string
      if (['delivered', 'opened', 'clicked'].includes(status)) stats.delivered++
      if (['opened', 'clicked'].includes(status)) stats.opened++
      if (status === 'bounced') stats.bounced++
      if (status === 'complained') stats.complained++
    }

    let providersRolled = 0
    for (const [provider, stats] of providerStats) {
      // Calculate health_status
      const bounceRate = stats.sent > 0 ? stats.bounced / stats.sent : 0
      const complaintRate = stats.sent > 0 ? stats.complained / stats.sent : 0

      let healthStatus = 'good'
      if (bounceRate >= 0.05 || complaintRate >= 0.001) {
        healthStatus = 'critical'
      } else if (bounceRate >= 0.02 || complaintRate >= 0.0005) {
        healthStatus = 'warning'
      }

      await supabase
        .from('ventas_em_reputation_log')
        .upsert(
          {
            date: today,
            provider,
            ...stats,
            health_status: healthStatus,
          },
          { onConflict: 'date,provider' },
        )
      providersRolled++
    }

    return jsonResponse({
      success: true,
      date: today,
      campaigns_rolled: campaignsRolled,
      providers_rolled: providersRolled,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
