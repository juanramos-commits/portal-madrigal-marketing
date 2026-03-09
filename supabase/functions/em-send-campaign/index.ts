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

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  const action = body.action as string

  try {
    // ── PREPARE ──────────────────────────────────────────────────────
    if (action === 'prepare') {
      const campaignId = body.campaign_id as string
      if (!campaignId) {
        return jsonResponse({ error: 'campaign_id is required' }, 400)
      }

      // Get campaign with template and segment
      const { data: campaign, error: campErr } = await supabase
        .from('ventas_em_campaigns')
        .select('*, template:ventas_em_templates(*), segment:ventas_em_segments(*)')
        .eq('id', campaignId)
        .single()

      if (campErr || !campaign) {
        return jsonResponse({ error: 'Campaign not found', detail: campErr?.message }, 404)
      }

      // Update status to preparing
      await supabase
        .from('ventas_em_campaigns')
        .update({ status: 'preparing' })
        .eq('id', campaignId)

      // Evaluate segment to get contact IDs
      const { data: segmentContacts, error: segErr } = await supabase
        .rpc('em_evaluate_segment', { segment_id: campaign.segment_id })

      if (segErr) {
        return jsonResponse({ error: 'Failed to evaluate segment', detail: segErr.message }, 500)
      }

      const contactIds: string[] = (segmentContacts || []).map((c: { id: string }) => c.id)

      if (contactIds.length === 0) {
        await supabase
          .from('ventas_em_campaigns')
          .update({ status: 'draft' })
          .eq('id', campaignId)
        return jsonResponse({ queued: 0, message: 'No contacts in segment' })
      }

      // Filter out suppressed emails
      const { data: suppressions } = await supabase
        .from('ventas_em_suppressions')
        .select('email')

      const suppressedEmails = new Set((suppressions || []).map((s: { email: string }) => s.email.toLowerCase()))

      // Get contacts data
      const { data: contacts } = await supabase
        .from('ventas_em_contacts')
        .select('*')
        .in('id', contactIds)

      if (!contacts || contacts.length === 0) {
        await supabase
          .from('ventas_em_campaigns')
          .update({ status: 'draft' })
          .eq('id', campaignId)
        return jsonResponse({ queued: 0, message: 'No valid contacts' })
      }

      // Filter suppressed
      let eligible = contacts.filter(
        (c: { email: string }) => !suppressedEmails.has(c.email.toLowerCase())
      )

      // Filter frequency cap
      const freqChecked: typeof eligible = []
      for (const contact of eligible) {
        const { data: capOk } = await supabase
          .rpc('em_check_frequency_cap', { contact_id: contact.id })
        if (capOk !== false) {
          freqChecked.push(contact)
        }
      }
      eligible = freqChecked

      if (eligible.length === 0) {
        await supabase
          .from('ventas_em_campaigns')
          .update({ status: 'draft' })
          .eq('id', campaignId)
        return jsonResponse({ queued: 0, message: 'All contacts filtered out' })
      }

      // Prepare send rows
      const subjectVariants = campaign.subject_variants as string[] | null
      const abTestSize = (campaign.ab_test_size as number) || 0
      const variantCount = subjectVariants ? subjectVariants.length + 1 : 1 // +1 for original
      const abCutoff = Math.floor(eligible.length * (abTestSize / 100))

      const now = new Date()
      const sends = eligible.map((contact: Record<string, unknown>, index: number) => {
        // Determine variant_index
        let variantIndex = 0
        if (subjectVariants && subjectVariants.length > 0 && abTestSize > 0 && index < abCutoff) {
          variantIndex = index % variantCount
        }

        // STO: schedule for best_send_hour
        let scheduledFor = now.toISOString()
        const bestHour = contact.best_send_hour as number | null
        if (bestHour !== null && bestHour !== undefined) {
          const scheduled = new Date(now)
          scheduled.setUTCMinutes(0, 0, 0)
          scheduled.setUTCHours(bestHour)
          if (scheduled <= now) {
            scheduled.setUTCDate(scheduled.getUTCDate() + 1)
          }
          scheduledFor = scheduled.toISOString()
        }

        return {
          campaign_id: campaignId,
          contact_id: contact.id,
          variant_index: variantIndex,
          scheduled_for: scheduledFor,
          priority: 1,
          status: 'queued',
        }
      })

      // Insert sends in batches
      const BATCH_SIZE = 500
      for (let i = 0; i < sends.length; i += BATCH_SIZE) {
        const batch = sends.slice(i, i + BATCH_SIZE)
        const { error: insertErr } = await supabase
          .from('ventas_em_sends')
          .insert(batch)
        if (insertErr) {
          return jsonResponse({ error: 'Failed to create sends', detail: insertErr.message }, 500)
        }
      }

      // Update campaign status and total_sent
      await supabase
        .from('ventas_em_campaigns')
        .update({ status: 'sending', total_sent: sends.length })
        .eq('id', campaignId)

      return jsonResponse({ queued: sends.length })
    }

    // ── SEND ─────────────────────────────────────────────────────────
    if (action === 'send') {
      // Find campaigns with status='sending'
      const { data: campaigns, error: campErr } = await supabase
        .from('ventas_em_campaigns')
        .select('*, template:ventas_em_templates(*)')
        .eq('status', 'sending')

      if (campErr || !campaigns || campaigns.length === 0) {
        return jsonResponse({ processed: 0, message: 'No sending campaigns' })
      }

      let totalProcessed = 0

      for (const campaign of campaigns) {
        // Claim next batch of sends
        const { data: claimed, error: claimErr } = await supabase
          .rpc('em_claim_next_send', { campaign_id: campaign.id, batch_size: 50 })

        if (claimErr || !claimed || claimed.length === 0) {
          // No more sends — check if campaign is done
          const { count } = await supabase
            .from('ventas_em_sends')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'queued')

          if (count === 0) {
            await supabase
              .from('ventas_em_campaigns')
              .update({ status: 'sent', completed_at: new Date().toISOString() })
              .eq('id', campaign.id)
          }
          continue
        }

        // Get contact data for claimed sends
        const contactIds = claimed.map((s: { contact_id: string }) => s.contact_id)
        const { data: contacts } = await supabase
          .from('ventas_em_contacts')
          .select('*')
          .in('id', contactIds)

        const contactMap = new Map(
          (contacts || []).map((c: { id: string }) => [c.id, c])
        )

        const templateHtml = campaign.template?.html_body || ''
        const fromAddress = campaign.from_email || Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@example.com'

        for (const send of claimed) {
          const contact = contactMap.get(send.contact_id) as Record<string, unknown> | undefined
          if (!contact) {
            await supabase
              .from('ventas_em_sends')
              .update({ status: 'failed', error_message: 'Contact not found' })
              .eq('id', send.id)
            continue
          }

          // Determine subject based on variant_index
          let subject = campaign.subject as string
          const variants = campaign.subject_variants as string[] | null
          if (send.variant_index > 0 && variants && variants.length >= send.variant_index) {
            subject = variants[send.variant_index - 1]
          }

          // Personalize HTML
          let html = templateHtml
            .replace(/\{\{nombre\}\}/g, (contact.nombre as string) || '')
            .replace(/\{\{empresa\}\}/g, (contact.empresa as string) || '')
            .replace(/\{\{email\}\}/g, (contact.email as string) || '')

          // Send via Resend
          try {
            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromAddress,
                to: contact.email,
                subject,
                html,
              }),
            })

            const resendData = await resendRes.json()

            if (!resendRes.ok) {
              throw new Error(resendData.message || `Resend API error: ${resendRes.status}`)
            }

            await supabase
              .from('ventas_em_sends')
              .update({
                status: 'delivered',
                sent_at: new Date().toISOString(),
                resend_message_id: resendData.id,
              })
              .eq('id', send.id)

            totalProcessed++
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Send failed'
            await supabase
              .from('ventas_em_sends')
              .update({ status: 'failed', error_message: errMsg })
              .eq('id', send.id)

            // Failed send — already marked on the send record above
          }
        }

        // Check if campaign is done after this batch
        const { count: remaining } = await supabase
          .from('ventas_em_sends')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'queued')

        if (remaining === 0) {
          await supabase
            .from('ventas_em_campaigns')
            .update({ status: 'sent', completed_at: new Date().toISOString() })
            .eq('id', campaign.id)
        }

        // Check A/B test: if variants exist and ab_test_duration has passed
        const variants = campaign.subject_variants as string[] | null
        if (variants && variants.length > 0 && campaign.ab_test_duration && campaign.started_at) {
          const startedAt = new Date(campaign.started_at as string)
          // ab_test_duration is an INTERVAL type (e.g. "04:00:00"), parse hours
          const durationStr = String(campaign.ab_test_duration || '04:00:00')
          const hoursMatch = durationStr.match(/^(\d+)/)
          const durationHours = hoursMatch ? parseInt(hoursMatch[1], 10) : 4
          const cutoff = new Date(startedAt.getTime() + durationHours * 60 * 60 * 1000)

          if (new Date() >= cutoff) {
            const { data: abResults } = await supabase
              .rpc('em_ab_results', { campaign_id: campaign.id })

            if (abResults && abResults.length > 0) {
              const winner = abResults.reduce(
                (best: Record<string, unknown>, r: Record<string, unknown>) =>
                  ((r.open_rate as number) > ((best.open_rate as number) || 0)) ? r : best,
                abResults[0],
              )
              await supabase
                .from('ventas_em_campaigns')
                .update({ winning_variant: winner.variant_index })
                .eq('id', campaign.id)
            }
          }
        }
      }

      return jsonResponse({ processed: totalProcessed })
    }

    return jsonResponse({ error: 'Invalid action. Use "prepare" or "send"' }, 400)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
