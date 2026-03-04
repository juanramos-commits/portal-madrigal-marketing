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

    // ─── RECONCILE: sync all existing events from Google back to app ───
    if (action === 'reconcile') {
      if (!closer_id) {
        return jsonResponse({ error: 'closer_id is required for reconcile' }, 400)
      }

      const { data: configData } = await supabase
        .from('ventas_calendario_config')
        .select('*')
        .eq('usuario_id', closer_id)
        .maybeSingle()

      const token = configData?.google_calendar_token as TokenData | null
      if (!token?.refresh_token) {
        return jsonResponse({ skipped: true, reason: 'Google Calendar not connected' })
      }

      const calendarId = configData?.google_calendar_id || 'primary'
      const accessToken = await getValidAccessToken(token, supabase, closer_id)
      if (!accessToken) {
        return jsonResponse({ error: 'Failed to refresh Google access token' }, 401)
      }

      // Get all citas with google_event_id for this closer
      const { data: citas } = await supabase
        .from('ventas_citas')
        .select('id, google_event_id, fecha_hora, estado')
        .eq('closer_id', closer_id)
        .not('google_event_id', 'is', null)
        .not('estado', 'in', '("cancelada","completada")')

      if (!citas || citas.length === 0) {
        return jsonResponse({ success: true, reconciled: 0, message: 'No citas with Google events' })
      }

      let updated = 0
      let cancelled = 0
      const errors: string[] = []

      for (const cita of citas) {
        try {
          const res = await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(cita.google_event_id)}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          )

          if (res.status === 404 || res.status === 410) {
            // Event deleted in Google
            await supabase
              .from('ventas_citas')
              .update({
                estado: 'cancelada',
                cancelada_por: 'google_calendar',
                updated_at: new Date().toISOString(),
              })
              .eq('id', cita.id)
            cancelled++
            continue
          }

          const event = await res.json()
          if (event.error) {
            errors.push(`${cita.id}: ${event.error.message}`)
            continue
          }

          // Check if cancelled in Google
          if (event.status === 'cancelled') {
            await supabase
              .from('ventas_citas')
              .update({
                estado: 'cancelada',
                cancelada_por: 'google_calendar',
                updated_at: new Date().toISOString(),
              })
              .eq('id', cita.id)
            cancelled++
            continue
          }

          // Check if date changed
          if (event.start?.dateTime) {
            const googleDate = new Date(event.start.dateTime)
            const citaDate = new Date(cita.fecha_hora)

            if (Math.abs(googleDate.getTime() - citaDate.getTime()) > 60000) {
              await supabase
                .from('ventas_citas')
                .update({
                  fecha_hora: googleDate.toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', cita.id)
              updated++
            }
          }
        } catch (e) {
          errors.push(`${cita.id}: ${e instanceof Error ? e.message : 'unknown error'}`)
        }
      }

      return jsonResponse({
        success: true,
        total: citas.length,
        updated,
        cancelled,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

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
