import { useState, useCallback, Fragment } from 'react'
import VentaDetalle from './VentaDetalle'
import { ModalAprobar, ModalRechazar } from './VentaAprobacion'
import VentaDevolucion from './VentaDevolucion'

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)

const RefundIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
  </svg>
)

const DashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const ChevronIcon = ({ dir }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    {dir === 'down' ? <polyline points="6 9 12 15 18 9"/> : <polyline points="18 15 12 9 6 15"/>}
  </svg>
)

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatImporte(v) {
  return Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + '€'
}

const estadoConfig = {
  pendiente: { label: 'Pendiente', className: 'vv-badge-pendiente' },
  aprobada: { label: 'Aprobada', className: 'vv-badge-aprobada' },
  rechazada: { label: 'Rechazada', className: 'vv-badge-rechazada' },
}

const metodoLabels = { stripe: 'Stripe', sequra: 'SeQura', transferencia: 'Transferencia' }

function getEstadoDisplay(venta) {
  if (venta.es_devolucion) return { label: 'Devolución', className: 'vv-badge-devolucion' }
  return estadoConfig[venta.estado] || estadoConfig.pendiente
}

export default function VentasListado({
  ventas,
  totalCount,
  page,
  pageSize,
  onPageChange,
  loading,
  esAdmin,
  onAprobar,
  onRechazar,
  onDevolucion,
  cargarComisiones,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [comisionesMap, setComisionesMap] = useState({})
  const [loadingComisiones, setLoadingComisiones] = useState({})
  const [modal, setModal] = useState(null)

  const totalPages = Math.ceil(totalCount / pageSize)

  const toggleExpand = (ventaId) => {
    setExpandedId(prev => prev === ventaId ? null : ventaId)
  }

  const handleLoadComisiones = useCallback(async (ventaId) => {
    if (comisionesMap[ventaId]) return
    setLoadingComisiones(prev => ({ ...prev, [ventaId]: true }))
    try {
      const data = await cargarComisiones(ventaId)
      setComisionesMap(prev => ({ ...prev, [ventaId]: data }))
    } catch (_) {
      // Non-critical
    } finally {
      setLoadingComisiones(prev => ({ ...prev, [ventaId]: false }))
    }
  }, [cargarComisiones, comisionesMap])

  const handleActionDone = () => {
    setModal(null)
  }

  // ── Loading skeleton ─────────────────────────────────────────────
  if (loading && ventas.length === 0) {
    return (
      <div className="vv-table-wrap">
        <table className="vv-table">
          <thead>
            <tr>
              <th>Lead</th><th>Fecha</th><th>Paquete</th><th>Importe</th>
              <th>Método</th><th>Pago ún.</th><th>Setter</th><th>Closer</th>
              <th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {Array(10).fill(0).map((_, j) => (
                  <td key={j}><span className="vv-skeleton" style={{ width: '80%', height: 14, display: 'block' }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Mobile cards ──────────────────────────────────────────────────
  const renderCards = () => (
    <div className="vv-cards">
      {ventas.length === 0 ? (
        <div className="vv-empty">No se encontraron ventas</div>
      ) : ventas.map(venta => {
        const estado = getEstadoDisplay(venta)
        const isExpanded = expandedId === venta.id
        return (
          <div key={venta.id} className="vv-card">
            <div className="vv-card-main" onClick={() => toggleExpand(venta.id)}>
              <div className="vv-card-top">
                <span className={`vv-badge ${estado.className}`}>{estado.label}</span>
                <span className="vv-card-importe">{formatImporte(venta.importe)}</span>
              </div>
              <div className="vv-card-lead">{venta.lead?.nombre || '-'}</div>
              <div className="vv-card-paquete">{venta.paquete?.nombre || '-'}</div>
              <div className="vv-card-meta">
                <span>{metodoLabels[venta.metodo_pago] || '-'}</span>
                {venta.es_pago_unico && <span>Pago único</span>}
              </div>
              <div className="vv-card-asignados">
                <span>Setter: {venta.setter?.nombre || '-'}</span>
                <span>Closer: {venta.closer?.nombre || '-'}</span>
              </div>
              <div className="vv-card-fecha">{formatDate(venta.fecha_venta)}</div>
            </div>

            {/* Actions */}
            {esAdmin && (
              <div className="vv-card-actions">
                {venta.estado === 'pendiente' && !venta.es_devolucion && (
                  <>
                    <button className="vv-action-btn vv-action-approve" onClick={(e) => { e.stopPropagation(); setModal({ type: 'aprobar', venta }) }}>
                      <CheckIcon /> Aprobar
                    </button>
                    <button className="vv-action-btn vv-action-reject" onClick={(e) => { e.stopPropagation(); setModal({ type: 'rechazar', venta }) }}>
                      <XIcon /> Rechazar
                    </button>
                  </>
                )}
                {venta.estado === 'aprobada' && !venta.es_devolucion && (
                  <>
                    <button className="vv-action-btn vv-action-reject" onClick={(e) => { e.stopPropagation(); setModal({ type: 'revertir', venta }) }}>
                      <XIcon /> Rechazar
                    </button>
                    <button className="vv-action-btn vv-action-refund" onClick={(e) => { e.stopPropagation(); setModal({ type: 'devolucion', venta }) }}>
                      <RefundIcon /> Devolución
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div className="vv-card-detail">
                <VentaDetalle
                  venta={venta}
                  comisiones={comisionesMap[venta.id]}
                  loadingComisiones={loadingComisiones[venta.id]}
                  onLoadComisiones={handleLoadComisiones}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ── Desktop table ─────────────────────────────────────────────────
  const renderTable = () => (
    <div className="vv-table-wrap">
      <table className="vv-table">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Fecha</th>
            <th>Paquete</th>
            <th>Importe</th>
            <th>Método</th>
            <th>Pago ún.</th>
            <th>Setter</th>
            <th>Closer</th>
            <th>Estado</th>
            {esAdmin && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {ventas.length === 0 ? (
            <tr>
              <td colSpan={esAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                No se encontraron ventas
              </td>
            </tr>
          ) : ventas.map(venta => {
            const estado = getEstadoDisplay(venta)
            const isExpanded = expandedId === venta.id
            return (
              <Fragment key={venta.id}>
                <tr
                  className={`vv-table-row${isExpanded ? ' expanded' : ''}`}
                  onClick={() => toggleExpand(venta.id)}
                >
                  <td style={{ fontWeight: 600 }}>{venta.lead?.nombre || '-'}</td>
                  <td>{formatDate(venta.fecha_venta)}</td>
                  <td>{venta.paquete?.nombre || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{formatImporte(venta.importe)}</td>
                  <td>
                    <span className={`vv-metodo-badge vv-metodo-${venta.metodo_pago}`}>
                      {metodoLabels[venta.metodo_pago] || '-'}
                    </span>
                  </td>
                  <td>{venta.es_pago_unico ? <CheckIcon /> : <DashIcon />}</td>
                  <td>{venta.setter?.nombre || '-'}</td>
                  <td>{venta.closer?.nombre || '-'}</td>
                  <td><span className={`vv-badge ${estado.className}`}>{estado.label}</span></td>
                  {esAdmin && (
                    <td onClick={e => e.stopPropagation()}>
                      <div className="vv-actions-cell">
                        {venta.estado === 'pendiente' && !venta.es_devolucion && (
                          <>
                            <button className="vv-action-btn vv-action-approve" onClick={() => setModal({ type: 'aprobar', venta })} title="Aprobar">
                              <CheckIcon />
                            </button>
                            <button className="vv-action-btn vv-action-reject" onClick={() => setModal({ type: 'rechazar', venta })} title="Rechazar">
                              <XIcon />
                            </button>
                          </>
                        )}
                        {venta.estado === 'aprobada' && !venta.es_devolucion && (
                          <>
                            <button className="vv-action-btn vv-action-reject" onClick={() => setModal({ type: 'revertir', venta })} title="Rechazar">
                              <XIcon />
                            </button>
                            <button className="vv-action-btn vv-action-refund" onClick={() => setModal({ type: 'devolucion', venta })} title="Devolución">
                              <RefundIcon />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {isExpanded && (
                  <tr className="vv-expanded-row">
                    <td colSpan={esAdmin ? 10 : 9}>
                      <VentaDetalle
                        venta={venta}
                        comisiones={comisionesMap[venta.id]}
                        loadingComisiones={loadingComisiones[venta.id]}
                        onLoadComisiones={handleLoadComisiones}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      {/* Desktop table / Mobile cards */}
      <div className="vv-desktop-only">{renderTable()}</div>
      <div className="vv-mobile-only">{renderCards()}</div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="vv-pagination">
          <span>Página {page + 1} de {totalPages} ({totalCount} ventas)</span>
          <div className="vv-pagination-btns">
            <button disabled={page === 0} onClick={() => onPageChange(page - 1)}>
              Anterior
            </button>
            <button disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'aprobar' && (
        <ModalAprobar
          venta={modal.venta}
          onConfirm={async (id) => { await onAprobar(id); handleActionDone() }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'rechazar' && (
        <ModalRechazar
          venta={modal.venta}
          onConfirm={async (id) => { await onRechazar(id); handleActionDone() }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'revertir' && (
        <ModalRechazar
          venta={modal.venta}
          esReversion
          onConfirm={async (id) => { await onRechazar(id); handleActionDone() }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'devolucion' && (
        <VentaDevolucion
          venta={modal.venta}
          onConfirm={async (id) => { await onDevolucion(id); handleActionDone() }}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  )
}
