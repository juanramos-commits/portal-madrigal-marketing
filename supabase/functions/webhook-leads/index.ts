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

  // Extract token from path: /webhook-leads/{token}
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const token = pathParts[pathParts.length - 1]

  if (!token || token === 'webhook-leads') {
    return jsonResponse({ error: 'Token is required in URL path' }, 400)
  }

  // Find active webhook by token
  const { data: webhook, error: webhookErr } = await supabase
    .from('ventas_webhooks')
    .select('*')
    .eq('endpoint_token', token)
    .eq('activo', true)
    .single()

  if (webhookErr || !webhook) {
    return jsonResponse({ error: 'Webhook not found or inactive' }, 404)
  }

  // Parse payload
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    await logWebhook(supabase, webhook.id, {}, 'error', 'Invalid JSON payload', null)
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  try {
    // Normalize payload: extract Tally fields array into flat object
    const flatPayload = flattenPayload(payload)

    // Apply field mapping: mapeo_campos = { "external_field": "crm_field", ... }
    const mapeo = (webhook.mapeo_campos || {}) as Record<string, string>
    const leadData: Record<string, unknown> = {}

    for (const [campoExterno, campoCRM] of Object.entries(mapeo)) {
      const value = flatPayload[campoExterno] ?? getNestedValue(payload, campoExterno)
      if (value !== undefined && value !== null) {
        leadData[campoCRM] = value
      }
    }

    // Resolve categoria: if _categoria is set, look up categoria_id by name
    if (leadData._categoria) {
      const categoriaTexto = String(leadData._categoria).trim()
      delete leadData._categoria
      if (categoriaTexto) {
        // Try exact match first, then fuzzy (unaccented) match
        const { data: cats } = await supabase
          .from('ventas_categorias')
          .select('id, nombre')
        if (cats && cats.length > 0) {
          const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
          const normalTexto = normalize(categoriaTexto)
          const match = cats.find(c => normalize(c.nombre) === normalTexto)
            || cats.find(c => normalize(c.nombre).includes(normalTexto) || normalTexto.includes(normalize(c.nombre)))
          if (match) {
            leadData.categoria_id = match.id
          }
        }
      }
    }

    // Ensure minimum required field: nombre
    if (!leadData.nombre) {
      leadData.nombre = (flatPayload.name || flatPayload.nombre || payload.name ||
        payload.nombre || payload.full_name || payload.first_name ||
        payload.NOMBRE || 'Lead webhook') as string
    }

    // Map common fields that might come unmapped
    if (!leadData.email && (flatPayload.email || payload.email)) {
      leadData.email = flatPayload.email || payload.email
    }
    if (!leadData.telefono && (flatPayload.phone || flatPayload.telefono || payload.phone || payload.telefono)) {
      leadData.telefono = flatPayload.phone || flatPayload.telefono || payload.phone || payload.telefono
    }

    // Insert lead
    const { data: lead, error: leadErr } = await supabase
      .from('ventas_leads')
      .insert({
        ...leadData,
        creado_por: 'webhook',
        fuente: leadData.fuente || webhook.fuente || null,
        fuente_detalle: webhook.nombre || null,
      })
      .select()
      .single()

    if (leadErr) {
      await logWebhook(supabase, webhook.id, payload, 'error', leadErr.message, null)
      return jsonResponse({ error: 'Failed to create lead', detail: leadErr.message }, 500)
    }

    // Assign to first active pipeline + first etapa
    const { data: pipeline } = await supabase
      .from('ventas_pipelines')
      .select('id')
      .eq('activo', true)
      .order('orden')
      .limit(1)
      .single()

    if (pipeline) {
      const { data: etapa } = await supabase
        .from('ventas_etapas')
        .select('id')
        .eq('pipeline_id', pipeline.id)
        .eq('activo', true)
        .order('orden')
        .limit(1)
        .single()

      if (etapa) {
        await supabase.from('ventas_lead_pipeline').insert({
          lead_id: lead.id,
          pipeline_id: pipeline.id,
          etapa_id: etapa.id,
        })
      }
    }

    // Auto-assign setter via RPC (non-critical)
    try {
      await supabase.rpc('ventas_asignar_lead_automatico', { p_lead_id: lead.id })
    } catch {
      // Non-critical — lead is still created
    }

    // Log success
    await logWebhook(supabase, webhook.id, payload, 'exito', null, lead.id)

    return jsonResponse({
      success: true,
      lead_id: lead.id,
      nombre: lead.nombre,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    await logWebhook(supabase, webhook.id, payload, 'error', message, null)
    return jsonResponse({ error: message }, 500)
  }
})

// Helper: log webhook execution
async function logWebhook(
  supabase: ReturnType<typeof createClient>,
  webhookId: string,
  payload: Record<string, unknown>,
  resultado: 'exito' | 'error',
  mensajeError: string | null,
  leadId: string | null,
) {
  try {
    await supabase.from('ventas_webhook_logs').insert({
      webhook_id: webhookId,
      payload,
      resultado,
      mensaje_error: mensajeError,
      lead_creado_id: leadId,
    })
  } catch {
    // Logging failure should not break the webhook response
  }
}

// Helper: flatten Tally/form payloads — extracts data.fields[] into { key: value } map
function flattenPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  const data = payload.data as Record<string, unknown> | undefined
  const fields = (data?.fields || payload.fields) as Array<Record<string, unknown>> | undefined

  if (!Array.isArray(fields)) return flat

  for (const field of fields) {
    const key = field.key as string | undefined
    const label = field.label as string | undefined
    const type = field.type as string | undefined
    let value = field.value

    // For MULTIPLE_CHOICE, resolve selected option text
    if (type === 'MULTIPLE_CHOICE' && Array.isArray(value) && Array.isArray(field.options)) {
      const options = field.options as Array<Record<string, unknown>>
      const selectedTexts = (value as string[])
        .map(id => options.find(o => o.id === id)?.text)
        .filter(Boolean)
      value = selectedTexts.join(', ')
    }

    if (key && value !== undefined && value !== null) {
      flat[key] = value
    }
    // Also index by label if available (e.g., "utm_content")
    if (label && value !== undefined && value !== null) {
      flat[label] = value
    }
  }

  return flat
}

// Helper: get nested value from object (supports "data.attributes.name" syntax)
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
