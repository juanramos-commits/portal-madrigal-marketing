import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronUp, ChevronDown, Users } from 'lucide-react'
import WhatsAppIcon from '../icons/WhatsAppIcon'

function formatDate(d) {
  if (!d) return '-'
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y.slice(2)}`
  }
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default memo(function CRMTabla({
  leads,
  totalCount,
  page,
  onPageChange,
  sort,
  onSortChange,
  loading,
}) {
  const navigate = useNavigate()
  const pageSize = 50
  const totalPages = Math.ceil((totalCount || 0) / pageSize) || 1

  const handlePageChange = (newPage) => {
    onPageChange(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSort = (col) => {
    onSortChange({
      col,
      dir: sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc',
    })
  }

  const handleWhatsApp = (e, phone) => {
    e.stopPropagation()
    if (!phone) return
    const cleaned = phone.replace(/[^0-9+]/g, '')
    window.open(`https://wa.me/${cleaned}`, '_blank', 'noopener,noreferrer')
  }

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'categoria', label: 'Categoría', sortable: false },
    { key: 'etapa', label: 'Etapa', sortable: false },
    { key: 'setter', label: 'Setter', sortable: false },
    { key: 'closer', label: 'Closer', sortable: false },
    { key: 'fuente', label: 'Fuente' },
    { key: 'created_at', label: 'Fecha' },
    { key: 'wa', label: '', sortable: false },
  ]

  if (loading && leads.length === 0) {
    return (
      <>
        {/* Desktop skeleton */}
        <div className="crm-table-wrap crm-desktop-only">
          <table className="crm-table">
            <thead>
              <tr>
                {columns.map(c => <th key={c.key}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  {columns.map(c => (
                    <td key={c.key}><span className="crm-skeleton crm-skeleton-cell" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile skeleton */}
        <div className="crm-mobile-only crm-m-list">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="crm-m-card crm-m-card--skeleton">
              <div className="crm-skeleton" style={{ width: '60%', height: 16, borderRadius: 4 }} />
              <div className="crm-skeleton" style={{ width: '40%', height: 12, borderRadius: 4, marginTop: 8 }} />
              <div className="crm-skeleton" style={{ width: '50%', height: 12, borderRadius: 4, marginTop: 6 }} />
            </div>
          ))}
        </div>
      </>
    )
  }

  /* ── Empty state ──────────────────────────────────────────── */
  if (leads.length === 0) {
    return (
      <div className="crm-m-empty">
        <Users size={32} strokeWidth={1.5} />
        <span>No se encontraron leads</span>
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop table ─────────────────────────────────────── */}
      <div className="crm-table-wrap crm-desktop-only">
        <table className="crm-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  onKeyDown={col.sortable !== false ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key) } } : undefined}
                  tabIndex={col.sortable !== false ? 0 : undefined}
                  className={col.sortable === false ? 'crm-th-static' : undefined}
                  aria-sort={sort.col === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  aria-roledescription={col.sortable !== false ? 'Columna ordenable' : undefined}
                >
                  {col.label}
                  {sort.col === col.key && (sort.dir === 'asc' ? <ChevronUp /> : <ChevronDown />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr
                key={lead.id}
                onClick={() => navigate(`/ventas/crm/lead/${lead.id}`)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/ventas/crm/lead/${lead.id}`) } }}
                tabIndex={0}
              >
                <td className="crm-cell-bold">{lead.nombre}</td>
                <td>{lead.telefono || '-'}</td>
                <td>{lead.email || '-'}</td>
                <td>{lead.categoria?.nombre || '-'}</td>
                <td>
                  {lead.etapa ? (
                    <span className="crm-table-etapa">
                      <span className="crm-table-etapa-dot" style={{ background: lead.etapa.color || 'var(--text-muted)' }} />
                      {lead.etapa.nombre}
                    </span>
                  ) : '-'}
                </td>
                <td>{lead.setter?.nombre || '-'}</td>
                <td>{lead.closer?.nombre || '-'}</td>
                <td>{lead.fuente || '-'}</td>
                <td>{formatDate(lead.created_at)}</td>
                <td>
                  {lead.telefono && (
                    <button
                      className="crm-card-wa crm-card-wa--sm"
                      onClick={e => handleWhatsApp(e, lead.telefono)}
                      aria-label="Enviar WhatsApp"
                    >
                      <WhatsAppIcon size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ──────────────────────────────────────── */}
      <div className="crm-mobile-only crm-m-list">
        {leads.map(lead => (
          <div
            key={lead.id}
            className="crm-m-card"
            onClick={() => navigate(`/ventas/crm/lead/${lead.id}`)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/ventas/crm/lead/${lead.id}`) } }}
            tabIndex={0}
            role="button"
          >
            <div className="crm-m-card-top">
              <span className="crm-m-card-name">{lead.nombre}</span>
              {lead.etapa && (
                <span className="crm-table-etapa">
                  <span className="crm-table-etapa-dot" style={{ background: lead.etapa.color || 'var(--text-muted)' }} />
                  {lead.etapa.nombre}
                </span>
              )}
            </div>
            <div className="crm-m-card-meta">
              {lead.telefono && (
                <span className="crm-m-card-chip">
                  {lead.telefono}
                  <button
                    className="crm-card-wa crm-card-wa--sm"
                    onClick={e => handleWhatsApp(e, lead.telefono)}
                    aria-label="Enviar WhatsApp"
                  >
                    <WhatsAppIcon size={13} />
                  </button>
                </span>
              )}
              {lead.categoria?.nombre && (
                <span className="crm-m-card-chip">{lead.categoria.nombre}</span>
              )}
              <span className="crm-m-card-chip crm-m-card-date">{formatDate(lead.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="crm-pagination">
          <span>
            Página {page + 1} de {totalPages} ({totalCount} leads)
          </span>
          <div className="crm-pagination-btns">
            <button disabled={page === 0} onClick={() => handlePageChange(page - 1)}>
              Anterior
            </button>
            <button disabled={page >= totalPages - 1} onClick={() => handlePageChange(page + 1)}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  )
})
