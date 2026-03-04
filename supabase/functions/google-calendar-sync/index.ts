import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface TokenData {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
}

// Refresh access token if expired
async function getValidAccessToken(
  token: TokenData,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  // Check if token is still valid (with 5min buffer)
  if (token.expires_at && Date.now() < token.expires_at - 300000) {
    return token.access_token
  }

  // Refresh the token
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

  // Update stored token
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

// Format cita as Google Calendar event
function formatGoogleEvent(cita: Record<string, unknown>, configData: Record<string, unknown>) {
  const fechaHora = new Date(cita.fecha_hora as string)
  const duracion = (configData.duracion_slot_minutos as number) || 60
  const fechaFin = new Date(fechaHora.getTime() + duracion * 60000)

  const leadNombre = (cita.lead as Record<string, unknown>)?.nombre || 'Cita'
  const setterNombre = (cita.setter_origen as Record<string, unknown>)?.nombre || ''
  const fuente = (cita.enlace as Record<string, unknown>)?.fuente || ''

  const descParts = []
  if (setterNombre) descParts.push(`Setter: ${setterNombre}`)
  if (fuente) descParts.push(`Fuente: ${fuente}`)
  if (cita.notas_closer) descParts.push(`Notas: ${cita.notas_closer}`)
  descParts.push(`\nPortal: https://app.madrigalmarketing.es/ventas/calendario`)

  return {
    summary: `Cita - ${leadNombre}`,
    description: descParts.join('\n'),
    start: {
      dateTime: fechaHora.toISOString(),
      timeZone: 'Europe/Madrid',
    },
    end: {
      dateTime: fechaFin.toISOString(),
      timeZone: 'Europe/Madrid',
    },
    // Add Google Meet link if configured
    conferenceData: {
      createRequest: {
        requestId: cita.id as string,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    status: cita.estado === 'cancelada' ? 'cancelled' : 'confirmed',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { action, cita_id, closer_id } = await req.json()

    if (!action || !cita_id || !closer_id) {
      return jsonResponse({ error: 'action, cita_id, and closer_id are required' }, 400)
    }

    // Get closer's Google Calendar config
    const { data: configData } = await supabase
      .from('ventas_calendario_config')
      .select('*')
      .eq('usuario_id', closer_id)
      .maybeSingle()

    const token = configData?.google_calendar_token as TokenData | null
    if (!token?.refresh_token) {
      // Closer doesn't have Google Calendar connected — skip silently
      return jsonResponse({ skipped: true, reason: 'Google Calendar not connected' })
    }

    const calendarId = configData?.google_calendar_id || 'primary'

    // Get valid access token
    const accessToken = await getValidAccessToken(token, supabase, closer_id)
    if (!accessToken) {
      return jsonResponse({ error: 'Failed to refresh Google access token' }, 401)
    }

    // Get cita data
    const { data: cita } = await supabase
      .from('ventas_citas')
      .select(`
        *,
        lead:ventas_leads(id, nombre, email, telefono),
        setter_origen:usuarios!ventas_citas_setter_origen_id_fkey(id, nombre),
        enlace:ventas_enlaces_agenda(id, nombre, fuente)
      `)
      .eq('id', cita_id)
      .single()

    if (!cita) {
      return jsonResponse({ error: 'Cita not found' }, 404)
    }

    const googleEventId = cita.google_event_id

    // ─── CREATE ───
    if (action === 'create') {
      const event = formatGoogleEvent(cita, configData)

      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        },
      )

      const eventData = await res.json()
      if (eventData.error) {
        return jsonResponse({ error: 'Google API error', detail: eventData.error.message }, 500)
      }

      // Store google_event_id and Meet URL back in cita
      const updateData: Record<string, unknown> = {
        google_event_id: eventData.id,
        updated_at: new Date().toISOString(),
      }

      // If Google Meet was created, store the link
      if (eventData.hangoutLink) {
        updateData.google_meet_url = eventData.hangoutLink
      }

      await supabase
        .from('ventas_citas')
        .update(updateData)
        .eq('id', cita_id)

      return jsonResponse({ success: true, event_id: eventData.id, meet_url: eventData.hangoutLink || null })
    }

    // ─── UPDATE ───
    if (action === 'update') {
      if (!googleEventId) {
        // No existing event — create instead
        const event = formatGoogleEvent(cita, configData)
        const res = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          },
        )

        const eventData = await res.json()
        if (!eventData.error) {
          const updateData: Record<string, unknown> = {
            google_event_id: eventData.id,
            updated_at: new Date().toISOString(),
          }
          if (eventData.hangoutLink) updateData.google_meet_url = eventData.hangoutLink

          await supabase.from('ventas_citas').update(updateData).eq('id', cita_id)
        }

        return jsonResponse({ success: true, event_id: eventData.id })
      }

      const event = formatGoogleEvent(cita, configData)
      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        },
      )

      const eventData = await res.json()
      if (eventData.error) {
        return jsonResponse({ error: 'Google API error', detail: eventData.error.message }, 500)
      }

      return jsonResponse({ success: true, event_id: eventData.id })
    }

    // ─── DELETE ───
    if (action === 'delete') {
      if (!googleEventId) {
        return jsonResponse({ skipped: true, reason: 'No Google event linked' })
      }

      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      )

      // 204 = success, 410 = already deleted
      if (res.status !== 204 && res.status !== 410) {
        const errorData = await res.json().catch(() => ({}))
        return jsonResponse({ error: 'Google API error', detail: (errorData as Record<string, unknown>).message || res.statusText }, 500)
      }

      // Clear google_event_id
      await supabase
        .from('ventas_citas')
        .update({ google_event_id: null, google_meet_url: null, updated_at: new Date().toISOString() })
        .eq('id', cita_id)

      return jsonResponse({ success: true, deleted: true })
    }

    return jsonResponse({ error: 'Invalid action. Use create, update, or delete' }, 400)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
