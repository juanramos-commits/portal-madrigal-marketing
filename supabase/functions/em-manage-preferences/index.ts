import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://esm.sh/jose@5'

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

function getJwtSecret(): Uint8Array {
  const secret = Deno.env.get('EM_PREFERENCES_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET') || 'fallback-secret'
  return new TextEncoder().encode(secret)
}

async function verifyToken(token: string): Promise<{ contact_id: string } | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jose.jwtVerify(token, secret)
    if (!payload.contact_id) return null
    return { contact_id: payload.contact_id as string }
  } catch {
    return null
  }
}

async function generateToken(contactId: string): Promise<string> {
  const secret = getJwtSecret()
  const token = await new jose.SignJWT({ contact_id: contactId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(secret)
  return token
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
    // ── GET: Fetch preferences ───────────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')

      if (!token) {
        return jsonResponse({ error: 'Token is required' }, 400)
      }

      const decoded = await verifyToken(token)
      if (!decoded) {
        return jsonResponse({ error: 'Invalid or expired token' }, 401)
      }

      const { data: preferences, error: prefErr } = await supabase
        .from('ventas_em_preferences')
        .select('*')
        .eq('contact_id', decoded.contact_id)
        .single()

      if (prefErr && prefErr.code !== 'PGRST116') {
        return jsonResponse({ error: 'Failed to fetch preferences' }, 500)
      }

      // Also fetch contact info for display
      const { data: contact } = await supabase
        .from('ventas_em_contacts')
        .select('email, nombre, status')
        .eq('id', decoded.contact_id)
        .single()

      return jsonResponse({
        contact_id: decoded.contact_id,
        email: contact?.email || null,
        nombre: contact?.nombre || null,
        categories: preferences?.categories || [],
        frequency: preferences?.frequency || 'normal',
        status: contact?.status || 'active',
      })
    }

    // ── POST: Update preferences or generate token ───────────────────
    if (req.method === 'POST') {
      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON payload' }, 400)
      }

      const action = body.action as string

      // ── Generate token (internal, requires auth) ───────────────────
      if (action === 'generate_token') {
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
          return jsonResponse({ error: 'Authorization required for token generation' }, 401)
        }

        const contactId = body.contact_id as string
        if (!contactId) {
          return jsonResponse({ error: 'contact_id is required' }, 400)
        }

        // Verify contact exists
        const { data: contact, error: contactErr } = await supabase
          .from('ventas_em_contacts')
          .select('id, email')
          .eq('id', contactId)
          .single()

        if (contactErr || !contact) {
          return jsonResponse({ error: 'Contact not found' }, 404)
        }

        const token = await generateToken(contactId)

        return jsonResponse({
          token,
          url: `/preferencias-email/${token}`,
        })
      }

      // ── Update preferences (public, with token) ───────────────────
      const token = body.token as string
      if (!token) {
        return jsonResponse({ error: 'Token is required' }, 400)
      }

      const decoded = await verifyToken(token)
      if (!decoded) {
        return jsonResponse({ error: 'Invalid or expired token' }, 401)
      }

      const categories = body.categories as string[] | undefined
      const frequency = body.frequency as string | undefined

      // Upsert preferences
      await supabase
        .from('ventas_em_preferences')
        .upsert(
          {
            contact_id: decoded.contact_id,
            categories: categories || [],
            frequency: frequency || 'normal',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'contact_id' },
        )

      // If frequency is 'none', unsubscribe the contact
      if (frequency === 'none') {
        await supabase
          .from('ventas_em_contacts')
          .update({ status: 'unsubscribed' })
          .eq('id', decoded.contact_id)

        // Get contact email for suppression
        const { data: contact } = await supabase
          .from('ventas_em_contacts')
          .select('email')
          .eq('id', decoded.contact_id)
          .single()

        if (contact?.email) {
          await supabase
            .from('ventas_em_suppressions')
            .upsert(
              {
                email: contact.email,
                reason: 'unsubscribed',
                created_at: new Date().toISOString(),
              },
              { onConflict: 'email' },
            )
        }
      }

      return jsonResponse({ success: true, contact_id: decoded.contact_id })
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
