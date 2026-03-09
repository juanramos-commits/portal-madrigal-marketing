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

/** Replace {option1|option2|option3} spintax with a random pick */
function resolveSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_match, group: string) => {
    const options = group.split('|')
    return options[Math.floor(Math.random() * options.length)]
  })
}

/** Replace {{variable}} placeholders with contact data */
function replaceVariables(
  text: string,
  contact: Record<string, unknown>,
  unsubscribeUrl: string,
): string {
  return text
    .replace(/\{\{first_name\}\}/g, (contact.first_name as string) || '')
    .replace(/\{\{last_name\}\}/g, (contact.last_name as string) || '')
    .replace(/\{\{company\}\}/g, (contact.company as string) || '')
    .replace(/\{\{job_title\}\}/g, (contact.job_title as string) || '')
    .replace(/\{\{email\}\}/g, (contact.email as string) || '')
    .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
}

/** Sleep helper for smart throttle */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  const action = body.action as string

  try {
    // -- PREPARE --------------------------------------------------------
    if (action === 'prepare') {
      const campaignId = body.campaign_id as string
      if (!campaignId) {
        return jsonResponse({ error: 'campaign_id is required' }, 400)
      }

      // Get the active campaign
      const { data: campaign, error: campErr } = await supabase
        .from('ventas_co_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('status', 'active')
        .single()

      if (campErr || !campaign) {
        return jsonResponse({ error: 'Active campaign not found', detail: campErr?.message }, 404)
      }

      // Get enrollments ready to be processed
      const { data: enrollments, error: enrErr } = await supabase
        .from('ventas_co_enrollments')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'active')
        .lte('next_step_at', new Date().toISOString())

      if (enrErr) {
        return jsonResponse({ error: 'Failed to fetch enrollments', detail: enrErr.message }, 500)
      }

      if (!enrollments || enrollments.length === 0) {
        return jsonResponse({ prepared: 0, message: 'No enrollments ready' })
      }

      // Get all steps for this campaign
      const { data: steps } = await supabase
        .from('ventas_co_steps')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('step_number', { ascending: true })

      if (!steps || steps.length === 0) {
        return jsonResponse({ prepared: 0, message: 'Campaign has no steps' })
      }

      const stepsMap = new Map(steps.map((s: Record<string, unknown>) => [s.step_number as number, s]))

      // Get suppressions
      const { data: suppressions } = await supabase
        .from('ventas_co_suppressions')
        .select('email')

      const suppressedEmails = new Set(
        (suppressions || []).map((s: { email: string }) => s.email.toLowerCase()),
      )

      // Get inbox IDs from campaign
      const inboxIds = (campaign.inbox_ids as string[]) || []

      let preparedCount = 0

      for (let i = 0; i < enrollments.length; i++) {
        const enrollment = enrollments[i]
        const currentStepNumber = enrollment.current_step as number
        const step = stepsMap.get(currentStepNumber) as Record<string, unknown> | undefined

        if (!step) {
          // No more steps — mark enrollment completed
          await supabase
            .from('ventas_co_enrollments')
            .update({ status: 'completed' })
            .eq('id', enrollment.id)
          continue
        }

        const stepType = step.type as string

        // -- DELAY step ---------------------------------------------------
        if (stepType === 'delay') {
          const delaySeconds = (step.delay_seconds as number) || 0
          const nextStepAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
          await supabase
            .from('ventas_co_enrollments')
            .update({
              current_step: currentStepNumber + 1,
              next_step_at: nextStepAt,
            })
            .eq('id', enrollment.id)
          continue
        }

        // -- CONDITION step -----------------------------------------------
        if (stepType === 'condition') {
          const conditionField = step.condition_field as string // e.g. 'opened', 'clicked', 'replied'
          const yesStep = (step.yes_next_step as number) || currentStepNumber + 1
          const noStep = (step.no_next_step as number) || currentStepNumber + 1

          // Check previous sends for this enrollment's contact
          const { data: prevSends } = await supabase
            .from('ventas_co_sends')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('contact_id', enrollment.contact_id)
            .eq('status', 'sent')

          let conditionMet = false
          if (prevSends && prevSends.length > 0) {
            if (conditionField === 'opened') {
              conditionMet = prevSends.some((s: Record<string, unknown>) => s.opened_at !== null)
            } else if (conditionField === 'clicked') {
              conditionMet = prevSends.some((s: Record<string, unknown>) => s.clicked_at !== null)
            } else if (conditionField === 'replied') {
              conditionMet = prevSends.some((s: Record<string, unknown>) => s.replied_at !== null)
            }
          }

          const nextStep = conditionMet ? yesStep : noStep
          await supabase
            .from('ventas_co_enrollments')
            .update({
              current_step: nextStep,
              next_step_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id)
          continue
        }

        // -- EMAIL step ---------------------------------------------------
        if (stepType === 'email') {
          // Get contact
          const { data: contact } = await supabase
            .from('ventas_co_contacts')
            .select('*')
            .eq('id', enrollment.contact_id)
            .single()

          if (!contact) {
            await supabase
              .from('ventas_co_enrollments')
              .update({ status: 'failed' })
              .eq('id', enrollment.id)
            continue
          }

          // Check suppression
          if (suppressedEmails.has((contact.email as string).toLowerCase())) {
            await supabase
              .from('ventas_co_enrollments')
              .update({ status: 'suppressed' })
              .eq('id', enrollment.id)
            continue
          }

          // Check 24h frequency cap — last send to this contact
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          const { data: recentSends } = await supabase
            .from('ventas_co_sends')
            .select('id')
            .eq('contact_id', contact.id)
            .gte('sent_at', twentyFourHoursAgo)
            .limit(1)

          if (recentSends && recentSends.length > 0) {
            // Skip for now, will retry next cycle
            continue
          }

          // Select inbox via round-robin
          let inboxId: string | null = null
          if (inboxIds.length > 0) {
            inboxId = inboxIds[i % inboxIds.length]
          }

          // Check inbox daily limit
          if (inboxId) {
            const { data: inbox } = await supabase
              .from('ventas_co_inboxes')
              .select('daily_limit, sent_today')
              .eq('id', inboxId)
              .single()

            if (inbox) {
              const dailyLimit = (inbox.daily_limit as number) || 50
              const sentToday = (inbox.sent_today as number) || 0
              if (sentToday >= dailyLimit) {
                // Skip — inbox limit reached, will retry next cycle
                continue
              }
            }
          }

          // Resolve spintax and variables
          const subjectRaw = (step.subject as string) || ''
          const bodyRaw = (step.body_html as string) || ''

          const unsubscribeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/co-unsubscribe?email=${encodeURIComponent(contact.email as string)}&campaign_id=${campaignId}`

          let subject = resolveSpintax(subjectRaw)
          subject = replaceVariables(subject, contact, unsubscribeUrl)

          let bodyHtml = resolveSpintax(bodyRaw)
          bodyHtml = replaceVariables(bodyHtml, contact, unsubscribeUrl)

          // STO: schedule for best_send_hour if enabled
          const now = new Date()
          let scheduledFor = now.toISOString()

          if (campaign.use_sto && contact.best_send_hour !== null && contact.best_send_hour !== undefined) {
            const bestHour = contact.best_send_hour as number
            const scheduled = new Date(now)
            scheduled.setUTCMinutes(0, 0, 0)
            scheduled.setUTCHours(bestHour)
            if (scheduled <= now) {
              scheduled.setUTCDate(scheduled.getUTCDate() + 1)
            }
            scheduledFor = scheduled.toISOString()
          }

          // Generate idempotency key
          const idempotencyKey = `co-${enrollment.id}-step-${currentStepNumber}-${Date.now()}`

          // Insert send record
          const { error: insertErr } = await supabase
            .from('ventas_co_sends')
            .insert({
              campaign_id: campaignId,
              enrollment_id: enrollment.id,
              contact_id: contact.id,
              inbox_id: inboxId,
              step_number: currentStepNumber,
              subject,
              body_html: bodyHtml,
              scheduled_for: scheduledFor,
              status: 'queued',
              idempotency_key: idempotencyKey,
            })

          if (insertErr) {
            continue
          }

          // Advance enrollment to next step
          const nextStepNumber = currentStepNumber + 1
          const nextStep = stepsMap.get(nextStepNumber)

          if (nextStep) {
            // If next step is a delay, set next_step_at accordingly
            const nextDelay = nextStep.type === 'delay' ? ((nextStep.delay_seconds as number) || 0) : 0
            await supabase
              .from('ventas_co_enrollments')
              .update({
                current_step: nextStepNumber,
                next_step_at: new Date(Date.now() + nextDelay * 1000).toISOString(),
              })
              .eq('id', enrollment.id)
          } else {
            // No more steps — mark completed
            await supabase
              .from('ventas_co_enrollments')
              .update({ status: 'completed', current_step: nextStepNumber })
              .eq('id', enrollment.id)
          }

          preparedCount++
        }
      }

      return jsonResponse({ prepared: preparedCount })
    }

    // -- SEND -----------------------------------------------------------
    if (action === 'send') {
      const campaignId = body.campaign_id as string
      if (!campaignId) {
        return jsonResponse({ error: 'campaign_id is required' }, 400)
      }

      // Get campaign for settings
      const { data: campaign, error: campErr } = await supabase
        .from('ventas_co_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campErr || !campaign) {
        return jsonResponse({ error: 'Campaign not found', detail: campErr?.message }, 404)
      }

      // Claim up to 25 queued sends ready to go, using FOR UPDATE SKIP LOCKED via RPC
      const { data: claimed, error: claimErr } = await supabase
        .rpc('co_claim_next_sends', { p_campaign_id: campaignId, p_limit: 25 })

      if (claimErr || !claimed || claimed.length === 0) {
        return jsonResponse({ sent: 0, message: 'No sends to process' })
      }

      let sentCount = 0

      for (const send of claimed) {
        // Fetch contact email (RPC only returns contact_id, not email)
        let contactEmail = ''
        if (send.contact_id) {
          const { data: contact } = await supabase
            .from('ventas_co_contacts')
            .select('email')
            .eq('id', send.contact_id)
            .single()
          contactEmail = (contact?.email as string) || ''
        }

        if (!contactEmail) {
          // Skip sends without a valid email
          await supabase
            .from('ventas_co_sends')
            .update({ status: 'failed', error_message: 'No contact email found' })
            .eq('id', send.send_id)
          continue
        }

        // Get inbox details
        let fromAddress = RESEND_FROM_EMAIL
        let signatureHtml = ''
        let displayName = ''

        if (send.inbox_id) {
          const { data: inbox } = await supabase
            .from('ventas_co_inboxes')
            .select('email, display_name, signature_html, sent_today')
            .eq('id', send.inbox_id)
            .single()

          if (inbox) {
            fromAddress = (inbox.email as string) || RESEND_FROM_EMAIL
            displayName = (inbox.display_name as string) || ''
            signatureHtml = (inbox.signature_html as string) || ''
          }
        }

        // Build from field
        const fromField = displayName
          ? `${displayName} <${fromAddress}>`
          : fromAddress

        // Append signature if exists
        let finalHtml = send.body_html as string
        if (signatureHtml) {
          finalHtml += `<br/><br/>${signatureHtml}`
        }

        // Build unsubscribe URL
        const unsubscribeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/co-unsubscribe?email=${encodeURIComponent(contactEmail)}&campaign_id=${campaignId}`

        // Send via Resend API
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromField,
              to: [contactEmail],
              subject: send.subject as string,
              html: finalHtml,
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }),
          })

          const resendData = await resendRes.json()

          if (!resendRes.ok) {
            throw new Error(resendData.message || `Resend API error: ${resendRes.status}`)
          }

          // Success — update send record
          await supabase
            .from('ventas_co_sends')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              resend_id: resendData.id,
            })
            .eq('id', send.send_id)

          // Increment inbox sent_today (atomic to avoid race conditions)
          if (send.inbox_id) {
            await supabase.rpc('co_increment_inbox_sent_today', { p_inbox_id: send.inbox_id })
              .then(({ error }) => { if (error) console.error('Error incrementing sent_today:', error) })
          }

          // Increment campaign total_sent
          await supabase.rpc('co_increment_counter', {
            p_table: 'ventas_co_campaigns',
            p_id: campaignId,
            p_column: 'total_sent',
          })

          // Update contact last_contacted_at and times_contacted
          if (send.contact_id) {
            const { data: ct } = await supabase
              .from('ventas_co_contacts')
              .select('times_contacted')
              .eq('id', send.contact_id)
              .single()
            await supabase
              .from('ventas_co_contacts')
              .update({
                last_contacted_at: new Date().toISOString(),
                times_contacted: ((ct?.times_contacted as number) || 0) + 1,
                status: 'contacted',
              })
              .eq('id', send.contact_id)
          }

          sentCount++
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Send failed'
          await supabase
            .from('ventas_co_sends')
            .update({ status: 'failed', error_message: errMsg })
            .eq('id', send.send_id)
        }

        // Smart throttle: random 3-8 second delay between sends
        if (campaign.use_smart_throttle) {
          const delay = 3000 + Math.floor(Math.random() * 5000)
          await sleep(delay)
        }
      }

      return jsonResponse({ sent: sentCount })
    }

    return jsonResponse({ error: 'Invalid action. Use "prepare" or "send"' }, 400)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
