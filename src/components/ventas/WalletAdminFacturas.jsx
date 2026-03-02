import { generarFacturaPDF, generarCSVFacturas } from '../../utils/generarFacturaPDF'
import Select from '../ui/Select'
import { formatMoneda, formatFecha } from '../../utils/formatters'

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const CsvIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)

export default function WalletAdminFacturas({
  facturas,
  filtroUsuario,
  onFiltroUsuarioChange,
  miembros,
  loading,
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
        <Select value={filtroUsuario} onChange={e => onFiltroUsuarioChange(e.target.value)}>
          <option value="">Todos los miembros</option>
          {miembros.map(m => (
            <option key={m.id} value={m.id}>{m.nombre || m.email}</option>
          ))}
        </Select>

        <button className="wt-action-btn" onClick={handleExportCSV} disabled={facturas.length === 0}>
          <CsvIcon /> Exportar CSV
        </button>
      </div>

      {loading && facturas.length === 0 ? (
        <div className="wt-loading">Cargando facturas...</div>
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
                      <td style={{ fontWeight: 600 }}>{f.usuario?.nombre || f.usuario?.email || '-'}</td>
                      <td>{f.numero_factura}</td>
                      <td>{formatFecha(f.fecha_emision)}</td>
                      <td>{formatMoneda(f.base_imponible)}</td>
                      <td>{formatMoneda(f.iva_monto)}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoneda(f.total)}</td>
                      <td>
                        <button className="wt-action-btn" onClick={() => handleDescargar(f)} title="PDF">
                          <DownloadIcon />
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
                    <span style={{ fontWeight: 600, display: 'block' }}>{f.usuario?.nombre || '-'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.numero_factura}</span>
                  </div>
                  <span style={{ fontWeight: 700 }}>{formatMoneda(f.total)}</span>
                </div>
                <div className="wt-factura-meta">
                  <span>{formatFecha(f.fecha_emision)}</span>
                  <span>Base: {formatMoneda(f.base_imponible)} + IVA {formatMoneda(f.iva_monto)}</span>
                </div>
                <button className="wt-action-btn" onClick={() => handleDescargar(f)}>
                  <DownloadIcon /> PDF
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
