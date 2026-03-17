import { useState } from 'react'
import { useCERespuestas } from '../../hooks/useCERespuestas'
import { useToast } from '../../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'

const CLASIFICACIONES = ['todas', 'pendiente', 'interesado', 'no_ahora', 'baja', 'negativo', 'irrelevante']

export default function ColdEmailRespuestas() {
  const { showToast: addToast } = useToast()
  const navigate = useNavigate()

  const [filtro, setFiltro] = useState('todas')

  const {
    respuestas,
    respuestaActiva,
    loading,
    error,
    setFiltroClasificacion,
    setSearch,
    seleccionar,
    clasificar,
    crearLeadCRM,
  } = useCERespuestas()

  const handleFiltro = (f) => {
    setFiltro(f)
    setFiltroClasificacion(f === 'todas' ? '' : f)
  }

  const handleSelect = async (r) => {
    try {
      await seleccionar(r.id)
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleClasificar = async (clasificacion) => {
    if (!respuestaActiva) return
    try {
      await clasificar(respuestaActiva.id, clasificacion)
      addToast(`Clasificado como "${clasificacion}"`, 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleCrearLead = async () => {
    if (!respuestaActiva) return
    try {
      const lead = await crearLeadCRM(respuestaActiva.id)
      addToast('Lead creado en CRM', 'success')
      if (lead?.id) {
        navigate(`/ventas/crm/leads/${lead.id}`)
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  if (loading && !respuestas?.length) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando respuestas...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">Error: {error}</div>
      </div>
    )
  }

  // Build thread messages from respuestaActiva
  const threadMessages = []
  if (respuestaActiva) {
    // Add outbound envios from thread
    if (respuestaActiva._threadEnvios) {
      for (const e of respuestaActiva._threadEnvios) {
        threadMessages.push({
          id: 'envio-' + e.id,
          direccion: 'outbound',
          asunto: e.paso?.asunto_a || null,
          cuerpo: e.paso?.cuerpo_a || 'Email enviado',
          created_at: e.enviado_at || e.created_at,
        })
      }
    }
    // Add inbound responses from thread
    if (respuestaActiva._thread) {
      for (const r of respuestaActiva._thread) {
        threadMessages.push({
          id: r.id,
          direccion: 'inbound',
          de_nombre: r.de,
          asunto: r.asunto,
          cuerpo: r.cuerpo,
          created_at: r.created_at,
        })
      }
    }
    // Sort by date
    threadMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    // If no thread, show just the response itself
    if (threadMessages.length === 0) {
      threadMessages.push({
        id: respuestaActiva.id,
        direccion: 'inbound',
        de_nombre: respuestaActiva.de,
        asunto: respuestaActiva.asunto,
        cuerpo: respuestaActiva.cuerpo,
        created_at: respuestaActiva.created_at,
      })
    }
  }

  return (
    <div className="ce-page">
      <div className="ce-page-header">
        <h1 className="ce-page-title">Respuestas</h1>
      </div>

      <div className="ce-inbox-layout">
        {/* Left: Thread List */}
        <div className="ce-inbox-list">
          <div className="ce-inbox-list-header">
            <input
              type="text"
              className="ce-search-input"
              placeholder="Buscar..."
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="ce-filter-pills ce-filter-pills-compact">
              {CLASIFICACIONES.map((c) => (
                <button
                  key={c}
                  className={`ce-pill ce-pill-sm ${filtro === c ? 'ce-pill-active' : ''}`}
                  onClick={() => handleFiltro(c)}
                >
                  {c === 'todas' ? 'Todas' : c.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="ce-inbox-threads">
            {respuestas?.length > 0 ? (
              respuestas.map((r) => (
                <div
                  key={r.id}
                  className={`ce-thread-item ${respuestaActiva?.id === r.id ? 'ce-thread-item-active' : ''} ${!r.leida ? 'ce-thread-item-unread' : ''}`}
                  onClick={() => handleSelect(r)}
                >
                  <div className="ce-thread-avatar">
                    {(r.contacto?.nombre || r.de || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="ce-thread-info">
                    <div className="ce-thread-top">
                      <span className="ce-thread-name">{r.contacto?.nombre || r.de}</span>
                      <span className="ce-thread-time">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                          : ''}
                      </span>
                    </div>
                    <div className="ce-thread-subject">{r.asunto || '(sin asunto)'}</div>
                    <div className="ce-thread-snippet">{(r.cuerpo || '').slice(0, 80)}</div>
                    <div className="ce-thread-meta">
                      {r.clasificacion && (
                        <span className={`ce-badge ce-badge-sm ce-badge-${r.clasificacion}`}>
                          {r.clasificacion.replace('_', ' ')}
                        </span>
                      )}
                      {!r.leida && <span className="ce-unread-dot" />}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="ce-empty ce-empty-sm">
                <div className="ce-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                </div>
                <p>No hay respuestas.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Thread Detail */}
        <div className="ce-inbox-detail">
          {respuestaActiva ? (
            <>
              <div className="ce-inbox-detail-header">
                <div>
                  <h2 className="ce-inbox-detail-name">{respuestaActiva.contacto?.nombre || respuestaActiva.de}</h2>
                  <p className="ce-text-muted">{respuestaActiva.contacto?.email || respuestaActiva.de}</p>
                </div>
                <div className="ce-inbox-detail-actions">
                  <select
                    className="ce-select ce-select-sm"
                    value={respuestaActiva.clasificacion || ''}
                    onChange={(e) => handleClasificar(e.target.value)}
                  >
                    <option value="">Sin clasificar</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="interesado">Interesado</option>
                    <option value="no_ahora">No ahora</option>
                    <option value="baja">Baja</option>
                    <option value="negativo">Negativo</option>
                    <option value="irrelevante">Irrelevante</option>
                  </select>
                </div>
              </div>

              {/* Messages */}
              <div className="ce-inbox-messages">
                {threadMessages.length > 0 ? (
                  threadMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`ce-message ${msg.direccion === 'inbound' ? 'ce-message-inbound' : 'ce-message-outbound'}`}
                    >
                      <div className="ce-message-header">
                        <span className="ce-message-from">
                          {msg.direccion === 'inbound' ? (msg.de_nombre || 'Contacto') : 'Tu'}
                        </span>
                        <span className="ce-message-time">
                          {msg.created_at ? new Date(msg.created_at).toLocaleString('es-ES') : ''}
                        </span>
                      </div>
                      {msg.asunto && <div className="ce-message-subject">{msg.asunto}</div>}
                      <div className="ce-message-body">{msg.cuerpo}</div>
                    </div>
                  ))
                ) : (
                  <div className="ce-empty ce-empty-sm">Cargando mensajes...</div>
                )}
              </div>

              {/* Classification Actions */}
              <div className="ce-inbox-classification">
                <span className="ce-text-muted">Clasificar:</span>
                <div className="ce-classification-btns">
                  {['interesado', 'no_ahora', 'baja', 'negativo', 'irrelevante'].map((cls) => (
                    <button
                      key={cls}
                      className={`ce-btn ce-btn-sm ce-btn-classify ce-btn-${cls}`}
                      onClick={() => handleClasificar(cls)}
                    >
                      {cls.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                {respuestaActiva.clasificacion === 'interesado' && (
                  <button className="ce-btn ce-btn-sm ce-btn-success" onClick={handleCrearLead}>
                    Crear Lead CRM
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="ce-inbox-placeholder">
              <div className="ce-empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p className="ce-text-muted">Selecciona una conversacion para ver los detalles.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
