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

      // Set up Google Calendar push notification channel (bidirectional sync)
      let channelId: string | null = null
      let resourceId: string | null = null
      let channelExpiration: number | null = null

      try {
        channelId = crypto.randomUUID()
        const watchRes = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: channelId,
              type: 'web_hook',
              address: `${config.supabaseUrl}/functions/v1/google-calendar-watch`,
              params: { ttl: '604800' }, // 7 days
            }),
          },
        )
        const watchData = await watchRes.json()
        if (watchData.resourceId) {
          resourceId = watchData.resourceId
          channelExpiration = Number(watchData.expiration)
        } else {
          channelId = null // Watch failed, don't store
        }
      } catch {
        channelId = null // Watch setup non-critical
      }

      // Get initial syncToken for incremental sync
      let syncToken: string | null = null
      try {
        const syncRes = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?maxResults=1&timeMin=${encodeURIComponent(new Date().toISOString())}`,
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          },
        )
        const syncData = await syncRes.json()
        if (syncData.nextSyncToken) {
          syncToken = syncData.nextSyncToken
        }
      } catch {
        // Non-critical
      }

      const { error: dbErr } = await supabase
        .from('ventas_calendario_config')
        .upsert({
          usuario_id: state.user_id,
          google_calendar_token: tokenData,
          google_calendar_id: calendarId,
          google_channel_id: channelId,
          google_resource_id: resourceId,
          google_channel_expiration: channelExpiration,
          google_sync_token: syncToken,
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

      // Verify the caller is authenticated and matches the user_id (or is admin)
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return jsonResponse({ error: 'Authorization required' }, 401)
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (authError || !authUser) return jsonResponse({ error: 'Invalid authorization' }, 401)
      if (authUser.id !== userId) {
        // Check if caller is admin
        const { data: caller } = await supabase.from('usuarios').select('tipo').eq('id', authUser.id).single()
        if (caller?.tipo !== 'super_admin') return jsonResponse({ error: 'Not authorized to disconnect this user' }, 403)
      }

      // Get current config (token + channel info)
      const { data: configData } = await supabase
        .from('ventas_calendario_config')
        .select('google_calendar_token, google_channel_id, google_resource_id')
        .eq('usuario_id', userId)
        .maybeSingle()

      const token = configData?.google_calendar_token

      // Stop watch channel (best effort)
      if (configData?.google_channel_id && configData?.google_resource_id && token?.access_token) {
        try {
          await fetch(`${GOOGLE_CALENDAR_API}/channels/stop`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: configData.google_channel_id,
              resourceId: configData.google_resource_id,
            }),
          })
        } catch {
          // Non-critical
        }
      }

      // Revoke with Google (best effort)
      if (token?.access_token) {
        try {
          await fetch(`${GOOGLE_REVOKE_URL}?token=${token.access_token}`, { method: 'POST' })
        } catch {
          // Revocation failure is non-critical
        }
      }

      // Clear all Google-related fields in DB
      await supabase
        .from('ventas_calendario_config')
        .update({
          google_calendar_token: null,
          google_calendar_id: null,
          google_channel_id: null,
          google_resource_id: null,
          google_channel_expiration: null,
          google_sync_token: null,
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
