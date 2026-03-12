import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * ia-quality-check-cron
 *
 * Cron function (called every hour). Checks WhatsApp quality rating
 * for each active agent. Applies automatic rate limiting or deactivation
 * based on Meta's quality signals.
 */

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

interface AgentQualityResult {
  agente_id: string
  nombre: string
  quality_rating: string | null
  messaging_limit_tier: string | null
  action: string
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const waToken = Deno.env.get('WA_ACCESS_TOKEN') ?? ''
  if (!waToken) {
    return jsonResponse({ error: 'WA_ACCESS_TOKEN not configured' }, 500)
  }

  try {
    // === 1. Get all active agents with WhatsApp phone configured ===
    const { data: agentes, error: agentesErr } = await supabase
      .from('ia_agentes')
      .select('id, nombre, whatsapp_phone_id, wa_quality_rating, rate_limit_msg_hora, activo')
      .eq('activo', true)
      .not('whatsapp_phone_id', 'is', null)

    if (agentesErr) {
      console.error('Error fetching agents:', agentesErr)
      return jsonResponse({ error: 'Failed to fetch agents', details: agentesErr.message }, 500)
    }

    if (!agentes || agentes.length === 0) {
      return jsonResponse({ status: 'ok', message: 'No active agents with WhatsApp', results: [] })
    }

    const results: AgentQualityResult[] = []

    // === 2. Check each agent ===
    for (const agente of agentes) {
      try {
        const phoneNumberId = agente.whatsapp_phone_id

        // Call Meta API to get quality rating
        const metaRes = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=quality_rating,messaging_limit_tier`,
          {
            headers: {
              Authorization: `Bearer ${waToken}`,
            },
          },
        )

        if (!metaRes.ok) {
          const metaError = await metaRes.text()
          console.error(`Meta API error for agent ${agente.id}:`, metaError)
          results.push({
            agente_id: agente.id,
            nombre: agente.nombre,
            quality_rating: null,
            messaging_limit_tier: null,
            action: 'error',
            error: `Meta API error: ${metaError.substring(0, 200)}`,
          })
          continue
        }

        const metaData = await metaRes.json()
        const qualityRating = metaData.quality_rating as string || 'UNKNOWN'
        const messagingLimitTier = metaData.messaging_limit_tier as string || null
        const previousRating = agente.wa_quality_rating

        // Update quality rating on agent
        await supabase
          .from('ia_agentes')
          .update({
            wa_quality_rating: qualityRating,
          })
          .eq('id', agente.id)

        let action = 'ok'

        // === Check for YELLOW quality ===
        if (qualityRating === 'YELLOW' && previousRating !== 'YELLOW') {
          const currentRate = agente.rate_limit_msg_hora || 60
          const newRate = Math.max(10, Math.floor(currentRate * 0.5))

          await supabase
            .from('ia_agentes')
            .update({ rate_limit_msg_hora: newRate })
            .eq('id', agente.id)

          await supabase.from('ia_alertas_supervisor').insert({
            agente_id: agente.id,
            tipo: 'wa_quality_warning',
            mensaje: `Calidad WhatsApp degradada a YELLOW para "${agente.nombre}". Rate limit reducido de ${currentRate} a ${newRate} msg/hora.`,
            leida: false,
          })

          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'warning',
            mensaje: `WhatsApp quality YELLOW: rate limit reducido ${currentRate} → ${newRate} msg/hora`,
          })

          action = 'rate_limited'
        }

        // === Check for RED quality ===
        if (qualityRating === 'RED' && previousRating !== 'RED') {
          await supabase
            .from('ia_agentes')
            .update({ activo: false })
            .eq('id', agente.id)

          await supabase.from('ia_alertas_supervisor').insert({
            agente_id: agente.id,
            tipo: 'wa_quality_critical',
            mensaje: `CRÍTICO: Calidad WhatsApp RED para "${agente.nombre}". Agente desactivado automáticamente.`,
            leida: false,
          })

          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'error',
            mensaje: `WhatsApp quality RED: agente desactivado automáticamente`,
          })

          action = 'deactivated'
        }

        // === Log quality check (if rating changed) ===
        if (qualityRating !== previousRating) {
          await supabase.from('ia_logs').insert({
            agente_id: agente.id,
            tipo: 'info',
            mensaje: `WhatsApp quality check: ${previousRating || 'N/A'} → ${qualityRating}, tier: ${messagingLimitTier || 'N/A'}`,
          })
        }

        results.push({
          agente_id: agente.id,
          nombre: agente.nombre,
          quality_rating: qualityRating,
          messaging_limit_tier: messagingLimitTier,
          action,
        })
      } catch (agentErr) {
        console.error(`Error checking quality for agent ${agente.id}:`, agentErr)

        try { await supabase.from('ia_logs').insert({
          agente_id: agente.id,
          tipo: 'error',
          mensaje: `Error en quality check: ${String(agentErr)}`,
        }) } catch (_e) { /* ignore */ }

        results.push({
          agente_id: agente.id,
          nombre: agente.nombre,
          quality_rating: null,
          messaging_limit_tier: null,
          action: 'error',
          error: String(agentErr),
        })
      }
    }

    const summary = {
      total: results.length,
      ok: results.filter(r => r.action === 'ok').length,
      rate_limited: results.filter(r => r.action === 'rate_limited').length,
      deactivated: results.filter(r => r.action === 'deactivated').length,
      errors: results.filter(r => r.action === 'error').length,
    }

    return jsonResponse({
      status: 'ok',
      summary,
      results,
    })
  } catch (err) {
    console.error('Fatal error in ia-quality-check-cron:', err)

    try { await supabase.from('ia_logs').insert({
      tipo: 'error',
      mensaje: `Error en ia-quality-check-cron: ${String(err)}`,
      detalles: { error: String(err), stack: String(err) },
    }) } catch (_e) { /* ignore */ }

    return jsonResponse({ error: 'Cron failed', details: String(err) }, 500)
  }
})
