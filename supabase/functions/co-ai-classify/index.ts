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

interface ClassificationResult {
  classification: string
  sentiment: string
  summary: string
  requires_action: boolean
}

function ruleBasedClassify(text: string): ClassificationResult {
  const lower = text.toLowerCase()

  if (/unsubscribe|remove me|stop|no más|darse de baja/.test(lower)) {
    return { classification: 'unsubscribe', sentiment: 'negative', summary: 'Contact requests to unsubscribe.', requires_action: true }
  }
  if (/out of office|fuera de oficina|vacaciones|ooo|auto.?reply|respuesta automática/.test(lower)) {
    return { classification: 'out_of_office', sentiment: 'neutral', summary: 'Auto-reply or out of office message.', requires_action: false }
  }
  if (/interesado|interested|me gustaría|cuéntame más|tell me more|let's talk|hablemos/.test(lower)) {
    return { classification: 'interested', sentiment: 'positive', summary: 'Contact expressed interest.', requires_action: true }
  }
  if (/no gracias|no thank|not interested|no nos interesa|no estamos interesados/.test(lower)) {
    return { classification: 'not_interested', sentiment: 'negative', summary: 'Contact is not interested.', requires_action: false }
  }

  return { classification: 'other', sentiment: 'neutral', summary: 'Reply requires manual review.', requires_action: false }
}

async function aiClassify(subject: string, bodyText: string, apiKey: string): Promise<ClassificationResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: 'Classify this email reply from a cold outreach campaign. Return JSON with: classification (interested, not_interested, out_of_office, unsubscribe, question, referral, other), sentiment (positive, neutral, negative), summary (1 sentence), requires_action (boolean)',
      messages: [
        { role: 'user', content: `Subject: ${subject}\n\n${bodyText}` },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''

  // Extract JSON from the response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse AI response as JSON')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    classification: parsed.classification || 'other',
    sentiment: parsed.sentiment || 'neutral',
    summary: parsed.summary || '',
    requires_action: Boolean(parsed.requires_action),
  }
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

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  const useAI = ANTHROPIC_API_KEY.length > 0

  try {
    // Get unclassified replies
    const { data: replies, error: fetchErr } = await supabase
      .from('ventas_co_replies')
      .select('*')
      .is('classification', null)
      .limit(20)

    if (fetchErr) {
      return jsonResponse({ error: 'Failed to fetch replies', detail: fetchErr.message }, 500)
    }

    if (!replies || replies.length === 0) {
      return jsonResponse({ classified: 0, message: 'No unclassified replies' })
    }

    let classifiedCount = 0

    for (const reply of replies) {
      let result: ClassificationResult

      try {
        if (useAI) {
          result = await aiClassify(
            (reply.subject as string) || '',
            (reply.body_text as string) || '',
            ANTHROPIC_API_KEY,
          )
        } else {
          const text = `${reply.subject || ''} ${reply.body_text || ''}`
          result = ruleBasedClassify(text)
        }
      } catch {
        // Fallback to rule-based if AI fails
        const text = `${reply.subject || ''} ${reply.body_text || ''}`
        result = ruleBasedClassify(text)
      }

      // Update the reply with classification data
      const { error: updateErr } = await supabase
        .from('ventas_co_replies')
        .update({
          classification: result.classification,
          sentiment: result.sentiment,
          ai_summary: result.summary,
          requires_action: result.requires_action,
          classified_at: new Date().toISOString(),
        })
        .eq('id', reply.id)

      if (updateErr) continue

      // Handle unsubscribe: auto-suppress the contact email
      if (result.classification === 'unsubscribe' && reply.from_email) {
        await supabase
          .from('ventas_co_suppressions')
          .upsert(
            { email: (reply.from_email as string).toLowerCase(), reason: 'unsubscribed', suppressed_at: new Date().toISOString() },
            { onConflict: 'email' },
          )

        // Update contact status if contact_id exists
        if (reply.contact_id) {
          await supabase
            .from('ventas_co_contacts')
            .update({ status: 'unsubscribed' })
            .eq('id', reply.contact_id)
        }
      }

      // Handle interested: update contact status
      if (result.classification === 'interested' && reply.contact_id) {
        await supabase
          .from('ventas_co_contacts')
          .update({ status: 'interested' })
          .eq('id', reply.contact_id)
      }

      classifiedCount++
    }

    return jsonResponse({
      classified: classifiedCount,
      method: useAI ? 'ai' : 'rule_based',
      total_pending: replies.length,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
