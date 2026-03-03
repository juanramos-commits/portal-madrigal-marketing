import { useNavigate } from 'react-router-dom'
import { ChevronUp, ChevronDown } from 'lucide-react'
import WhatsAppIcon from '../icons/WhatsAppIcon'

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function CRMTabla({
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
  const totalPages = Math.ceil(totalCount / pageSize)

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
      <div className="crm-table-wrap">
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
                  <td key={c.key}><span className="crm-skeleton" style={{ width: '80%', height: 14, display: 'block' }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  style={col.sortable === false ? { cursor: 'default' } : undefined}
                  aria-sort={sort.col === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.label}
                  {sort.col === col.key && (sort.dir === 'asc' ? <ChevronUp /> : <ChevronDown />)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  No se encontraron leads
                </td>
              </tr>
            ) : (
              leads.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/ventas/crm/lead/${lead.id}`)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/ventas/crm/lead/${lead.id}`) } }}
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600 }}>{lead.nombre}</td>
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
                        className="crm-card-wa"
                        style={{ width: 26, height: 26 }}
                        onClick={e => handleWhatsApp(e, lead.telefono)}
                        title="WhatsApp"
                      >
                        <WhatsAppIcon size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="crm-pagination">
          <span>
            Página {page + 1} de {totalPages} ({totalCount} leads)
          </span>
          <div className="crm-pagination-btns">
            <button disabled={page === 0} onClick={() => onPageChange(page - 1)}>
              Anterior
            </button>
            <button disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  )
}
