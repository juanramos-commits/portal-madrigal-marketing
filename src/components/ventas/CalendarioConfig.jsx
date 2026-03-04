import { useState, useEffect } from 'react'
import Select from '../ui/Select'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const SyncIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-md" aria-hidden="true">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

export default function CalendarioConfig({ config, onGuardar, targetUserId, onGcalStatusChange }) {
  const [duracion, setDuracion] = useState(60)
  const [descanso, setDescanso] = useState(15)
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)
  const [gcalLoading, setGcalLoading] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const gcalConnected = !!config?.google_calendar_token?.refresh_token
  const gcalCalendarId = config?.google_calendar_id

  useEffect(() => {
    if (config) {
      setDuracion(config.duracion_slot_minutos || 60)
      setDescanso(config.descanso_entre_citas_minutos ?? 15)
    }
  }, [config])

  // Check URL param for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gcalStatus = params.get('gcal')
    if (gcalStatus === 'success' || gcalStatus === 'error') {
      // Clean URL params
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      if (gcalStatus === 'success' && onGcalStatusChange) {
        onGcalStatusChange()
      }
    }
  }, [onGcalStatusChange])

  const handleGuardar = async () => {
    setSaving(true)
    setError(null)
    try {
      await onGuardar({
        ...config,
        duracion_slot_minutos: Number(duracion),
        descanso_entre_citas_minutos: Number(descanso),
      })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al guardar configuracion')
    } finally {
      setSaving(false)
    }
  }

  const handleGcalConnect = () => {
    const userId = targetUserId || config?.usuario_id
    if (!userId || !SUPABASE_URL) return
    const redirectUrl = window.location.origin + window.location.pathname
    window.location.href = `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=connect&user_id=${userId}&redirect_url=${encodeURIComponent(redirectUrl)}`
  }

  const handleGcalReconcile = async () => {
    const userId = targetUserId || config?.usuario_id
    if (!userId) return
    setSyncing(true)
    setSyncResult(null)
    try {
      // 1. Reconcile app citas with Google
      const { data: raw, error: err } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'reconcile', closer_id: userId },
      })
      if (err) {
        console.error('[GCal] Reconcile invoke error:', err)
        throw err
      }
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (d?.error) {
        console.error('[GCal] Reconcile API error:', d.error, d.detail)
        if (d.token_expired) {
          setSyncResult({ ok: false, msg: 'Token de Google expirado. Desconecta y vuelve a conectar.' })
          setSyncing(false)
          return
        }
        throw new Error(d.error)
      }

      // 2. Pull all external Google events
      const { data: pullRaw, error: pullErr } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'pull', closer_id: userId },
      })
      if (pullErr) console.error('[GCal] Pull invoke error:', pullErr)
      const pd = typeof pullRaw === 'string' ? JSON.parse(pullRaw) : pullRaw
      if (pd?.error) console.error('[GCal] Pull API error:', pd.error, pd.detail)

      const parts = []
      if (d.updated > 0) parts.push(`${d.updated} actualizadas`)
      if (d.cancelled > 0) parts.push(`${d.cancelled} canceladas`)
      if (pd?.upserted > 0) parts.push(`${pd.upserted} eventos Google importados`)
      if (parts.length === 0) parts.push('Todo sincronizado')
      setSyncResult({ ok: true, msg: `${d.total ?? 0} citas revisadas: ${parts.join(', ')}` })
      if (onGcalStatusChange) onGcalStatusChange()
    } catch (e) {
      console.error('[GCal] Sync error:', e)
      setSyncResult({ ok: false, msg: 'Error al sincronizar' })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  const handleGcalDisconnect = async () => {
    const userId = targetUserId || config?.usuario_id
    if (!userId || !SUPABASE_URL) return
    setGcalLoading(true)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-auth?action=disconnect&user_id=${userId}`)
      onGcalStatusChange?.()
    } catch {
      // Non-critical
    } finally {
      setGcalLoading(false)
    }
  }

  return (
    <div className="vc-config">
      <h3>Configuracion de agenda</h3>

      <div className="vc-config-grid">
        <div className="vc-field">
          <label>Duracion del slot</label>
          <Select value={duracion} onChange={e => { setDuracion(e.target.value); setGuardado(false) }}>
            <option value={30}>30 minutos</option>
            <option value={45}>45 minutos</option>
            <option value={60}>60 minutos</option>
            <option value={90}>90 minutos</option>
          </Select>
        </div>

        <div className="vc-field">
          <label>Descanso entre citas</label>
          <Select value={descanso} onChange={e => { setDescanso(e.target.value); setGuardado(false) }}>
            <option value={0}>Sin descanso</option>
            <option value={5}>5 minutos</option>
            <option value={10}>10 minutos</option>
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
          </Select>
        </div>
      </div>

      {error && <div className="vc-error-msg">{error}</div>}

      <div className="vc-config-actions">
        <button className="vc-btn-primary" onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        {guardado && <span className="vc-success-msg">Configuracion guardada</span>}
      </div>

      {/* Google Calendar */}
      <div className="vc-gcal-info">
        <div className="vc-gcal-header">
          <SyncIcon />
          <span>Sincronizacion con Google Calendar</span>
        </div>
        <div className="vc-gcal-body">
          {gcalConnected ? (
            <>
              <div className="vc-gcal-status">
                Estado: <span className="vc-text-success">Conectado</span>
              </div>
              {gcalCalendarId && gcalCalendarId !== 'primary' && (
                <p className="vc-gcal-desc">Calendario: {gcalCalendarId}</p>
              )}
              <p className="vc-gcal-desc">
                Las citas se sincronizan bidireccionalmente con Google Calendar. Los cambios en Google Calendar (mover o cancelar eventos) se reflejaran automaticamente en el portal. Se creara un enlace de Google Meet para cada cita.
              </p>
              <div className="vc-gcal-actions">
                <button
                  className="vc-btn-sm vc-btn-sync"
                  onClick={handleGcalReconcile}
                  disabled={syncing}
                >
                  <SyncIcon />
                  {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
                <button
                  className="vc-btn-sm vc-btn-danger-outline"
                  onClick={handleGcalDisconnect}
                  disabled={gcalLoading}
                >
                  {gcalLoading ? 'Desconectando...' : 'Desconectar'}
                </button>
              </div>
              {syncResult && (
                <p className={syncResult.ok ? 'vc-success-msg' : 'vc-error-msg'}>{syncResult.msg}</p>
              )}
            </>
          ) : (
            <>
              <div className="vc-gcal-status">
                Estado: <span className="vc-text-muted">No conectado</span>
              </div>
              <p className="vc-gcal-desc">
                Conecta tu cuenta de Google para sincronizar citas automaticamente y generar enlaces de Google Meet.
              </p>
              <button className="vc-btn-google" onClick={handleGcalConnect}>
                <GoogleIcon />
                Conectar con Google Calendar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
