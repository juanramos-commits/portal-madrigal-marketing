import { Search, X } from 'lucide-react'
import { formatMoneda, formatFecha } from '../../utils/formatters'
import WalletTableSkeleton from './WalletTableSkeleton'

const estadoConfig = {
  pendiente: { label: 'Pendiente', className: 'wt-badge-pendiente' },
  aprobado: { label: 'Aprobado', className: 'wt-badge-aprobado' },
  rechazado: { label: 'Rechazado', className: 'wt-badge-rechazado' },
}

export default function WalletRetiros({ retiros, total, pagina, onPageChange, pageSize, loading, busqueda, onBusquedaChange }) {
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="wt-retiros">
      <div className="wt-filtros-row">
        <div className="wt-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar retiros..."
            value={busqueda}
            onChange={e => onBusquedaChange(e.target.value)}
          />
          {busqueda && (
            <button className="wt-search-clear" onClick={() => onBusquedaChange('')} title="Limpiar">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading && retiros.length === 0 ? (
        <WalletTableSkeleton rows={5} cols={5} />
      ) : retiros.length === 0 ? (
        <div className="wt-empty">{busqueda ? 'Sin resultados' : 'No hay retiros registrados'}</div>
      ) : (
      <>
      {/* Desktop table */}
      <div className="wt-desktop-only">
        <div className="wt-table-wrap">
          <table className="wt-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Importe</th>
                <th>Estado</th>
                <th>Factura</th>
                <th>Motivo rechazo</th>
              </tr>
            </thead>
            <tbody>
              {retiros.map(r => {
                const estado = estadoConfig[r.estado] || estadoConfig.pendiente
                return (
                  <tr key={r.id}>
                    <td>{formatFecha(r.created_at)}</td>
                    <td className="wt-cell-bold">{formatMoneda(r.monto)}</td>
                    <td><span className={`wt-badge ${estado.className}`}>{estado.label}</span></td>
                    <td>{r.factura?.numero_factura || '-'}</td>
                    <td>{r.motivo_rechazo || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="wt-mobile-only">
        {retiros.map(r => {
          const estado = estadoConfig[r.estado] || estadoConfig.pendiente
          return (
            <div key={r.id} className="wt-retiro-card">
              <div className="wt-retiro-top">
                <span className={`wt-badge ${estado.className}`}>{estado.label}</span>
                <span className="wt-amount-bold">{formatMoneda(r.monto)}</span>
              </div>
              <div className="wt-retiro-meta">
                <span>{formatFecha(r.created_at)}</span>
                {r.factura?.numero_factura && <span>Factura: {r.factura.numero_factura}</span>}
              </div>
              {r.motivo_rechazo && (
                <div className="wt-retiro-motivo">Motivo: {r.motivo_rechazo}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="wt-pagination">
          <span>Página {pagina + 1} de {totalPages}</span>
          <div className="wt-pagination-btns">
            <button disabled={pagina === 0} onClick={() => onPageChange(pagina - 1)}>Anterior</button>
            <button disabled={pagina >= totalPages - 1} onClick={() => onPageChange(pagina + 1)}>Siguiente</button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
