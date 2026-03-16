import { useState, useEffect } from 'react'
import { useCERespuestas } from '../../hooks/useCERespuestas'
import { useToast } from '../../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'

const CLASIFICACIONES = ['todas', 'pendiente', 'interesado', 'no_ahora', 'baja', 'negativo', 'irrelevante']

export default function ColdEmailRespuestas() {
  const { showToast: addToast } = useToast()
  const navigate = useNavigate()

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [selectedThread, setSelectedThread] = useState(null)

  const {
    threads,
    threadMessages,
    loading,
    error,
    cargarThread,
    clasificar,
    crearLeadCRM,
  } = useCERespuestas({
    busqueda,
    clasificacion: filtro === 'todas' ? null : filtro,
  })

  useEffect(() => {
    if (selectedThread) {
      cargarThread(selectedThread.id)
    }
  }, [selectedThread, cargarThread])

  const handleClasificar = async (clasificacion) => {
    if (!selectedThread) return
    try {
      await clasificar(selectedThread.id, clasificacion)
      addToast(`Clasificado como "${clasificacion}"`, 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleCrearLead = async () => {
    if (!selectedThread) return
    try {
      const lead = await crearLeadCRM(selectedThread.id)
      addToast('Lead creado en CRM', 'success')
      if (lead?.id) {
        navigate(`/ventas/crm/leads/${lead.id}`)
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  if (loading && !threads?.length) {
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
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div className="ce-filter-pills ce-filter-pills-compact">
              {CLASIFICACIONES.map((c) => (
                <button
                  key={c}
                  className={`ce-pill ce-pill-sm ${filtro === c ? 'ce-pill-active' : ''}`}
                  onClick={() => setFiltro(c)}
                >
                  {c === 'todas' ? 'Todas' : c.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="ce-inbox-threads">
            {threads?.length > 0 ? (
              threads.map((t) => (
                <div
                  key={t.id}
                  className={`ce-thread-item ${selectedThread?.id === t.id ? 'ce-thread-item-active' : ''} ${t.no_leido ? 'ce-thread-item-unread' : ''}`}
                  onClick={() => setSelectedThread(t)}
                >
                  <div className="ce-thread-avatar">
                    {(t.contacto_nombre || t.de_email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="ce-thread-info">
                    <div className="ce-thread-top">
                      <span className="ce-thread-name">{t.contacto_nombre || t.de_email}</span>
                      <span className="ce-thread-time">
                        {t.ultimo_mensaje_at
                          ? new Date(t.ultimo_mensaje_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                          : ''}
                      </span>
                    </div>
                    <div className="ce-thread-subject">{t.asunto || '(sin asunto)'}</div>
                    <div className="ce-thread-snippet">{t.snippet || ''}</div>
                    <div className="ce-thread-meta">
                      {t.clasificacion && (
                        <span className={`ce-badge ce-badge-sm ce-badge-${t.clasificacion}`}>
                          {t.clasificacion.replace('_', ' ')}
                        </span>
                      )}
                      {t.no_leido && <span className="ce-unread-dot" />}
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
          {selectedThread ? (
            <>
              <div className="ce-inbox-detail-header">
                <div>
                  <h2 className="ce-inbox-detail-name">{selectedThread.contacto_nombre || selectedThread.de_email}</h2>
                  <p className="ce-text-muted">{selectedThread.de_email}</p>
                </div>
                <div className="ce-inbox-detail-actions">
                  <select
                    className="ce-select ce-select-sm"
                    value={selectedThread.clasificacion || ''}
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
                {threadMessages?.length > 0 ? (
                  threadMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`ce-message ${msg.direccion === 'inbound' ? 'ce-message-inbound' : 'ce-message-outbound'}`}
                    >
                      <div className="ce-message-header">
                        <span className="ce-message-from">
                          {msg.direccion === 'inbound' ? (msg.de_nombre || msg.de_email) : 'Tu'}
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
                {selectedThread.clasificacion === 'interesado' && (
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
