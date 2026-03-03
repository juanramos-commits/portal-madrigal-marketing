import { Download, FileSpreadsheet, Search, X } from 'lucide-react'
import { generarFacturaPDF, generarCSVFacturas } from '../../utils/generarFacturaPDF'
import Select from '../ui/Select'
import { formatMoneda, formatFecha } from '../../utils/formatters'
import WalletTableSkeleton from './WalletTableSkeleton'

export default function WalletAdminFacturas({
  facturas,
  filtroUsuario,
  onFiltroUsuarioChange,
  miembros,
  loading,
  busqueda,
  onBusquedaChange,
}) {
  const handleDescargar = (factura) => {
    generarFacturaPDF(factura)
  }

  const handleExportCSV = () => {
    generarCSVFacturas(facturas)
  }

  return (
    <div className="wt-admin-facturas">
      {/* Filters */}
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
        <Select value={filtroUsuario} onChange={e => onFiltroUsuarioChange(e.target.value)}>
          <option value="">Todos los miembros</option>
          {miembros.map(m => (
            <option key={m.id} value={m.id}>{m.nombre || m.email}</option>
          ))}
        </Select>

        <button className="wt-action-btn" onClick={handleExportCSV} disabled={facturas.length === 0}>
          <FileSpreadsheet size={14} /> Exportar CSV
        </button>
      </div>

      {loading && facturas.length === 0 ? (
        <WalletTableSkeleton rows={5} cols={7} />
      ) : facturas.length === 0 ? (
        <div className="wt-empty">No hay facturas</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="wt-desktop-only">
            <div className="wt-table-wrap">
              <table className="wt-table">
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th>Nº Factura</th>
                    <th>Fecha</th>
                    <th>Base</th>
                    <th>IVA</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map(f => (
                    <tr key={f.id}>
                      <td className="wt-cell-bold">{f.usuario?.nombre || f.usuario?.email || '-'}</td>
                      <td>{f.numero_factura}</td>
                      <td>{formatFecha(f.fecha_emision)}</td>
                      <td>{formatMoneda(f.base_imponible)}</td>
                      <td>{formatMoneda(f.iva_monto)}</td>
                      <td className="wt-cell-bold">{formatMoneda(f.total)}</td>
                      <td>
                        <button className="wt-action-btn" onClick={() => handleDescargar(f)} title="PDF">
                          <Download size={14} />
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
                  <div>
                    <span className="wt-cell-bold wt-block">{f.usuario?.nombre || '-'}</span>
                    <span className="wt-meta">{f.numero_factura}</span>
                  </div>
                  <span className="wt-amount-bold">{formatMoneda(f.total)}</span>
                </div>
                <div className="wt-factura-meta">
                  <span>{formatFecha(f.fecha_emision)}</span>
                  <span>Base: {formatMoneda(f.base_imponible)} + IVA {formatMoneda(f.iva_monto)}</span>
                </div>
                <button className="wt-action-btn" onClick={() => handleDescargar(f)}>
                  <Download size={14} /> PDF
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
