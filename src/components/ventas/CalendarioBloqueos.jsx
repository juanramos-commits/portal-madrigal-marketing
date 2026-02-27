import { useState } from 'react'

function formatFechaHora(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

export default function CalendarioBloqueos({
  bloqueos,
  onCrear,
  onEliminar,
}) {
  const [showModal, setShowModal] = useState(false)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleCrear = async () => {
    if (!fechaInicio || !fechaFin) { setError('Las fechas son obligatorias'); return }
    if (new Date(fechaInicio) >= new Date(fechaFin)) { setError('La fecha fin debe ser posterior a la fecha inicio'); return }

    setSaving(true)
    setError(null)
    try {
      await onCrear({ fecha_inicio: fechaInicio, fecha_fin: fechaFin, motivo })
      setShowModal(false)
      setFechaInicio('')
      setFechaFin('')
      setMotivo('')
    } catch (e) {
      setError(e.message || 'Error al crear bloqueo')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (id) => {
    try {
      await onEliminar(id)
    } catch (_) {
      // silently fail
    }
  }

  return (
    <div className="vc-bloqueos">
      <div className="vc-bloqueos-header">
        <h3>Bloqueos de agenda</h3>
        <button className="vc-btn-sm" onClick={() => setShowModal(true)}>
          <PlusIcon /> Nuevo bloqueo
        </button>
      </div>

      {bloqueos.length === 0 ? (
        <div className="vc-empty">No hay bloqueos configurados</div>
      ) : (
        <div className="vc-bloqueos-lista">
          {bloqueos.map(b => (
            <div key={b.id} className="vc-bloqueo-card">
              <div className="vc-bloqueo-info">
                <span className="vc-bloqueo-fechas">
                  {formatFechaHora(b.fecha_inicio)} → {formatFechaHora(b.fecha_fin)}
                </span>
                {b.motivo && <span className="vc-bloqueo-motivo">{b.motivo}</span>}
              </div>
              <button className="vc-btn-icon-danger" onClick={() => handleEliminar(b.id)} title="Eliminar bloqueo">
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo bloqueo */}
      {showModal && (
        <>
          <div className="vc-modal-overlay" onClick={() => setShowModal(false)} />
          <div className="vc-modal vc-modal-sm">
            <div className="vc-modal-header">
              <h2>Nuevo bloqueo</h2>
              <button className="vc-modal-close" onClick={() => setShowModal(false)}><CloseIcon /></button>
            </div>
            <div className="vc-modal-body">
              <div className="vc-field">
                <label>Fecha inicio *</label>
                <input type="datetime-local" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setError(null) }} />
              </div>
              <div className="vc-field">
                <label>Fecha fin *</label>
                <input type="datetime-local" value={fechaFin} onChange={e => { setFechaFin(e.target.value); setError(null) }} />
              </div>
              <div className="vc-field">
                <label>Motivo</label>
                <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: Vacaciones, Cita médica..." />
              </div>
              {error && <div className="vc-error-msg">{error}</div>}
            </div>
            <div className="vc-modal-actions">
              <button className="vc-btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
              <button className="vc-btn-primary" onClick={handleCrear} disabled={saving}>
                {saving ? 'Creando...' : 'Crear bloqueo'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
