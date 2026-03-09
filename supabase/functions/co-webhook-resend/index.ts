import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Bounce classification helpers ───────────────────────────────────────────

function classifyBounce(data: Record<string, unknown>): { type: 'hard' | 'soft'; reason: string } {
  const bounceData = (data.bounce || {}) as Record<string, unknown>
  const bounceType = (bounceData.type || '') as string
  const reason = (bounceData.message || bounceData.description || data.reason || '') as string
  const errorCode = (bounceData.status || '') as string
  const combined = `${bounceType} ${reason} ${errorCode}`.toLowerCase()

  // Hard bounce indicators
  const hardPatterns = ['550', '5.1.1', '5.1.0', 'does not exist', 'user unknown',
    'no such user', 'invalid recipient', 'mailbox not found', 'hard']
  for (const pattern of hardPatterns) {
    if (combined.includes(pattern)) {
      return { type: 'hard', reason: reason || `Hard bounce: ${errorCode || bounceType}` }
    }
  }

  // Soft bounce indicators
  const softPatterns = ['452', '4.2.2', '4.7.1', 'temporarily', 'try again', 'mailbox full',
    'over quota', 'rate limit', 'soft']
  for (const pattern of softPatterns) {
    if (combined.includes(pattern)) {
      return { type: 'soft', reason: reason || `Soft bounce: ${errorCode || bounceType}` }
    }
  }

  // Default: if error code starts with 5 => hard, otherwise soft
  if (/^5[.\d]/.test(errorCode)) {
    return { type: 'hard', reason: reason || `Hard bounce: ${errorCode}` }
  }

  return { type: 'soft', reason: reason || `Soft bounce: ${errorCode || 'unknown'}` }
}

// ── Reputation log upsert ───────────────────────────────────────────────────

async function upsertReputationLog(
  supabase: ReturnType<typeof createClient>,
  domainId: string,
  counter: string,
) {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Try to increment existing row first
  const { data: existing } = await supabase
    .from('ventas_co_reputation_log')
    .select('id, ' + counter)
    .eq('domain_id', domainId)
    .eq('date', today)
    .single()

  if (existing) {
    await supabase
      .from('ventas_co_reputation_log')
      .update({ [counter]: ((existing as Record<string, unknown>)[counter] as number || 0) + 1 })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('ventas_co_reputation_log')
      .insert({ domain_id: domainId, date: today, [counter]: 1 })
  }
}

// ── Get domain_id from inbox ────────────────────────────────────────────────

async function getDomainId(
  supabase: ReturnType<typeof createClient>,
  inboxId: string | null,
): Promise<string | null> {
  if (!inboxId) return null
  const { data } = await supabase
    .from('ventas_co_inboxes')
    .select('domain_id')
    .eq('id', inboxId)
    .single()
  return data?.domain_id || null
}

// ── Auto-pause check ────────────────────────────────────────────────────────

