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

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  const fromEmail = (body.from as string || '').trim().toLowerCase()
  const subject = (body.subject as string) || ''
  const bodyText = (body.body as string) || (body.text as string) || ''

  if (!fromEmail) {
    return jsonResponse({ error: 'from email is required' }, 400)
  }

  try {
    // Look up contact by email
    const { data: contact } = await supabase
      .from('ventas_em_contacts')
      .select('*')
      .eq('email', fromEmail)
      .single()

    let classification = 'other'
    let confidence = 0

    // ── AI classification (if ANTHROPIC_API_KEY is set) ──────────────
    if (ANTHROPIC_API_KEY) {
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
            max_tokens: 100,
            messages: [
              {
                role: 'user',
                content: `Classify this email reply into exactly one category. Reply with ONLY a JSON object.

Subject: "${subject}"
Body: "${bodyText.substring(0, 500)}"

Categories:
- interested: The person shows interest or wants more info
- unsubscribe: The person wants to stop receiving emails
- question: The person asks a question
- out_of_office: Auto-reply or vacation message
- other: Anything else

Reply ONLY with: {"category": "...", "confidence": 0.0-1.0}`,
              },
            ],
          }),
        })

        const claudeData = await claudeRes.json()
        const responseText = claudeData.content?.[0]?.text || '{}'
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          classification = parsed.category || 'other'
          confidence = parsed.confidence || 0
        }
      } catch {
        // AI classification failed — use fallback
        classification = classifyFallback(subject, bodyText)
      }
    } else {
      // No API key — use simple keyword-based classification
      classification = classifyFallback(subject, bodyText)
    }

    // ── Act on classification ────────────────────────────────────────
    if (classification === 'unsubscribe' && contact) {
      // Add to suppressions
      await supabase
        .from('ventas_em_suppressions')
        .upsert(
          { email: fromEmail, reason: 'unsubscribe', source: 'inbound_reply', suppressed_at: new Date().toISOString() },
          { onConflict: 'email' },
        )

      // Update contact status
      await supabase
        .from('ventas_em_contacts')
        .update({ status: 'unsubscribed' })
        .eq('id', contact.id)
    }

    if (classification === 'interested' && contact) {
      // Boost lead score
      const currentScore = (contact.lead_score as number) || 0
      const newScore = Math.min(100, currentScore + 20)
      await supabase
        .from('ventas_em_contacts')
        .update({ lead_score: newScore })
        .eq('id', contact.id)
    }

    // ── Log to audit ─────────────────────────────────────────────────
    await supabase.from('ventas_em_audit_log').insert({
      action: 'inbound_reply',
      entity_id: contact?.id || null,
      details: {
        from: fromEmail,
        subject,
        classification,
        confidence,
        body_preview: bodyText.substring(0, 200),
      },
      performed_at: new Date().toISOString(),
    })

    return jsonResponse({
      success: true,
      classification,
      confidence,
      contact_id: contact?.id || null,
      action_taken: classification === 'unsubscribe'
        ? 'suppressed'
        : classification === 'interested'
          ? 'score_boosted'
          : 'logged',
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})

// Simple keyword-based fallback classifier
function classifyFallback(subject: string, bodyText: string): string {
  const text = `${subject} ${bodyText}`.toLowerCase()

  const unsubWords = ['unsubscribe', 'baja', 'darse de baja', 'no quiero', 'stop', 'remove', 'eliminar']
  if (unsubWords.some((w) => text.includes(w))) return 'unsubscribe'

  const oooWords = ['out of office', 'fuera de la oficina', 'vacaciones', 'auto-reply', 'automatic reply', 'ausencia']
  if (oooWords.some((w) => text.includes(w))) return 'out_of_office'

  const interestWords = ['interesado', 'interested', 'me interesa', 'quiero saber', 'tell me more', 'more info', 'informacion']
  if (interestWords.some((w) => text.includes(w))) return 'interested'

  if (text.includes('?')) return 'question'

  return 'other'
}
