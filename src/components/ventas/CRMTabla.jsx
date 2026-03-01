import { useNavigate } from 'react-router-dom'
import { ChevronUp, ChevronDown } from 'lucide-react'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

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
    window.open(`https://wa.me/${cleaned}`, '_blank')
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
                <tr key={lead.id} onClick={() => navigate(`/ventas/crm/lead/${lead.id}`)}>
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
                        <WhatsAppIcon />
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
