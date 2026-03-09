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
    // Get all active domains still in warmup
    const { data: domains, error: domErr } = await supabase
      .from('ventas_co_domains')
      .select('*')
      .eq('status', 'active')
      .eq('warmup_completed', false)

    if (domErr) {
      return jsonResponse({ error: 'Failed to fetch domains', detail: domErr.message }, 500)
    }

    if (!domains || domains.length === 0) {
      return jsonResponse({ processed: 0, message: 'No domains in warmup' })
    }

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const summary: Record<string, unknown>[] = []

    for (const domain of domains) {
      let warmupDay = (domain.warmup_day as number) || 0
      let healthScore = (domain.health_score as number) || 100
      let action = 'hold'

      // Get yesterday's reputation data
      const { data: repLog } = await supabase
        .from('ventas_co_reputation_log')
        .select('*')
        .eq('domain_id', domain.id)
        .eq('log_date', yesterday)
        .maybeSingle()

      const bounceRate = (repLog?.bounce_rate as number) || 0
      const complaintRate = (repLog?.complaint_rate as number) || 0

      // Evaluate warmup progression
      if (bounceRate > 5 || complaintRate > 0.1) {
        // Penalty: decrease warmup_day by 2, decrease health_score by 10
        warmupDay = Math.max(0, warmupDay - 2)
        healthScore = Math.max(0, healthScore - 10)
        action = 'penalty'
      } else if (bounceRate < 2 && complaintRate < 0.05) {
        // Normal progression: increment warmup_day by 1
        warmupDay = warmupDay + 1
        action = 'advance'
      }
      // Else: hold — warmup_day stays the same

      // Check if warmup is complete
      let warmupCompleted = domain.warmup_completed as boolean
      if (warmupDay >= 60) {
        warmupCompleted = true
      }

      // Get max_sends from warmup schedule for current day
      const { data: schedule } = await supabase
        .from('ventas_co_warmup_schedule')
        .select('max_sends')
        .eq('warmup_day', Math.min(warmupDay, 60))
        .maybeSingle()

      const dailyLimit = (schedule?.max_sends as number) || domain.daily_limit || 10

      // Update domain
      const { error: updateErr } = await supabase
        .from('ventas_co_domains')
        .update({
          warmup_day: warmupDay,
          warmup_completed: warmupCompleted,
          health_score: healthScore,
          daily_limit: dailyLimit,
          updated_at: new Date().toISOString(),
        })
        .eq('id', domain.id)

      if (updateErr) {
        summary.push({ domain: domain.domain, error: updateErr.message })
        continue
      }

      // Insert/update today's reputation log row
      await supabase
        .from('ventas_co_reputation_log')
        .upsert(
          {
            domain_id: domain.id,
            log_date: today,
            warmup_day: warmupDay,
            daily_limit: dailyLimit,
            health_score: healthScore,
          },
          { onConflict: 'domain_id,log_date' },
        )

      // Audit log
      await supabase
        .from('ventas_co_audit_log')
        .insert({
          action: 'warmup_progression',
          entity_type: 'domain',
          entity_id: domain.id,
          details: {
            domain: domain.domain,
            warmup_day: warmupDay,
            health_score: healthScore,
            daily_limit: dailyLimit,
            action,
            bounce_rate: bounceRate,
            complaint_rate: complaintRate,
            warmup_completed: warmupCompleted,
          },
          created_at: new Date().toISOString(),
        })

      summary.push({
        domain: domain.domain,
        warmup_day: warmupDay,
        health_score: healthScore,
        daily_limit: dailyLimit,
        action,
        warmup_completed: warmupCompleted,
      })
    }

    return jsonResponse({ processed: summary.length, domains: summary })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
