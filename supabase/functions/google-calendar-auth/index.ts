import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly'

function getConfig() {
  return {
    clientId: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
    clientSecret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  }
}

function getRedirectUri() {
  const config = getConfig()
  return `${config.supabaseUrl}/functions/v1/google-calendar-auth`
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const config = getConfig()
  if (!config.clientId || !config.clientSecret) {
    return jsonResponse({ error: 'Google Calendar credentials not configured' }, 500)
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const code = url.searchParams.get('code')

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey)

  try {
    // ─── CONNECT: redirect to Google consent screen ───
    if (action === 'connect') {
      const userId = url.searchParams.get('user_id')
      const redirectUrl = url.searchParams.get('redirect_url')

      if (!userId) return jsonResponse({ error: 'user_id is required' }, 400)

      const state = btoa(JSON.stringify({ user_id: userId, redirect_url: redirectUrl || '' }))

      const authUrl = new URL(GOOGLE_AUTH_URL)
      authUrl.searchParams.set('client_id', config.clientId)
      authUrl.searchParams.set('redirect_uri', getRedirectUri())
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', SCOPES)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('state', state)

      return redirect(authUrl.toString())
    }

    // ─── CALLBACK: exchange code for tokens ───
    if (code) {
      const stateParam = url.searchParams.get('state')
      if (!stateParam) return jsonResponse({ error: 'Missing state parameter' }, 400)

      let state: { user_id: string; redirect_url: string }
      try {
        state = JSON.parse(atob(stateParam))
      } catch {
        return jsonResponse({ error: 'Invalid state parameter' }, 400)
      }

      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: getRedirectUri(),
          grant_type: 'authorization_code',
        }),
      })

      const tokens = await tokenRes.json()
      if (tokens.error) {
        const errorRedirect = state.redirect_url
          ? `${state.redirect_url}?gcal=error&message=${encodeURIComponent(tokens.error_description || tokens.error)}`
          : null
        if (errorRedirect) return redirect(errorRedirect)
        return jsonResponse({ error: tokens.error_description || tokens.error }, 400)
      }

      // Get primary calendar ID
      let calendarId = 'primary'
      try {
        const calRes = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList/primary`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        const calData = await calRes.json()
        if (calData.id) calendarId = calData.id
      } catch {
        // Use 'primary' as fallback
      }

      // Store tokens in DB
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        token_type: tokens.token_type,
        scope: tokens.scope,
      }

      const { error: dbErr } = await supabase
        .from('ventas_calendario_config')
        .upsert({
          usuario_id: state.user_id,
          google_calendar_token: tokenData,
          google_calendar_id: calendarId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'usuario_id' })

      if (dbErr) {
        const errorRedirect = state.redirect_url
          ? `${state.redirect_url}?gcal=error&message=${encodeURIComponent('Error saving tokens')}`
          : null
        if (errorRedirect) return redirect(errorRedirect)
        return jsonResponse({ error: 'Error saving tokens', detail: dbErr.message }, 500)
      }

      // Redirect back to app
      if (state.redirect_url) {
        return redirect(`${state.redirect_url}?gcal=success`)
      }
      return jsonResponse({ success: true, calendar_id: calendarId })
    }

    // ─── DISCONNECT: revoke token and clear DB ───
    if (action === 'disconnect') {
      const userId = url.searchParams.get('user_id')
      if (!userId) return jsonResponse({ error: 'user_id is required' }, 400)

      // Get current token
      const { data: configData } = await supabase
        .from('ventas_calendario_config')
        .select('google_calendar_token')
        .eq('usuario_id', userId)
        .maybeSingle()

      // Revoke with Google (best effort)
      const token = configData?.google_calendar_token
      if (token?.access_token) {
        try {
          await fetch(`${GOOGLE_REVOKE_URL}?token=${token.access_token}`, { method: 'POST' })
        } catch {
          // Revocation failure is non-critical
        }
      }

      // Clear tokens in DB
      await supabase
        .from('ventas_calendario_config')
        .update({
          google_calendar_token: null,
          google_calendar_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('usuario_id', userId)

      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: 'Invalid action. Use ?action=connect or ?action=disconnect' }, 400)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
