import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from '../ui/Select'
import Modal from '../ui/Modal'

function formatFechaLarga(d) {
  if (!d) return '-'
  const fecha = new Date(d)
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  return fecha.toLocaleDateString('es-ES', opciones)
}

function formatHora(d) {
  if (!d) return '-'
  return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatHoraFin(d, duracion) {
  if (!d) return ''
  const fin = new Date(new Date(d).getTime() + (duracion || 60) * 60000)
  return formatHora(fin)
}

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-sm" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-sm" aria-hidden="true">
    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
)

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }} aria-hidden="true">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
)

export default function CalendarioCitaDetalle({
  cita,
  reunionEstados,
  closers,
  esCloser,
  esDirector,
  esSetter,
  onClose,
  onActualizarEstado,
  onActualizarNotas,
  onActualizarEnlaceGrabacion,
  onCancelar,
  onReasignarCloser,
}) {
  const navigate = useNavigate()
  const [notas, setNotas] = useState(cita?.notas_closer || '')
  const [enlaceGrabacion, setEnlaceGrabacion] = useState('')
  const [estadoId, setEstadoId] = useState(cita?.estado_reunion_id || '')
  const [closerId, setCloserId] = useState(cita?.closer_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => {
    if (cita) {
      setNotas(cita.notas_closer || '')
      setEnlaceGrabacion(cita.lead?.enlace_grabacion || '')
      setEstadoId(cita.estado_reunion_id || '')
      setCloserId(cita.closer_id || '')
    }
  }, [cita?.id])

  if (!cita) return null

  const puedeEditar = (esCloser || esDirector) && cita.estado !== 'cancelada'
  const estadoActual = reunionEstados?.find(e => e.id === cita.estado_reunion_id)

  const guardarEstado = async (id) => {
    const prevEstadoId = estadoId
    setEstadoId(id)
    setSaving(true)
    setError(null)
    try {
      await onActualizarEstado(cita.id, id)
      showSuccess('Estado actualizado')
    } catch (e) {
      setEstadoId(prevEstadoId)
      setError(e.message || 'Error al actualizar estado')
    } finally {
      setSaving(false)
    }
  }

  const guardarNotas = async () => {
    setSaving(true)
    setError(null)
    try {
      await onActualizarNotas(cita.id, notas)
      showSuccess('Notas guardadas')
    } catch (e) {
      setError(e.message || 'Error al guardar notas')
    } finally {
      setSaving(false)
    }
  }

  const guardarEnlace = async () => {
    if (!enlaceGrabacion.trim() || !cita.lead?.id) return
    setSaving(true)
    setError(null)
    try {
      await onActualizarEnlaceGrabacion(cita.lead.id, enlaceGrabacion)
      showSuccess('Enlace guardado')
    } catch (e) {
      setError(e.message || 'Error al guardar enlace')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelar = async () => {
    setSaving(true)
    setError(null)
    try {
      await onCancelar(cita.id)
      onClose()
    } catch (e) {
      setError(e.message || 'Error al cancelar')
      setSaving(false)
    }
  }

  const handleReasignar = async (nuevoId) => {
    const prevCloserId = closerId
    setCloserId(nuevoId)
    setSaving(true)
    setError(null)
    try {
      await onReasignarCloser(cita.id, nuevoId)
      showSuccess('Closer reasignado')
    } catch (e) {
      setCloserId(prevCloserId)
      setError(e.message || 'Error al reasignar')
    } finally {
      setSaving(false)
    }
  }

  const showSuccess = (msg) => {
    setError(null)
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 2000)
  }

  const leadTelefono = cita.lead?.telefono
  const leadEmail = cita.lead?.email

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Detalle de cita"
    >
      {/* Lead hero */}
      <div className="vc-detalle-section">
        <div className="vc-detalle-hero">
          <span className="vc-detalle-hero-name" onClick={() => navigate(`/ventas/crm/lead/${cita.lead?.id}`)}>
            {cita.lead?.nombre || 'Sin nombre'}
          </span>
          {cita.estado === 'cancelada' ? (
            <span className="vc-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
              Cancelada
            </span>
          ) : estadoActual ? (
            <span className="vc-badge" style={{ background: `${estadoActual.color}20`, color: estadoActual.color }}>
              {estadoActual.nombre}
            </span>
          ) : (
            <span className="vc-badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>Sin estado</span>
          )}
        </div>

        {(leadTelefono || leadEmail) && (
          <div className="vc-detalle-contact">
            {leadTelefono && (
              <div className="vc-detalle-contact-item">
                <PhoneIcon />
                <a href={`tel:${leadTelefono}`}>{leadTelefono}</a>
              </div>
            )}
            {leadEmail && (
              <div className="vc-detalle-contact-item">
                <MailIcon />
                <a href={`mailto:${leadEmail}`}>{leadEmail}</a>
              </div>
            )}
          </div>
        )}

        <div className="vc-detalle-row">
          <span className="vc-detalle-label">Fecha y hora</span>
          <span>{formatFechaLarga(cita.fecha_hora)}, {formatHora(cita.fecha_hora)} - {formatHoraFin(cita.fecha_hora, cita.duracion_minutos)}</span>
        </div>

        <div className="vc-detalle-row">
          <span className="vc-detalle-label">Closer</span>
          <span>{cita.closer?.nombre || cita.closer?.email || 'Sin asignar'}</span>
        </div>

        <div className="vc-detalle-row">
          <span className="vc-detalle-label">Setter origen</span>
          <span>
            {cita.setter_origen?.nombre || cita.setter_origen?.email || 'Sin setter'}
            {cita.origen_agendacion === 'enlace_setter' && <span className="vc-badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', marginLeft: 6 }}>Via enlace</span>}
            {cita.origen_agendacion === 'enlace_campana' && <span className="vc-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', marginLeft: 6 }}>Campaña</span>}
          </span>
        </div>

        {cita.enlace?.fuente && (
          <div className="vc-detalle-row">
            <span className="vc-detalle-label">Fuente</span>
            <span>{cita.enlace.fuente}</span>
          </div>
        )}

        {cita.google_meet_url && (
          <div className="vc-detalle-row">
            <span className="vc-detalle-label">Google Meet</span>
            <a href={cita.google_meet_url} target="_blank" rel="noopener noreferrer" className="vc-meet-link">
              <CameraIcon /> Unirse a la reunión
            </a>
          </div>
        )}
      </div>

      {/* Closer actions */}
      {puedeEditar && (
        <>
          <div className="vc-detalle-separator" />
          <div className="vc-detalle-section">
            <div className="vc-field">
              <label>Marcar estado de reunión</label>
              <Select value={estadoId} onChange={e => guardarEstado(e.target.value)} disabled={saving}>
                <option value="">Sin estado</option>
                {reunionEstados?.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </Select>
            </div>

            <div className="vc-field">
              <label>Notas del closer</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} placeholder="Escribe notas sobre la reunión..." />
              <button className="vc-btn-sm" onClick={guardarNotas} disabled={saving}>Guardar notas</button>
            </div>

            <div className="vc-field">
              <label>Enlace de grabación</label>
              <div className="vc-field-inline">
                <input type="url" value={enlaceGrabacion} onChange={e => setEnlaceGrabacion(e.target.value)} placeholder="https://..." />
                <button className="vc-btn-sm" onClick={guardarEnlace} disabled={saving || !enlaceGrabacion.trim()}>Guardar</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Director actions */}
      {esDirector && (
        <>
          <div className="vc-detalle-separator" />
          <div className="vc-detalle-section">
            <div className="vc-field">
              <label>Reasignar closer</label>
              <Select value={closerId} onChange={e => handleReasignar(e.target.value)} disabled={saving}>
                <option value="">Sin asignar</option>
                {closers?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre || c.email}</option>
                ))}
              </Select>
            </div>

            {cita.estado !== 'cancelada' && (
              <button className="vc-btn-danger" onClick={handleCancelar} disabled={saving}>
                Cancelar cita
              </button>
            )}
          </div>
        </>
      )}

      {error && <div className="vc-error-msg">{error}</div>}
      {successMsg && <div className="vc-success-msg">{successMsg}</div>}
    </Modal>
  )
}
