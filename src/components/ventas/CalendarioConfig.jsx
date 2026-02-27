import { useState, useEffect } from 'react'
import Select from '../ui/Select'

export default function CalendarioConfig({ config, onGuardar }) {
  const [duracion, setDuracion] = useState(60)
  const [descanso, setDescanso] = useState(15)
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (config) {
      setDuracion(config.duracion_slot_minutos || 60)
      setDescanso(config.descanso_entre_citas_minutos ?? 15)
    }
  }, [config])

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
      setError(e.message || 'Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="vc-config">
      <h3>Configuración de agenda</h3>

      <div className="vc-config-grid">
        <div className="vc-field">
          <label>Duración del slot</label>
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
        {guardado && <span className="vc-success-msg">Configuración guardada</span>}
      </div>

      {/* Google Calendar info */}
      <div className="vc-gcal-info">
        <div className="vc-gcal-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>Sincronización con Google Calendar</span>
        </div>
        <div className="vc-gcal-body">
          <div className="vc-gcal-status">
            Estado: <span className="vc-text-muted">No conectado</span>
          </div>
          <p className="vc-gcal-desc">
            La sincronización bidireccional permitirá ver tus citas de la app en Google Calendar y viceversa.
          </p>
          <span className="vc-gcal-badge">Próximamente</span>
        </div>
      </div>
    </div>
  )
}
