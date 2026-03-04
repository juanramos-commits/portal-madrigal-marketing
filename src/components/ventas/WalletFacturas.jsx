import { Download, Search, X, FileText } from 'lucide-react'
import { generarFacturaPDF } from '../../utils/generarFacturaPDF'
import { formatMoneda, formatFecha, formatDatosBancarios } from '../../utils/formatters'
import WalletTableSkeleton from './WalletTableSkeleton'

export default function WalletFacturas({ facturas, total, pagina, onPageChange, pageSize, loading, datosFiscales, busqueda, onBusquedaChange }) {
  const totalPages = Math.ceil(total / pageSize)
  const handleDescargar = (factura) => {
    try {
      generarFacturaPDF({
        ...factura,
        iban: formatDatosBancarios(datosFiscales),
      })
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Error al generar la factura PDF. Verifica tus datos fiscales.')
    }
  }

  return (
    <div className="wt-facturas">
      <div className="wt-filtros-row">
        <div className="wt-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar facturas..."
            value={busqueda}
            onChange={e => onBusquedaChange(e.target.value)}
            aria-label="Buscar facturas"
          />
          {busqueda && (
            <button className="wt-search-clear" onClick={() => onBusquedaChange('')} aria-label="Limpiar búsqueda">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading && facturas.length === 0 ? (
        <WalletTableSkeleton rows={5} cols={7} />
      ) : facturas.length === 0 ? (
        <div className="wt-empty"><FileText size={32} className="wt-empty-icon" /><span>{busqueda ? 'Sin resultados' : 'No hay facturas registradas'}</span>{!busqueda && <span className="wt-empty-hint">Las facturas se generan automáticamente al aprobar retiros</span>}</div>
      ) : (
      <>
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
                  <td className="wt-cell-bold">{f.numero_factura}</td>
                  <td>{formatFecha(f.fecha_emision)}</td>
                  <td>{f.concepto}</td>
                  <td>{formatMoneda(f.base_imponible)}</td>
                  <td>{formatMoneda(f.iva_monto)} ({f.iva_porcentaje}%)</td>
                  <td className="wt-cell-bold">{formatMoneda(f.total)}</td>
                  <td>
                    <button className="wt-action-btn" onClick={() => handleDescargar(f)} aria-label="Descargar PDF">
                      <Download size={14} /> PDF
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
              <span className="wt-cell-bold">{f.numero_factura}</span>
              <span className="wt-amount-bold">{formatMoneda(f.total)}</span>
            </div>
            <div className="wt-factura-meta">
              <span>{formatFecha(f.fecha_emision)}</span>
              <span>Base: {formatMoneda(f.base_imponible)} + IVA {formatMoneda(f.iva_monto)}</span>
            </div>
            <button className="wt-action-btn" onClick={() => handleDescargar(f)}>
              <Download size={14} /> Descargar PDF
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
      </>
      )}
    </div>
  )
}
