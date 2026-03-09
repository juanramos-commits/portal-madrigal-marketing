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
          total_sent: 0,
          total_delivered: 0,
          total_opened: 0,
          total_clicked: 0,
          total_bounced: 0,
          total_failed: 0,
          total_complained: 0,
        })
      }
      const stats = campaignStats.get(cid)!
      stats.total_sent++
      const status = send.status as string
      if (status === 'delivered') stats.total_delivered++
      else if (status === 'opened') { stats.total_delivered++; stats.total_opened++ }
      else if (status === 'clicked') { stats.total_delivered++; stats.total_opened++; stats.total_clicked++ }
      else if (status === 'bounced') stats.total_bounced++
      else if (status === 'failed') stats.total_failed++
      else if (status === 'complained') { stats.total_delivered++; stats.total_complained++ }
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
      total_sent: number
      total_delivered: number
      total_bounced: number
      total_complained: number
      total_opened: number
    }>()

    for (const send of (sendsWithContact || [])) {
      const contact = send.contact as Record<string, unknown> | null
      const provider = (contact?.provider as string) || 'unknown'
      if (!providerStats.has(provider)) {
        providerStats.set(provider, {
          total_sent: 0,
          total_delivered: 0,
          total_bounced: 0,
          total_complained: 0,
          total_opened: 0,
        })
      }
      const stats = providerStats.get(provider)!
      stats.total_sent++
      const status = send.status as string
      if (['delivered', 'opened', 'clicked'].includes(status)) stats.total_delivered++
      if (['opened', 'clicked'].includes(status)) stats.total_opened++
      if (status === 'bounced') stats.total_bounced++
      if (status === 'complained') stats.total_complained++
    }

    let providersRolled = 0
    for (const [provider, stats] of providerStats) {
      // Calculate health_status
      const bounceRate = stats.total_sent > 0 ? stats.total_bounced / stats.total_sent : 0
      const complaintRate = stats.total_sent > 0 ? stats.total_complained / stats.total_sent : 0

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
