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

Deno.serve(async (req) => {
  // Google sends POST for push notifications
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 })
  }

  const channelId = req.headers.get('x-goog-channel-id')
  const resourceState = req.headers.get('x-goog-resource-state')
  const resourceId = req.headers.get('x-goog-resource-id')

  // Validate required headers
  if (!channelId || !resourceState) {
    return new Response('Missing headers', { status: 400 })
  }

  // "sync" is the initial confirmation — just acknowledge
  if (resourceState === 'sync') {
    return new Response('OK', { status: 200 })
  }

  // Only process "exists" (actual changes)
  if (resourceState !== 'exists') {
    return new Response('OK', { status: 200 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // Find the config record for this channel
    const { data: configData } = await supabase
      .from('ventas_calendario_config')
      .select('*')
      .eq('google_channel_id', channelId)
      .maybeSingle()

    if (!configData) {
      // Unknown channel — probably expired or disconnected
      return new Response('Channel not found', { status: 404 })
    }

    const token = configData.google_calendar_token as TokenData | null
    if (!token?.refresh_token) {
      return new Response('No token', { status: 200 })
    }

    const userId = configData.usuario_id
    const calendarId = configData.google_calendar_id || 'primary'

    // Get valid access token
    const accessToken = await getValidAccessToken(token, supabase, userId)
    if (!accessToken) {
      return new Response('Token refresh failed', { status: 200 })
    }

    // Fetch changed events using syncToken (incremental sync)
    const listParams = new URLSearchParams({
      singleEvents: 'true',
      showDeleted: 'true',
    })

    if (configData.google_sync_token) {
      listParams.set('syncToken', configData.google_sync_token)
    } else {
      // First sync — get events from now onwards to establish syncToken
      listParams.set('timeMin', new Date().toISOString())
      listParams.set('maxResults', '1')
    }

    const eventsRes = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${listParams}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    // If syncToken is invalid (410 Gone), do a full sync to get a new token
    if (eventsRes.status === 410) {
      const fullSyncParams = new URLSearchParams({
        singleEvents: 'true',
        showDeleted: 'true',
        timeMin: new Date().toISOString(),
        maxResults: '1',
      })

      const fullRes = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${fullSyncParams}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      )

      const fullData = await fullRes.json()
      if (fullData.nextSyncToken) {
        await supabase
          .from('ventas_calendario_config')
          .update({
            google_sync_token: fullData.nextSyncToken,
            updated_at: new Date().toISOString(),
          })
          .eq('usuario_id', userId)
      }

      return new Response('OK - resynced', { status: 200 })
    }

    const eventsData = await eventsRes.json()
    if (eventsData.error) {
      console.error('Google Calendar API error:', eventsData.error)
      return new Response('API error', { status: 200 })
    }

    // Process changed events
    const events = eventsData.items || []
    for (const event of events) {
      if (!event.id) continue

      // Find matching cita by google_event_id
      const { data: cita } = await supabase
        .from('ventas_citas')
        .select('id, estado, fecha_hora, closer_id')
        .eq('google_event_id', event.id)
        .eq('closer_id', userId)
        .maybeSingle()

      if (!cita) continue // Not one of our citas

      // Skip if cita is already in a final state
      if (cita.estado === 'cancelada' || cita.estado === 'completada') continue

      // Event was cancelled/deleted in Google
      if (event.status === 'cancelled') {
        await supabase
          .from('ventas_citas')
          .update({
            estado: 'cancelada',
            cancelada_por: 'google_calendar',
            updated_at: new Date().toISOString(),
          })
          .eq('id', cita.id)

        // Log the action
        await supabase.from('ventas_log_actividad').insert({
          usuario_id: userId,
          accion: 'cancelar',
          modulo: 'citas',
          entidad_id: cita.id,
          detalle: { origen: 'google_calendar', motivo: 'Evento eliminado en Google Calendar' },
        })

        continue
      }

      // Event was moved (date/time changed)
      if (event.start?.dateTime) {
        const nuevaFecha = new Date(event.start.dateTime)
        const fechaActual = new Date(cita.fecha_hora)

        // Only update if the date actually changed (more than 1 minute difference)
        if (Math.abs(nuevaFecha.getTime() - fechaActual.getTime()) > 60000) {
          await supabase
            .from('ventas_citas')
            .update({
              fecha_hora: nuevaFecha.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', cita.id)

          // Log the action
          await supabase.from('ventas_log_actividad').insert({
            usuario_id: userId,
            accion: 'editar',
            modulo: 'citas',
            entidad_id: cita.id,
            detalle: {
              origen: 'google_calendar',
              campo: 'fecha_hora',
              anterior: cita.fecha_hora,
              nuevo: nuevaFecha.toISOString(),
            },
          })
        }
      }
    }

    // Save the new syncToken for next incremental sync
    // Handle paginated results
    let nextSyncToken = eventsData.nextSyncToken
    let nextPageToken = eventsData.nextPageToken

    while (nextPageToken) {
      const pageParams = new URLSearchParams({
        pageToken: nextPageToken,
        singleEvents: 'true',
        showDeleted: 'true',
      })

      const pageRes = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${pageParams}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      )

      const pageData = await pageRes.json()
      const pageEvents = pageData.items || []

      // Process additional events (same logic as above)
      for (const event of pageEvents) {
        if (!event.id) continue

        const { data: cita } = await supabase
          .from('ventas_citas')
          .select('id, estado, fecha_hora, closer_id')
          .eq('google_event_id', event.id)
          .eq('closer_id', userId)
          .maybeSingle()

        if (!cita) continue
        if (cita.estado === 'cancelada' || cita.estado === 'completada') continue

        if (event.status === 'cancelled') {
          await supabase
            .from('ventas_citas')
            .update({
              estado: 'cancelada',
              cancelada_por: 'google_calendar',
              updated_at: new Date().toISOString(),
            })
            .eq('id', cita.id)

          await supabase.from('ventas_log_actividad').insert({
            usuario_id: userId,
            accion: 'cancelar',
            modulo: 'citas',
            entidad_id: cita.id,
            detalle: { origen: 'google_calendar', motivo: 'Evento eliminado en Google Calendar' },
          })
          continue
        }

        if (event.start?.dateTime) {
          const nuevaFecha = new Date(event.start.dateTime)
          const fechaActual = new Date(cita.fecha_hora)
          if (Math.abs(nuevaFecha.getTime() - fechaActual.getTime()) > 60000) {
            await supabase
              .from('ventas_citas')
              .update({
                fecha_hora: nuevaFecha.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', cita.id)

            await supabase.from('ventas_log_actividad').insert({
              usuario_id: userId,
              accion: 'editar',
              modulo: 'citas',
              entidad_id: cita.id,
              detalle: {
                origen: 'google_calendar',
                campo: 'fecha_hora',
                anterior: cita.fecha_hora,
                nuevo: nuevaFecha.toISOString(),
              },
            })
          }
        }
      }

      nextSyncToken = pageData.nextSyncToken
      nextPageToken = pageData.nextPageToken
    }

    if (nextSyncToken) {
      await supabase
        .from('ventas_calendario_config')
        .update({
          google_sync_token: nextSyncToken,
          updated_at: new Date().toISOString(),
        })
        .eq('usuario_id', userId)
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('google-calendar-watch error:', err)
    // Always return 200 to prevent Google from retrying indefinitely
    return new Response('OK', { status: 200 })
  }
})
