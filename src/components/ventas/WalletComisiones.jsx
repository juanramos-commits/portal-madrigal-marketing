import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from '../ui/Select'
import { formatMoneda, formatFecha } from '../../utils/formatters'

function formatFechaCorta(d) {
  if (!d) return 'Disponible'
  if (new Date(d) <= new Date()) return 'Disponible'
  return formatFecha(d)
}

function getTipo(c) {
  if (c.monto < 0) return 'Devolución'
  if (c.es_bonus) return 'Bonus'
  return 'Fija'
}

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

export default function WalletComisiones({
  comisiones,
  total,
  pagina,
  pageSize,
  onPageChange,
  filtroTipo,
  filtroDesde,
  filtroHasta,
  onFiltroTipoChange,
  onFiltroDesdeChange,
  onFiltroHastaChange,
  esAdmin,
  miembros,
  usuarioId,
  onUsuarioIdChange,
  loading,
}) {
  const navigate = useNavigate()
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="wt-comisiones">
      {/* Filters */}
      <div className="wt-filtros-row">
        <Select value={filtroTipo} onChange={e => onFiltroTipoChange(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="fijas">Fijas</option>
          <option value="bonus">Bonus</option>
          <option value="negativas">Devoluciones</option>
        </Select>
        <input type="date" value={filtroDesde} onChange={e => onFiltroDesdeChange(e.target.value)} placeholder="Desde" />
        <input type="date" value={filtroHasta} onChange={e => onFiltroHastaChange(e.target.value)} placeholder="Hasta" />
        {esAdmin && miembros.length > 0 && (
          <Select value={usuarioId} onChange={e => onUsuarioIdChange(e.target.value)}>
            <option value="">Mis comisiones</option>
            {miembros.map(m => (
              <option key={m.id} value={m.id}>{m.nombre || m.email}</option>
            ))}
          </Select>
        )}
      </div>

      {loading && comisiones.length === 0 ? (
        <div className="wt-loading">Cargando comisiones...</div>
      ) : comisiones.length === 0 ? (
        <div className="wt-empty">No hay comisiones registradas</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="wt-desktop-only">
            <div className="wt-table-wrap">
              <table className="wt-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Rol</th>
                    <th>Tipo</th>
                    <th>Importe</th>
                    <th>Disponible desde</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {comisiones.map(c => (
                    <tr key={c.id}>
                      <td>{formatFecha(c.created_at)}</td>
                      <td>{c.concepto}</td>
                      <td>{c.rol}</td>
                      <td>{getTipo(c)}</td>
                      <td className={c.monto < 0 ? 'wt-text-danger' : 'wt-text-success'}>
                        {c.monto >= 0 ? '+' : ''}{formatMoneda(c.monto)}
                      </td>
                      <td>{formatFechaCorta(c.disponible_desde)}</td>
                      <td>
                        {c.venta?.lead?.id && (
                          <button className="wt-link-btn" onClick={() => navigate(`/ventas/crm/lead/${c.venta.lead.id}`)}>
                            <LinkIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="wt-mobile-only">
            {comisiones.map(c => (
              <div key={c.id} className="wt-comision-card">
                <div className="wt-comision-top">
                  <span className="wt-comision-tipo">{getTipo(c)} · {c.rol}</span>
                  <span className={c.monto < 0 ? 'wt-text-danger' : 'wt-text-success'} style={{ fontWeight: 700 }}>
                    {c.monto >= 0 ? '+' : ''}{formatMoneda(c.monto)}
                  </span>
                </div>
                <div className="wt-comision-concepto">{c.concepto}</div>
                <div className="wt-comision-meta">
                  <span>{formatFecha(c.created_at)}</span>
                  <span>{formatFechaCorta(c.disponible_desde)}</span>
                </div>
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
