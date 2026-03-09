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

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // Body is optional — run all tasks by default
  }

  const task = (body.task as string) || 'all'

  try {
    const results: Record<string, unknown> = {}

    // ── TASK 1: Lead Scoring ─────────────────────────────────────────
    if (task === 'all' || task === 'lead_scoring') {
      const { data: contacts, error: contactsErr } = await supabase
        .from('ventas_em_contacts')
        .select('*')
        .eq('status', 'active')

      if (contactsErr) {
        return jsonResponse({ error: 'Failed to fetch contacts', detail: contactsErr.message }, 500)
      }

      let scored = 0
      const now = new Date()

      for (const contact of (contacts || [])) {
        const totalSent = (contact.total_sent as number) || 0
        const totalOpened = (contact.total_opened as number) || 0
        const totalClicked = (contact.total_clicked as number) || 0

        // Recency score (0-100): days since last open, decaying
        let recencyScore = 0
        if (contact.last_opened_at) {
          const daysSinceOpen = (now.getTime() - new Date(contact.last_opened_at as string).getTime()) / (1000 * 60 * 60 * 24)
          recencyScore = Math.max(0, 100 - (daysSinceOpen * 2)) // Loses 2 points per day
        }

        // Frequency score (0-100): open rate
        const frequencyScore = totalSent > 0
          ? Math.min(100, (totalOpened / totalSent) * 100)
          : 0

        // Depth score (0-100): click-to-open rate
        const depthScore = totalOpened > 0
          ? Math.min(100, (totalClicked / totalOpened) * 100)
          : 0

        // Engagement score: weighted average
        const engagementScore = Math.round(
          recencyScore * 0.4 + frequencyScore * 0.35 + depthScore * 0.25
        )

        // Lead score: engagement + lead quality data
        let leadQualityBonus = 0
        if (contact.lead_id) {
          const { data: lead } = await supabase
            .from('ventas_leads')
            .select('email, telefono, nombre_negocio')
            .eq('id', contact.lead_id)
            .single()

          if (lead) {
            if (lead.email) leadQualityBonus += 10
            if (lead.telefono) leadQualityBonus += 15
            if (lead.nombre_negocio) leadQualityBonus += 10
          }
        }

        const leadScore = Math.min(100, Math.round(engagementScore * 0.7 + leadQualityBonus))

        await supabase
          .from('ventas_em_contacts')
          .update({
            engagement_score: engagementScore,
            lead_score: leadScore,
            scored_at: now.toISOString(),
          })
          .eq('id', contact.id)

        scored++
      }

      results.lead_scoring = { scored }
    }

    // ── TASK 2: Send Time Optimization ───────────────────────────────
    if (task === 'all' || task === 'sto') {
      // Get contacts that have open_hours data
      const { data: openHours, error: ohErr } = await supabase
        .from('ventas_em_open_hours')
        .select('contact_id, hour_utc, open_count')
        .order('open_count', { ascending: false })

      if (ohErr) {
        return jsonResponse({ error: 'Failed to fetch open hours', detail: ohErr.message }, 500)
      }

      // Group by contact, pick the hour with the highest open_count
      const bestHours = new Map<string, number>()
      for (const row of (openHours || [])) {
        const cid = row.contact_id as string
        if (!bestHours.has(cid)) {
          bestHours.set(cid, row.hour_utc as number)
        }
      }

      let updated = 0
      for (const [contactId, bestHour] of bestHours) {
        await supabase
          .from('ventas_em_contacts')
          .update({ best_send_hour: bestHour })
          .eq('id', contactId)
        updated++
      }

      results.sto = { updated }
    }

    // ── TASK 3: AI Subject Generation ────────────────────────────────
    if ((task === 'all' || task === 'ai_subjects') && ANTHROPIC_API_KEY) {
      // Find draft campaigns that need AI subject generation
      const { data: campaigns } = await supabase
        .from('ventas_em_campaigns')
        .select('*, template:ventas_em_templates(*)')
        .eq('status', 'draft')

      const aiCampaigns = (campaigns || []).filter((c: Record<string, unknown>) => {
        const subject = (c.subject as string) || ''
        return subject.startsWith('[AI]')
      })

      let generated = 0

      for (const campaign of aiCampaigns) {
        const baseSubject = ((campaign.subject as string) || '').replace(/^\[AI\]\s*/, '')
        const templateContent = (campaign.template as Record<string, unknown>)?.html as string || ''

        // Strip HTML tags for context
        const textContent = templateContent.replace(/<[^>]+>/g, ' ').substring(0, 500)

        try {
          const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 300,
              messages: [
                {
                  role: 'user',
                  content: `Generate exactly 3 email subject line variants for an email marketing campaign.
Base subject hint: "${baseSubject}"
Email content summary: "${textContent}"

Requirements:
- Each subject should be under 60 characters
- Make them compelling and varied in approach (curiosity, benefit, urgency)
- Return ONLY a JSON array of 3 strings, no other text

Example output: ["Subject 1", "Subject 2", "Subject 3"]`,
                },
              ],
            }),
          })

          const claudeData = await claudeRes.json()
          const responseText = claudeData.content?.[0]?.text || '[]'

          // Parse the JSON array from the response
          const jsonMatch = responseText.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const variants = JSON.parse(jsonMatch[0]) as string[]

            await supabase
              .from('ventas_em_campaigns')
              .update({
                subject_variants: variants,
                subject: baseSubject || variants[0],
              })
              .eq('id', campaign.id)

            // Also save to template ai_variants
            if (campaign.template_id) {
              await supabase
                .from('ventas_em_templates')
                .update({ ai_variants: variants })
                .eq('id', campaign.template_id)
            }

            generated++
          }
        } catch {
          // AI generation is non-critical, continue with next campaign
        }
      }

      results.ai_subjects = { generated }
    } else if (task === 'ai_subjects' && !ANTHROPIC_API_KEY) {
      results.ai_subjects = { skipped: true, reason: 'ANTHROPIC_API_KEY not set' }
    }

    return jsonResponse({ success: true, results })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
