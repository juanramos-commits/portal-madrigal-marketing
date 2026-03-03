import { useState, useCallback, useRef, memo, Fragment } from 'react'
import { Check, Minus } from 'lucide-react'
import VentaDetalle from './VentaDetalle'
import VentaCambioEstado from './VentaCambioEstado'
import ModalCambioEstado from './ModalCambioEstado'

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

export default memo(function VentasListado({
  ventas,
  totalCount,
  page,
  pageSize,
  onPageChange,
  loading,
  esAdmin,
  onCambiarEstado,
  cargarComisiones,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [comisionesMap, setComisionesMap] = useState({})
  const [loadingComisiones, setLoadingComisiones] = useState({})
  const [modal, setModal] = useState(null)
  const loadedComisionesRef = useRef({})

  const handleCambioEstado = (ventaId, nuevoEstado, venta) => {
    setModal({ type: 'cambio-estado', ventaId, nuevoEstado, venta })
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  const toggleExpand = (ventaId) => {
    setExpandedId(prev => prev === ventaId ? null : ventaId)
  }

  const handleLoadComisiones = useCallback(async (ventaId) => {
    if (loadedComisionesRef.current[ventaId]) return
    loadedComisionesRef.current[ventaId] = true
    setLoadingComisiones(prev => ({ ...prev, [ventaId]: true }))
    try {
      const data = await cargarComisiones(ventaId)
      setComisionesMap(prev => ({ ...prev, [ventaId]: data }))
    } catch (err) {
      console.warn('Error cargando comisiones:', err)
      loadedComisionesRef.current[ventaId] = false
    } finally {
      setLoadingComisiones(prev => ({ ...prev, [ventaId]: false }))
    }
  }, [cargarComisiones])

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
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {Array(9).fill(0).map((_, j) => (
                  <td key={j}><span className="vv-skeleton vv-skeleton-cell" /></td>
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
                {esAdmin ? (
                  <VentaCambioEstado venta={venta} onCambio={handleCambioEstado} />
                ) : (
                  <span className={`vv-badge ${estado.className}`}>{estado.label}</span>
                )}
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
          </tr>
        </thead>
        <tbody>
          {ventas.length === 0 ? (
            <tr>
              <td colSpan={9} className="vv-table-empty">
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
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(venta.id) } }}
                >
                  <td className="vv-cell-bold">{venta.lead?.nombre || '-'}</td>
                  <td>{formatDate(venta.fecha_venta)}</td>
                  <td>{venta.paquete?.nombre || '-'}</td>
                  <td className="vv-cell-bold">{formatImporte(venta.importe)}</td>
                  <td>
                    <span className={`vv-metodo-badge vv-metodo-${venta.metodo_pago}`}>
                      {metodoLabels[venta.metodo_pago] || '-'}
                    </span>
                  </td>
                  <td>{venta.es_pago_unico ? <Check size={14} /> : <Minus size={14} />}</td>
                  <td>{venta.setter?.nombre || '-'}</td>
                  <td>{venta.closer?.nombre || '-'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {esAdmin ? (
                      <VentaCambioEstado venta={venta} onCambio={handleCambioEstado} />
                    ) : (
                      <span className={`vv-badge ${estado.className}`}>{estado.label}</span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="vv-expanded-row">
                    <td colSpan={9}>
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
      <div className="vv-table-container">
        {loading && ventas.length > 0 && (
          <div className="vv-loading-overlay" />
        )}
        <div className="vv-desktop-only">{renderTable()}</div>
        <div className="vv-mobile-only">{renderCards()}</div>
      </div>

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

      {/* Modal de cambio de estado */}
      {modal?.type === 'cambio-estado' && (
        <ModalCambioEstado
          venta={modal.venta}
          nuevoEstado={modal.nuevoEstado}
          onConfirm={async () => {
            await onCambiarEstado(modal.ventaId, modal.nuevoEstado, modal.venta)
            handleActionDone()
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  )
})
