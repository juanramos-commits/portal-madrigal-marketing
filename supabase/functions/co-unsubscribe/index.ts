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

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function unsubscribePage(contactId: string, campaignId: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Darse de baja</title>
</head>
<body style="margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);padding:40px;max-width:420px;width:90%;text-align:center;">
    <h1 style="font-size:22px;color:#1f2937;margin:0 0 12px;">Darse de baja</h1>
    <p style="color:#6b7280;font-size:15px;line-height:1.5;margin:0 0 24px;">
      ¿Deseas darte de baja de estos emails? No recibirás más comunicaciones de nuestra parte.
    </p>
    <form method="POST" action="">
      <input type="hidden" name="contact_id" value="${contactId}">
      <input type="hidden" name="campaign_id" value="${campaignId}">
      <button type="submit" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:12px 32px;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.2s;">
        Confirmar baja
      </button>
    </form>
    <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">Si llegaste aquí por error, simplemente cierra esta página.</p>
  </div>
</body>
</html>`
}

function confirmationPage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baja confirmada</title>
</head>
<body style="margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);padding:40px;max-width:420px;width:90%;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">&#10003;</div>
    <h1 style="font-size:22px;color:#1f2937;margin:0 0 12px;">Has sido dado de baja correctamente</h1>
    <p style="color:#6b7280;font-size:15px;line-height:1.5;margin:0;">
      No recibirás más emails de nuestra parte. Puedes cerrar esta página.
    </p>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    // ── GET: Show unsubscribe confirmation page ──────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const contactId = url.searchParams.get('contact_id') || ''
      const campaignId = url.searchParams.get('campaign_id') || ''

      if (!contactId) {
        return htmlResponse('<p>Enlace inválido.</p>', 400)
      }

      return htmlResponse(unsubscribePage(contactId, campaignId))
    }

    // ── POST: Process the unsubscribe ────────────────────────────────
    if (req.method === 'POST') {
      let contactId = ''
      let campaignId = ''

      // Support both JSON and form-encoded bodies
      const contentType = req.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const body = await req.json()
        contactId = body.contact_id || ''
        campaignId = body.campaign_id || ''
      } else {
        const formData = await req.formData()
        contactId = (formData.get('contact_id') as string) || ''
        campaignId = (formData.get('campaign_id') as string) || ''
      }

      if (!contactId) {
        return htmlResponse('<p>Datos inválidos.</p>', 400)
      }

      // Get contact email
      const { data: contact, error: contactErr } = await supabase
        .from('ventas_co_contacts')
        .select('id, email')
        .eq('id', contactId)
        .single()

      if (contactErr || !contact) {
        return htmlResponse(confirmationPage())
      }

      // Insert suppression
      await supabase
        .from('ventas_co_suppressions')
        .upsert(
          { email: (contact.email as string).toLowerCase(), reason: 'unsubscribed', created_at: new Date().toISOString() },
          { onConflict: 'email' },
        )

      // Update contact status
      await supabase
        .from('ventas_co_contacts')
        .update({ status: 'unsubscribed' })
        .eq('id', contactId)

      // If campaign_id: update enrollment status
      if (campaignId) {
        await supabase
          .from('ventas_co_enrollments')
          .update({ status: 'unsubscribed' })
          .eq('contact_id', contactId)
          .eq('campaign_id', campaignId)

        // Increment campaign total_unsubscribed
        const { data: campaign } = await supabase
          .from('ventas_co_campaigns')
          .select('total_unsubscribed')
          .eq('id', campaignId)
          .single()

        if (campaign) {
          await supabase
            .from('ventas_co_campaigns')
            .update({ total_unsubscribed: ((campaign.total_unsubscribed as number) || 0) + 1 })
            .eq('id', campaignId)
        }
      }

      // Audit log
      await supabase
        .from('ventas_co_audit_log')
        .insert({
          action: 'unsubscribe',
          entity_type: 'contact',
          entity_id: contactId,
          details: {
            email: contact.email,
            campaign_id: campaignId || null,
            source: 'unsubscribe_link',
          },
          created_at: new Date().toISOString(),
        })

      // Return HTML confirmation for form submissions, JSON for API calls
      if (contentType.includes('application/json')) {
        return jsonResponse({ success: true, message: 'Unsubscribed successfully' })
      }

      return htmlResponse(confirmationPage())
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
