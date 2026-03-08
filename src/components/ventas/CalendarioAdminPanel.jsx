import { useState, useEffect } from 'react'

function formatFechaCorta(d) {
  if (!d) return '-'
  const fecha = new Date(d)
  const hoy = new Date()
  if (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  ) {
    return `Hoy ${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }
  return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) +
    ' ' + fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CalendarioAdminPanel({
  cargarClosersConConfig,
  onActualizarMinimoHoras,
  onVerCalendario,
}) {
  const [closersData, setClosersData] = useState([])
  const [loading, setLoading] = useState(true)
  const [minimosEditados, setMinimosEditados] = useState({})
  const [savingMinimo, setSavingMinimo] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    const cargar = async () => {
      setLoading(true)
      const data = await cargarClosersConConfig()
      if (!active) return
      setClosersData(data)
      setLoading(false)
    }
    cargar()
    return () => { active = false }
  }, [cargarClosersConConfig])

  const handleMinimoChange = (closerId, value) => {
    setMinimosEditados(prev => ({ ...prev, [closerId]: value }))
  }

  const guardarMinimo = async (closerId) => {
    const valor = Number(minimosEditados[closerId]) || 0
    setSavingMinimo(closerId)
    try {
      await onActualizarMinimoHoras(closerId, valor)
      setClosersData(prev => prev.map(c => c.id === closerId ? { ...c, minimo_horas_semana: valor } : c))
      setMinimosEditados(prev => { const n = { ...prev }; delete n[closerId]; return n })
    } catch (err) {
      setError(err?.message || 'Error al guardar mínimo de horas')
    } finally {
      setSavingMinimo(null)
    }
  }

  if (loading) {
    return <div className="vc-loading">Cargando equipo...</div>
  }

  if (closersData.length === 0) {
    return <div className="vc-empty">No hay closers registrados</div>
  }

  return (
    <div className="vc-admin-panel">
      <h3>Gestión de equipo</h3>
      {error && <div className="vc-error">{error}</div>}
      <div className="vc-admin-grid">
        {closersData.map(c => {
          const minimo = c.minimo_horas_semana
          const cumple = !minimo || c.horas_configuradas >= minimo
          const minimoVal = minimosEditados[c.id] ?? c.minimo_horas_semana ?? ''

          return (
            <div key={c.id} className="vc-admin-card">
              <div className="vc-admin-card-header">
                <span className="vc-admin-card-nombre">{c.nombre || c.email}</span>
              </div>

              <div className="vc-admin-card-body">
                <div className="vc-admin-card-row">
                  <span>Horas configuradas</span>
                  <span><strong>{c.horas_configuradas?.toFixed(1) || 0}h</strong>/semana</span>
                </div>

                <div className="vc-admin-card-row">
                  <span>Mínimo exigido</span>
                  <div className="vc-admin-minimo-input">
                    <input
                      type="number"
                      min="0"
                      max="168"
                      value={minimoVal}
                      onChange={e => handleMinimoChange(c.id, e.target.value)}
                      placeholder="0"
                    />
                    <span>h</span>
                    {minimosEditados[c.id] != null && (
                      <button
                        className="vc-btn-xs"
                        onClick={() => guardarMinimo(c.id)}
                        disabled={savingMinimo === c.id}
                      >
                        {savingMinimo === c.id ? '...' : '✓'}
                      </button>
                    )}
                    {minimo != null && (
                      <span className={cumple ? 'vc-text-success' : 'vc-text-danger'}>
                        {cumple ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="vc-admin-card-row">
                  <span>Citas esta semana</span>
                  <span>{c.citas_semana}</span>
                </div>

                <div className="vc-admin-card-row">
                  <span>Próxima cita</span>
                  <span>{formatFechaCorta(c.proxima_cita)}</span>
                </div>

                <div className="vc-admin-card-row vc-admin-card-config">
                  <span>Slot: {c.duracion_slot_minutos} min · Descanso: {c.descanso_entre_citas_minutos} min</span>
                </div>
              </div>

              <button className="vc-btn-sm vc-admin-ver-btn" onClick={() => onVerCalendario(c.id)}>
                Ver calendario
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
