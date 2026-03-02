import { formatMoneda, formatFecha } from '../../utils/formatters'
import WalletTableSkeleton from './WalletTableSkeleton'

const estadoConfig = {
  pendiente: { label: 'Pendiente', className: 'wt-badge-pendiente' },
  aprobado: { label: 'Aprobado', className: 'wt-badge-aprobado' },
  rechazado: { label: 'Rechazado', className: 'wt-badge-rechazado' },
}

export default function WalletRetiros({ retiros, total, pagina, onPageChange, pageSize, loading }) {
  const totalPages = Math.ceil(total / pageSize)
  if (loading && retiros.length === 0) {
    return <WalletTableSkeleton rows={5} cols={5} />
  }

  if (retiros.length === 0) {
    return <div className="wt-empty">No hay retiros registrados</div>
  }

  return (
    <div className="wt-retiros">
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
    </div>
  )
}
