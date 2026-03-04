import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

interface TokenData {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
}

async function getValidAccessToken(
  token: TokenData,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  if (token.expires_at && Date.now() < token.expires_at - 300000) {
    return token.access_token
  }

  if (!token.refresh_token) return null

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()
  if (data.error) return null

  const updatedToken: TokenData = {
    ...token,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  }

  await supabase
    .from('ventas_calendario_config')
    .update({
      google_calendar_token: updatedToken,
      updated_at: new Date().toISOString(),
    })
    .eq('usuario_id', userId)

  return data.access_token
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // Find channels expiring in the next 48 hours
    const expirationThreshold = Date.now() + (48 * 60 * 60 * 1000)

    const { data: configs } = await supabase
      .from('ventas_calendario_config')
      .select('*')
      .not('google_channel_id', 'is', null)
      .not('google_calendar_token', 'is', null)
      .lt('google_channel_expiration', expirationThreshold)

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ renewed: 0, message: 'No channels need renewal' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let renewed = 0
    const errors: string[] = []

    for (const config of configs) {
      const token = config.google_calendar_token as TokenData | null
      if (!token?.refresh_token) continue

      const userId = config.usuario_id
      const calendarId = config.google_calendar_id || 'primary'

      const accessToken = await getValidAccessToken(token, supabase, userId)
      if (!accessToken) {
        errors.push(`${userId}: token refresh failed`)
        continue
      }

      // Stop old channel (best effort)
      if (config.google_channel_id && config.google_resource_id) {
        try {
          await fetch(`${GOOGLE_CALENDAR_API}/channels/stop`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: config.google_channel_id,
              resourceId: config.google_resource_id,
            }),
          })
        } catch {
          // Non-critical — channel may have already expired
        }
      }

      // Create new watch channel
      const channelId = crypto.randomUUID()
      const watchRes = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: channelId,
            type: 'web_hook',
            address: `${supabaseUrl}/functions/v1/google-calendar-watch`,
            params: { ttl: '604800' },
          }),
        },
      )

      const watchData = await watchRes.json()

      if (watchData.error) {
        errors.push(`${userId}: watch error - ${watchData.error.message}`)
        continue
      }

      // Update config with new channel info
      await supabase
        .from('ventas_calendario_config')
        .update({
          google_channel_id: channelId,
          google_resource_id: watchData.resourceId,
          google_channel_expiration: Number(watchData.expiration),
          updated_at: new Date().toISOString(),
        })
        .eq('usuario_id', userId)

      renewed++
    }

    return new Response(
      JSON.stringify({ renewed, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
