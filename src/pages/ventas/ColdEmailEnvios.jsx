import { useState } from 'react'
import { useCEEnvios } from '../../hooks/useCEEnvios'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'

const PAGE_SIZE = 25

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  entregado: 'Entregado',
  abierto: 'Abierto',
  respondido: 'Respondido',
  rebotado: 'Rebotado',
  fallido: 'Fallido',
  cancelado: 'Cancelado',
}

export default function ColdEmailEnvios() {
  const { tienePermiso } = useAuth()
  const { showToast: addToast } = useToast()

  const [tab, setTab] = useState('cola')
  const [busquedaLog, setBusquedaLog] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [paginaCola, setPaginaCola] = useState(1)
  const [paginaLog, setPaginaLog] = useState(1)

  const {
    cola,
    totalCola,
    log,
    totalLog,
    pausaGlobal,
    loading,
    error,
    pausarEnvio,
    cancelarEnvio,
  } = useCEEnvios({
    busquedaLog,
    fechaDesde: fechaDesde || null,
    fechaHasta: fechaHasta || null,
    paginaCola,
    paginaLog,
    porPagina: PAGE_SIZE,
  })

  const totalPagesCola = Math.ceil((totalCola || 0) / PAGE_SIZE)
  const totalPagesLog = Math.ceil((totalLog || 0) / PAGE_SIZE)

  const handlePausarEnvio = async (envioId) => {
    try {
      await pausarEnvio(envioId)
      addToast('Envio pausado', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleCancelarEnvio = async (envioId) => {
    if (!window.confirm('Cancelar este envio?')) return
    try {
      await cancelarEnvio(envioId)
      addToast('Envio cancelado', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando envios...</span>
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
        <h1 className="ce-page-title">Envios</h1>
      </div>

      {/* Global Pause Banner */}
      {pausaGlobal && (
        <div className="ce-banner ce-banner-warning">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" />
          </svg>
          <span>Pausa global activada. No se estan enviando emails.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="ce-tabs">
        <button
          className={`ce-tab ${tab === 'cola' ? 'ce-tab-active' : ''}`}
          onClick={() => setTab('cola')}
        >
          Cola ({totalCola || 0})
        </button>
        <button
          className={`ce-tab ${tab === 'log' ? 'ce-tab-active' : ''}`}
          onClick={() => setTab('log')}
        >
          Log ({totalLog || 0})
        </button>
      </div>

      <div className="ce-tab-content">
        {/* =================== COLA TAB =================== */}
        {tab === 'cola' && (
          <>
            {cola?.length > 0 ? (
              <>
                <div className="ce-table-wrapper">
                  <table className="ce-table">
                    <thead>
                      <tr>
                        <th>Contacto</th>
                        <th>Secuencia</th>
                        <th>Paso</th>
                        <th>Cuenta</th>
                        <th>Proximo envio</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cola.map((e) => (
                        <tr key={e.id}>
                          <td className="ce-td-name">{e.contacto_nombre || e.contacto_email}</td>
                          <td>{e.secuencia_nombre || '---'}</td>
                          <td>Paso {e.paso_numero || '?'}</td>
                          <td>{e.cuenta_email || '---'}</td>
                          <td className="ce-text-muted">
                            {e.proximo_envio_at
                              ? new Date(e.proximo_envio_at).toLocaleString('es-ES')
                              : '---'}
                          </td>
                          <td>
                            <div className="ce-action-btns">
                              <button
                                className="ce-btn ce-btn-sm ce-btn-warning"
                                onClick={() => handlePausarEnvio(e.id)}
                              >
                                Pausar
                              </button>
                              <button
                                className="ce-btn ce-btn-sm ce-btn-danger"
                                onClick={() => handleCancelarEnvio(e.id)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ce-pagination">
                  <button
                    className="ce-btn ce-btn-sm"
                    disabled={paginaCola <= 1}
                    onClick={() => setPaginaCola((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span className="ce-pagination-info">
                    Pagina {paginaCola} de {totalPagesCola}
                  </span>
                  <button
                    className="ce-btn ce-btn-sm"
                    disabled={paginaCola >= totalPagesCola}
                    onClick={() => setPaginaCola((p) => p + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : (
              <div className="ce-empty">
                <div className="ce-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/></svg>
                </div>
                <p>No hay envios en cola.</p>
              </div>
            )}
          </>
        )}

        {/* =================== LOG TAB =================== */}
        {tab === 'log' && (
          <>
            <div className="ce-filters">
              <input
                type="text"
                className="ce-search-input"
                placeholder="Buscar por email o asunto..."
                value={busquedaLog}
                onChange={(e) => { setBusquedaLog(e.target.value); setPaginaLog(1) }}
              />
              <div className="ce-date-filters">
                <div className="ce-form-field-inline">
                  <label className="ce-label">Desde</label>
                  <input
                    type="date"
                    className="ce-input ce-input-sm"
                    value={fechaDesde}
                    onChange={(e) => { setFechaDesde(e.target.value); setPaginaLog(1) }}
                  />
                </div>
                <div className="ce-form-field-inline">
                  <label className="ce-label">Hasta</label>
                  <input
                    type="date"
                    className="ce-input ce-input-sm"
                    value={fechaHasta}
                    onChange={(e) => { setFechaHasta(e.target.value); setPaginaLog(1) }}
                  />
                </div>
              </div>
            </div>

            {log?.length > 0 ? (
              <>
                <div className="ce-table-wrapper">
                  <table className="ce-table">
                    <thead>
                      <tr>
                        <th>Contacto</th>
                        <th>Asunto</th>
                        <th>Cuenta</th>
                        <th>Estado</th>
                        <th>Enviado</th>
                        <th>Entregado</th>
                        <th>Abierto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.map((e) => (
                        <tr key={e.id}>
                          <td className="ce-td-name">{e.contacto_nombre || e.contacto_email}</td>
                          <td>{e.asunto || '---'}</td>
                          <td>{e.cuenta_email || '---'}</td>
                          <td>
                            <span className={`ce-badge ce-badge-${e.estado}`}>
                              {ESTADO_LABELS[e.estado] || e.estado}
                            </span>
                          </td>
                          <td className="ce-text-muted">
                            {e.enviado_at ? new Date(e.enviado_at).toLocaleString('es-ES') : '---'}
                          </td>
                          <td className="ce-text-muted">
                            {e.entregado_at ? new Date(e.entregado_at).toLocaleString('es-ES') : '---'}
                          </td>
                          <td className="ce-text-muted">
                            {e.abierto_at ? new Date(e.abierto_at).toLocaleString('es-ES') : '---'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ce-pagination">
                  <button
                    className="ce-btn ce-btn-sm"
                    disabled={paginaLog <= 1}
                    onClick={() => setPaginaLog((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span className="ce-pagination-info">
                    Pagina {paginaLog} de {totalPagesLog} ({totalLog} envios)
                  </span>
                  <button
                    className="ce-btn ce-btn-sm"
                    disabled={paginaLog >= totalPagesLog}
                    onClick={() => setPaginaLog((p) => p + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : (
              <div className="ce-empty">
                <div className="ce-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <p>No hay envios registrados{busquedaLog ? ' para esta busqueda' : ''}.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
