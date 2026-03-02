import { generarFacturaPDF } from '../../utils/generarFacturaPDF'
import { formatMoneda, formatFecha } from '../../utils/formatters'

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

export default function WalletFacturas({ facturas, total, pagina, onPageChange, pageSize, loading, datosFiscales }) {
  const totalPages = Math.ceil(total / pageSize)
  const handleDescargar = (factura) => {
    generarFacturaPDF({
      ...factura,
      iban: datosFiscales?.cuenta_bancaria_iban || '',
    })
  }

  if (loading && facturas.length === 0) {
    return <div className="wt-loading">Cargando facturas...</div>
  }

  if (facturas.length === 0) {
    return <div className="wt-empty">No hay facturas registradas</div>
  }

  return (
    <div className="wt-facturas">
      {/* Desktop */}
      <div className="wt-desktop-only">
        <div className="wt-table-wrap">
          <table className="wt-table">
            <thead>
              <tr>
                <th>Nº Factura</th>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Base</th>
                <th>IVA</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{f.numero_factura}</td>
                  <td>{formatFecha(f.fecha_emision)}</td>
                  <td>{f.concepto}</td>
                  <td>{formatMoneda(f.base_imponible)}</td>
                  <td>{formatMoneda(f.iva_monto)} ({f.iva_porcentaje}%)</td>
                  <td style={{ fontWeight: 600 }}>{formatMoneda(f.total)}</td>
                  <td>
                    <button className="wt-action-btn" onClick={() => handleDescargar(f)} title="Descargar PDF">
                      <DownloadIcon /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <div className="wt-mobile-only">
        {facturas.map(f => (
          <div key={f.id} className="wt-factura-card">
            <div className="wt-factura-top">
              <span style={{ fontWeight: 600 }}>{f.numero_factura}</span>
              <span style={{ fontWeight: 700 }}>{formatMoneda(f.total)}</span>
            </div>
            <div className="wt-factura-meta">
              <span>{formatFecha(f.fecha_emision)}</span>
              <span>Base: {formatMoneda(f.base_imponible)} + IVA {formatMoneda(f.iva_monto)}</span>
            </div>
            <button className="wt-action-btn" onClick={() => handleDescargar(f)}>
              <DownloadIcon /> Descargar PDF
            </button>
          </div>
        ))}
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
