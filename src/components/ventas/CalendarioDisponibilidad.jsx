import { useState, useEffect } from 'react'
import Toggle from '../ui/Toggle'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

function parseTime(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h + (m || 0) / 60
}

export default function CalendarioDisponibilidad({
  disponibilidad,
  onGuardar,
  minimoHoras,
}) {
  const [franjas, setFranjas] = useState([])
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (disponibilidad && disponibilidad.length > 0) {
      setFranjas(disponibilidad.map(d => ({
        dia_semana: d.dia_semana,
        hora_inicio: d.hora_inicio || '09:00',
        hora_fin: d.hora_fin || '18:00',
        activo: d.activo !== false,
      })))
    } else {
      // Default: Mon-Fri 09-18
      const defaults = []
      for (let i = 0; i < 5; i++) {
        defaults.push({ dia_semana: i, hora_inicio: '09:00', hora_fin: '18:00', activo: true })
      }
      for (let i = 5; i < 7; i++) {
        defaults.push({ dia_semana: i, hora_inicio: '09:00', hora_fin: '18:00', activo: false })
      }
      setFranjas(defaults)
    }
  }, [disponibilidad])

  const franjasPorDia = DIAS.map((_, idx) => franjas.filter(f => f.dia_semana === idx))

  const toggleDia = (dia) => {
    const existentes = franjas.filter(f => f.dia_semana === dia)
    if (existentes.length === 0) {
      setFranjas(prev => [...prev, { dia_semana: dia, hora_inicio: '09:00', hora_fin: '18:00', activo: true }])
    } else {
      const activo = existentes.some(f => f.activo)
      setFranjas(prev => prev.map(f => f.dia_semana === dia ? { ...f, activo: !activo } : f))
    }
    setGuardado(false)
  }

  const updateFranja = (dia, idx, field, value) => {
    let count = 0
    setFranjas(prev => prev.map(f => {
      if (f.dia_semana === dia) {
        if (count === idx) {
          count++
          return { ...f, [field]: value }
        }
        count++
      }
      return f
    }))
    setGuardado(false)
  }

  const agregarFranja = (dia) => {
    setFranjas(prev => [...prev, { dia_semana: dia, hora_inicio: '14:00', hora_fin: '19:00', activo: true }])
    setGuardado(false)
  }

  const eliminarFranja = (dia, idx) => {
    let count = 0
    setFranjas(prev => prev.filter(f => {
      if (f.dia_semana === dia) {
        if (count === idx) { count++; return false }
        count++
      }
      return true
    }))
    setGuardado(false)
  }

  const horasSemanales = franjas
    .filter(f => f.activo)
    .reduce((total, f) => {
      const inicio = parseTime(f.hora_inicio)
      const fin = parseTime(f.hora_fin)
      return total + Math.max(0, fin - inicio)
    }, 0)

  const cumpleMinimo = !minimoHoras || horasSemanales >= minimoHoras

  const handleGuardar = async () => {
    setSaving(true)
    setError(null)
    try {
      await onGuardar(franjas)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al guardar disponibilidad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="vc-disponibilidad">
      <div className="vc-disp-dias">
        {DIAS.map((nombre, dia) => {
          const franjasDelDia = franjasPorDia[dia]
          const activo = franjasDelDia.some(f => f.activo)

          return (
            <div key={dia} className={`vc-disp-dia${activo ? ' vc-disp-activo' : ''}`}>
              <div className="vc-disp-dia-header">
                <span className="vc-disp-dia-nombre">{nombre}</span>
                <Toggle checked={activo} onChange={() => toggleDia(dia)} />
              </div>

              {activo && (
                <div className="vc-disp-franjas">
                  {franjasDelDia.filter(f => f.activo).map((f, idx) => (
                    <div key={idx} className="vc-disp-franja">
                      <span className="vc-disp-de">De</span>
                      <input
                        type="time"
                        value={f.hora_inicio}
                        onChange={e => updateFranja(dia, idx, 'hora_inicio', e.target.value)}
                      />
                      <span className="vc-disp-a">a</span>
                      <input
                        type="time"
                        value={f.hora_fin}
                        onChange={e => updateFranja(dia, idx, 'hora_fin', e.target.value)}
                      />
                      {franjasDelDia.filter(x => x.activo).length > 1 && (
                        <button className="vc-disp-del" onClick={() => eliminarFranja(dia, idx)} title="Eliminar franja">
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="vc-disp-add" onClick={() => agregarFranja(dia)}>
                    <PlusIcon /> Añadir franja
                  </button>
                </div>
              )}

              {!activo && (
                <span className="vc-disp-off">No disponible</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="vc-disp-footer">
        <div className="vc-disp-total">
          <span>Total: <strong>{horasSemanales.toFixed(1)}h</strong> semanales</span>
          {minimoHoras != null && (
            <span className={cumpleMinimo ? 'vc-text-success' : 'vc-text-danger'}>
              Mínimo exigido: {minimoHoras}h
            </span>
          )}
        </div>

        {error && <div className="vc-error-msg">{error}</div>}

        <div className="vc-disp-actions">
          <button className="vc-btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar disponibilidad'}
          </button>
          {guardado && <span className="vc-success-msg">Disponibilidad guardada</span>}
        </div>
      </div>
    </div>
  )
}
