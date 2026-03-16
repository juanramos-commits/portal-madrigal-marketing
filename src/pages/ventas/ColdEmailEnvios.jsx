import { useState, useEffect } from 'react'
import { useCEEnvios } from '../../hooks/useCEEnvios'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'

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

  const {
    envios,
    cola,
    loading,
    error,
    total,
    page,
    setPage,
    setSearch,
    setDateRange,
    cargarCola,
    cancelarEnvio,
    pageSize: PAGE_SIZE,
  } = useCEEnvios()

  useEffect(() => {
    cargarCola()
  }, [cargarCola])

  const totalPagesLog = Math.ceil((total || 0) / PAGE_SIZE)

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

      {/* Tabs */}
      <div className="ce-tabs">
        <button
          className={`ce-tab ${tab === 'cola' ? 'ce-tab-active' : ''}`}
          onClick={() => setTab('cola')}
        >
          Cola ({cola?.length || 0})
        </button>
        <button
          className={`ce-tab ${tab === 'log' ? 'ce-tab-active' : ''}`}
          onClick={() => setTab('log')}
        >
          Log ({total || 0})
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
                          <td className="ce-td-name">{e.contacto?.nombre || e.contacto?.email || '---'}</td>
                          <td>{e.secuencia?.nombre || '---'}</td>
                          <td>Paso {e.paso?.orden || e.paso_actual || '?'}</td>
                          <td>---</td>
                          <td className="ce-text-muted">
                            {e.proximo_envio_at
                              ? new Date(e.proximo_envio_at).toLocaleString('es-ES')
                              : '---'}
                          </td>
                          <td>
                            <div className="ce-action-btns">
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
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              />
              <div className="ce-date-filters">
                <div className="ce-form-field-inline">
                  <label className="ce-label">Desde</label>
                  <input
                    type="date"
                    className="ce-input ce-input-sm"
                    onChange={(e) => { setDateRange(prev => ({ ...prev, desde: e.target.value })); setPage(0) }}
                  />
                </div>
                <div className="ce-form-field-inline">
                  <label className="ce-label">Hasta</label>
                  <input
                    type="date"
                    className="ce-input ce-input-sm"
                    onChange={(e) => { setDateRange(prev => ({ ...prev, hasta: e.target.value })); setPage(0) }}
                  />
                </div>
              </div>
            </div>

            {envios?.length > 0 ? (
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
                      {envios.map((e) => (
                        <tr key={e.id}>
                          <td className="ce-td-name">{e.contacto?.nombre || e.contacto?.email || '---'}</td>
                          <td>{e.paso?.asunto_a || '---'}</td>
                          <td>{e.cuenta?.email || '---'}</td>
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
                    disabled={page <= 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span className="ce-pagination-info">
                    Pagina {page + 1} de {totalPagesLog || 1} ({total} envios)
                  </span>
                  <button
                    className="ce-btn ce-btn-sm"
                    disabled={page + 1 >= totalPagesLog}
                    onClick={() => setPage((p) => p + 1)}
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
                <p>No hay envios registrados.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