async function checkAutoPause(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
) {
  const { data: campaign } = await supabase
    .from('ventas_co_campaigns')
    .select('total_sent, total_bounced, bounce_threshold, auto_pause_enabled, status')
    .eq('id', campaignId)
    .single()

  if (!campaign || !campaign.auto_pause_enabled || campaign.status !== 'active') return
  if (campaign.total_sent <= 0) return

  const bounceRate = campaign.total_bounced / campaign.total_sent
  if (bounceRate > campaign.bounce_threshold) {
    await supabase
      .from('ventas_co_campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId)
      .eq('status', 'active')
  }
}

// ── Update domain health score ──────────────────────────────────────────────

async function decreaseDomainHealth(
  supabase: ReturnType<typeof createClient>,
  domainId: string | null,
  amount: number,
) {
  if (!domainId) return
  const { data: domain } = await supabase
    .from('ventas_co_domains')
    .select('health_score')
    .eq('id', domainId)
    .single()

  if (!domain) return
  const newScore = Math.max(0, (domain.health_score ?? 100) - amount)
  await supabase
    .from('ventas_co_domains')
    .update({ health_score: newScore })
    .eq('id', domainId)
}

// ── Main handler ────────────────────────────────────────────────────────────

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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  const eventType = body.type as string
  const data = (body.data || {}) as Record<string, unknown>

  if (!eventType) {
    return jsonResponse({ error: 'Missing event type' }, 400)
  }

  try {
    // Look up the send by resend_id (data.email_id from Resend)
    const messageId = (data.email_id || data.message_id) as string
    if (!messageId) {
      return jsonResponse({ error: 'Missing message ID in event data' }, 400)
    }

    const { data: send, error: sendErr } = await supabase
      .from('ventas_co_sends')
      .select('*, contact:ventas_co_contacts(*)')
      .eq('resend_id', messageId)
      .single()

    if (sendErr || !send) {
      // Not found — might be from email marketing, not outreach
      return jsonResponse({ error: 'Send record not found', message_id: messageId }, 404)
    }

    const now = new Date().toISOString()
    const campaignId = send.campaign_id as string
    const contactId = send.contact_id as string
    const inboxId = send.inbox_id as string | null
    const contact = (send.contact || {}) as Record<string, unknown>

    // Resolve domain_id from inbox for reputation logging
    const domainId = await getDomainId(supabase, inboxId)

    // ── email.delivered ────────────────────────────────────────────────
    if (eventType === 'email.delivered') {
      await supabase
        .from('ventas_co_sends')
        .update({ status: 'delivered', delivered_at: now })
        .eq('id', send.id)

      if (campaignId) {
        await supabase.rpc('co_increment_counter', {
          p_table: 'ventas_co_campaigns',
          p_id: campaignId,
          p_column: 'total_sent',
        })
      }

      if (domainId) {
        await upsertReputationLog(supabase, domainId, 'delivered')
      }

      return jsonResponse({ success: true, event: 'delivered' })
    }

    // ── email.opened ──────────────────────────────────────────────────
    if (eventType === 'email.opened') {
      // Only set opened_at if not already set (first open)
      if (!send.opened_at) {
        await supabase
          .from('ventas_co_sends')
          .update({ status: 'opened', opened_at: now })
          .eq('id', send.id)
      }

      // Update contact: last_opened_at, times_opened++, status if was 'contacted'
      if (contactId) {
        const contactUpdate: Record<string, unknown> = {
          last_opened_at: now,
          times_opened: ((contact.times_opened as number) || 0) + 1,
        }
        if (contact.status === 'contacted') {
          contactUpdate.status = 'opened'
        }
        await supabase
          .from('ventas_co_contacts')
          .update(contactUpdate)
          .eq('id', contactId)
      }

      // Increment campaign total_opened
      if (campaignId) {
        await supabase.rpc('co_increment_counter', {
          p_table: 'ventas_co_campaigns',
          p_id: campaignId,
          p_column: 'total_opened',
        })
      }

      if (domainId) {
        await upsertReputationLog(supabase, domainId, 'opened')
      }

      return jsonResponse({ success: true, event: 'opened' })
    }

    // ── email.clicked ─────────────────────────────────────────────────
    if (eventType === 'email.clicked') {
      const clickData = (data.click || data) as Record<string, unknown>
      const clickUrl = (clickData.url || data.url || data.link || '') as string
      const userAgent = (clickData.user_agent || clickData.userAgent || data.user_agent || '') as string

      // Insert click record
      await supabase.from('ventas_co_clicks').insert({
        send_id: send.id,
        contact_id: contactId || null,
        url: clickUrl || null,
        user_agent: userAgent || null,
        clicked_at: now,
      })

      // Update send
      await supabase
        .from('ventas_co_sends')
        .update({ status: 'clicked', clicked_at: now })
        .eq('id', send.id)

      // Update contact: times_clicked++, status='clicked'
      if (contactId) {
        await supabase
          .from('ventas_co_contacts')
          .update({
            times_clicked: ((contact.times_clicked as number) || 0) + 1,
            status: 'clicked',
          })
          .eq('id', contactId)
      }

      // Increment campaign total_clicked
      if (campaignId) {
        await supabase.rpc('co_increment_counter', {
          p_table: 'ventas_co_campaigns',
          p_id: campaignId,
          p_column: 'total_clicked',
        })
      }

      if (domainId) {
        await upsertReputationLog(supabase, domainId, 'clicked')
      }

      return jsonResponse({ success: true, event: 'clicked' })
    }

    // ── email.bounced ─────────────────────────────────────────────────
    if (eventType === 'email.bounced') {
      const bounce = classifyBounce(data)
      const contactEmail = (contact.email as string) || ''

      // Update send
      await supabase
        .from('ventas_co_sends')
        .update({
          status: 'bounced',
          bounced_at: now,
          bounce_type: bounce.type,
          bounce_reason: bounce.reason,
        })
        .eq('id', send.id)

      if (bounce.type === 'hard') {
        // Hard bounce: immediate suppression
        await supabase
          .from('ventas_co_suppressions')
          .upsert(
            { email: contactEmail.toLowerCase().trim(), reason: 'bounce_hard', suppressed_at: now },
            { onConflict: 'email' },
          )

        // Update contact status
        if (contactId) {
          await supabase
            .from('ventas_co_contacts')
            .update({ status: 'bounced' })
            .eq('id', contactId)
        }
      } else {
        // Soft bounce: count total soft bounces for this email, suppress if >= 3
        const { count } = await supabase
          .from('ventas_co_sends')
          .select('*', { count: 'exact', head: true })
          .eq('contact_id', contactId)
          .eq('status', 'bounced')
          .eq('bounce_type', 'soft')

        if ((count || 0) >= 3) {
          await supabase
            .from('ventas_co_suppressions')
            .upsert(
              { email: contactEmail.toLowerCase().trim(), reason: 'bounce_soft_repeated', suppressed_at: now },
              { onConflict: 'email' },
            )

          if (contactId) {
            await supabase
              .from('ventas_co_contacts')
              .update({ status: 'bounced' })
              .eq('id', contactId)
          }
        }
      }

      // Increment campaign total_bounced
      if (campaignId) {
        await supabase.rpc('co_increment_counter', {
          p_table: 'ventas_co_campaigns',
          p_id: campaignId,
          p_column: 'total_bounced',
        })

        // Check auto-pause
        await checkAutoPause(supabase, campaignId)
      }

      // Update domain health_score: -3 hard, -1 soft
      if (domainId) {
        await decreaseDomainHealth(supabase, domainId, bounce.type === 'hard' ? 3 : 1)
        await upsertReputationLog(supabase, domainId, 'bounced')
      }

      return jsonResponse({ success: true, event: 'bounced', bounce_type: bounce.type })
    }

    // ── email.complained ──────────────────────────────────────────────
    if (eventType === 'email.complained') {
      const contactEmail = (contact.email as string) || ''

      // Update send
      await supabase
        .from('ventas_co_sends')
        .update({ status: 'complained' })
        .eq('id', send.id)

      // Insert suppression
      await supabase
        .from('ventas_co_suppressions')
        .upsert(
          { email: contactEmail.toLowerCase().trim(), reason: 'complained', suppressed_at: now },
          { onConflict: 'email' },
        )

      // Update contact status
      if (contactId) {
        await supabase
          .from('ventas_co_contacts')
          .update({ status: 'unsubscribed' })
          .eq('id', contactId)
      }

      // Increment campaign counters
      if (campaignId) {
        await supabase.rpc('co_increment_counter', {
          p_table: 'ventas_co_campaigns',
          p_id: campaignId,
          p_column: 'total_bounced',
        })

        // Check auto-pause
        await checkAutoPause(supabase, campaignId)
      }

      // Decrease domain health_score by 5
      if (domainId) {
        await decreaseDomainHealth(supabase, domainId, 5)
        await upsertReputationLog(supabase, domainId, 'complained')
      }

      return jsonResponse({ success: true, event: 'complained' })
    }

    // ── email.delivery_delayed ────────────────────────────────────────
    if (eventType === 'email.delivery_delayed') {
      // Log but don't change status — soft delay
      console.log(`Delivery delayed for send ${send.id}, resend_id=${messageId}`)
      return jsonResponse({ success: true, event: 'delivery_delayed', handled: false })
    }

    // Unknown event type — acknowledge anyway
    return jsonResponse({ success: true, event: eventType, handled: false })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
