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
    // Look up the send by resend_message_id
    const messageId = (data.email_id || data.message_id) as string
    if (!messageId) {
      return jsonResponse({ error: 'Missing message ID in event data' }, 400)
    }

    const { data: send, error: sendErr } = await supabase
      .from('ventas_em_sends')
      .select('*, contact:ventas_em_contacts(*)')
      .eq('resend_message_id', messageId)
      .single()

    if (sendErr || !send) {
      return jsonResponse({ error: 'Send record not found', message_id: messageId }, 404)
    }

    const now = new Date().toISOString()
    const campaignId = send.campaign_id as string
    const contactId = send.contact_id as string

    // ── email.delivered ────────────────────────────────────────────
    if (eventType === 'email.delivered') {
      await supabase
        .from('ventas_em_sends')
        .update({ status: 'delivered', delivered_at: now })
        .eq('id', send.id)

      if (campaignId) {
        await supabase.rpc('em_increment_campaign_counter', { p_campaign_id: campaignId, p_counter: 'total_delivered' })
      }

      return jsonResponse({ success: true, event: 'delivered' })
    }

    // ── email.opened ──────────────────────────────────────────────
    if (eventType === 'email.opened') {
      // Only set opened_at if not already set (first open)
      if (!send.opened_at) {
        await supabase
          .from('ventas_em_sends')
          .update({ status: 'opened', opened_at: now })
          .eq('id', send.id)
      }

      // Increment campaign total_opened
      if (campaignId) {
        await supabase.rpc('em_increment_campaign_counter', { p_campaign_id: campaignId, p_counter: 'total_opened' })
      }

      // Increment contact total_opened
      if (contactId) {
        await supabase.rpc('em_increment_contact_counter', { p_contact_id: contactId, p_counter: 'total_opened' })
      }

      // Note: open_hours trigger fires automatically via DB trigger

      return jsonResponse({ success: true, event: 'opened' })
    }

    // ── email.clicked ─────────────────────────────────────────────
    if (eventType === 'email.clicked') {
      const clickUrl = (data.click?.url || data.url || data.link) as string

      // Insert click record
      await supabase.from('ventas_em_clicks').insert({
        send_id: send.id,
        url: clickUrl || null,
        clicked_at: now,
      })

      // Update send
      await supabase
        .from('ventas_em_sends')
        .update({ status: 'clicked', clicked_at: now })
        .eq('id', send.id)

      // Increment campaign total_clicked
      if (campaignId) {
        await supabase.rpc('em_increment_campaign_counter', { p_campaign_id: campaignId, p_counter: 'total_clicked' })
      }

      // Increment contact total_clicked
      if (contactId) {
        await supabase.rpc('em_increment_contact_counter', { p_contact_id: contactId, p_counter: 'total_clicked' })
      }

      return jsonResponse({ success: true, event: 'clicked' })
    }

    // ── email.bounced ─────────────────────────────────────────────
    if (eventType === 'email.bounced') {
      const errorCode = (data.error_code || data.bounce?.status || '') as string
      const isHardBounce = /^5[0-9]{2}$/.test(errorCode) || /^5\./.test(errorCode)
      const bounceType = isHardBounce ? 'hard' : 'soft'

      const contactEmail = (send.contact as Record<string, unknown>)?.email as string

      if (isHardBounce) {
        // Hard bounce: suppress immediately
        await supabase
          .from('ventas_em_suppressions')
          .upsert(
            { email: contactEmail, reason: 'bounce', suppressed_at: now, bounce_type: 'hard' },
            { onConflict: 'email' },
          )

        // Update contact status
        await supabase
          .from('ventas_em_contacts')
          .update({ status: 'bounced' })
          .eq('id', contactId)
      } else {
        // Soft bounce: count occurrences, suppress after 3
        const { count } = await supabase
          .from('ventas_em_sends')
          .select('*', { count: 'exact', head: true })
          .eq('contact_id', contactId)
          .eq('status', 'bounced')

        if ((count || 0) >= 2) {
          // This is the 3rd bounce (current one not yet counted)
          await supabase
            .from('ventas_em_suppressions')
            .upsert(
              { email: contactEmail, reason: 'bounce', suppressed_at: now, bounce_type: 'soft' },
              { onConflict: 'email' },
            )
        }
      }

      // Update send
      await supabase
        .from('ventas_em_sends')
        .update({ status: 'bounced', error_message: `${bounceType} bounce: ${errorCode}` })
        .eq('id', send.id)

      // Increment campaign total_bounced
      if (campaignId) {
        await supabase.rpc('em_increment_campaign_counter', { p_campaign_id: campaignId, p_counter: 'total_bounced' })
      }

      return jsonResponse({ success: true, event: 'bounced', bounce_type: bounceType })
    }

    // ── email.complained ──────────────────────────────────────────
    if (eventType === 'email.complained') {
      const contactEmail = (send.contact as Record<string, unknown>)?.email as string

      // Add to suppressions
      await supabase
        .from('ventas_em_suppressions')
        .upsert(
          { email: contactEmail, reason: 'complaint', suppressed_at: now },
          { onConflict: 'email' },
        )

      // Update contact status
      await supabase
        .from('ventas_em_contacts')
        .update({ status: 'complained' })
        .eq('id', contactId)

      // Update send
      await supabase
        .from('ventas_em_sends')
        .update({ status: 'complained' })
        .eq('id', send.id)

      // Increment campaign total_complained
      if (campaignId) {
        await supabase.rpc('em_increment_campaign_counter', { p_campaign_id: campaignId, p_counter: 'total_complained' })
      }

      return jsonResponse({ success: true, event: 'complained' })
    }

    // Unknown event type — acknowledge anyway
    return jsonResponse({ success: true, event: eventType, handled: false })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
