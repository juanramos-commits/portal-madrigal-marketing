import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachContacts } from '../../hooks/useOutreachContacts'
import { getList, getContacts as getContactsDirect } from '../../lib/coldOutreach'
import '../../styles/ventas-email.css'

const STATUS_COLORS = {
  new: 've-badge--gray',
  verified: 've-badge--blue',
  contacted: 've-badge--yellow',
  opened: 've-badge--green',
  clicked: 've-badge--green',
  replied: 've-badge--green',
  bounced: 've-badge--red',
  unsubscribed: 've-badge--red',
  invalid: 've-badge--red',
}

const STATUS_LABELS = {
  new: 'Nuevo',
  verified: 'Verificado',
  contacted: 'Contactado',
  opened: 'Abierto',
  clicked: 'Click',
  replied: 'Respondido',
  bounced: 'Rebotado',
  unsubscribed: 'Desuscrito',
  invalid: 'Inválido',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'new', label: 'Nuevo' },
  { value: 'verified', label: 'Verificado' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'opened', label: 'Abierto' },
  { value: 'clicked', label: 'Click' },
  { value: 'replied', label: 'Respondido' },
  { value: 'bounced', label: 'Rebotado' },
  { value: 'unsubscribed', label: 'Desuscrito' },
  { value: 'invalid', label: 'Inválido' },
]

const PAGE_SIZE = 25

export default function OutreachListDetail() {
  const { id: listId } = useParams()
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const { contacts: hookContacts, total, loading: hookLoading, importar } = useOutreachContacts()

  const [listInfo, setListInfo] = useState(null)
  const [contactsList, setContactsList] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchList = async () => {
      try {
        const { data, error: err } = await getList(listId)
        if (err) throw err
        if (data) setListInfo(data)
      } catch (e) {
        console.error('Error cargando lista:', e)
      }
    }
    if (listId) fetchList()
  }, [listId])

  const fetchContacts = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, count, error: err } = await getContactsDirect({
        listId,
        search,
        status: statusFilter,
        page,
        limit: PAGE_SIZE,
      })
      if (err) throw err
      setContactsList(data || [])
      setTotalCount(count || 0)
    } catch (e) {
      setError(e.message || 'Error cargando contactos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (listId) fetchContacts()
  }, [listId, search, statusFilter, page])

  if (!tienePermiso('ventas.outreach.listas.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE)

  const handleImport = async () => {
    try {
      let parsed
      const trimmed = importData.trim()
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        parsed = JSON.parse(trimmed)
        if (!Array.isArray(parsed)) parsed = [parsed]
      } else {
        const lines = trimmed.split('\n').filter(Boolean)
        const headers = lines[0].split(',').map((h) => h.trim())
        parsed = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim())
          const obj = {}
          headers.forEach((h, i) => { obj[h] = values[i] || '' })
          return obj
        })
      }
      await importar(listId, parsed)
      showToast(`${parsed.length} contactos importados`, 'success')
      setShowImport(false)
      setImportData('')
      setPage(0)
      // Re-fetch contacts after import
      const { data, count } = await getContactsDirect({ listId, search, status: statusFilter, page: 0, limit: PAGE_SIZE })
      setContactsList(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      showToast(err.message || 'Error al importar contactos', 'error')
    }
  }

  const stats = [
    { label: 'Total', value: listInfo?.total_contacts ?? totalCount ?? 0 },
  ]

  return (
    <div className="ve-page">
      <div className="ve-header">
        <div>
          <button className="ve-btn ve-btn--sm" onClick={() => navigate('/ventas/outreach/listas')} style={{ marginRight: '1rem' }}>
            &larr; Volver
          </button>
          <h1 style={{ display: 'inline' }}>{listInfo?.name || 'Lista'}</h1>
          {listInfo?.description && (
            <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>{listInfo.description}</p>
          )}
        </div>
        {tienePermiso('ventas.outreach.listas.importar') && (
          <button className="ve-btn ve-btn--primary" onClick={() => setShowImport(true)}>
            Importar Contactos
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="ve-kpi-grid">
        {stats.map((s) => (
          <div key={s.label} className="ve-kpi-card">
            <span className="ve-kpi-label">{s.label}</span>
            <span className="ve-kpi-value">{Number(s.value).toLocaleString('es-ES')}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="ve-toolbar">
        <input
          type="text"
          className="ve-search-input"
          placeholder="Buscar contactos..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        />
        <select
          className="ve-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Contacts Table */}
      {error ? (
        <div className="ve-error" role="alert" style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ marginBottom: 12 }}>{error}</p>
          <button onClick={fetchContacts} className="btn primary">Reintentar</button>
        </div>
      ) : loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando contactos...</span>
        </div>
      ) : contactsList.length === 0 ? (
        <div className="ve-empty">No se encontraron contactos.</div>
      ) : (
        <>
          <div className="ve-table-wrapper">
            <table className="ve-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombre</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Añadido</th>
                </tr>
              </thead>
              <tbody>
                {contactsList.map((c) => (
                  <tr key={c.id} className="ve-table-row">
                    <td>{c.email}</td>
                    <td>{c.first_name || c.last_name ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '—'}</td>
                    <td>{c.company || '—'}</td>
                    <td>
                      <span className={`ve-badge ${STATUS_COLORS[c.status] || 've-badge--gray'}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ve-toolbar" style={{ justifyContent: 'center', gap: '0.5rem' }}>
              <button className="ve-btn ve-btn--sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Página {page + 1} de {totalPages}</span>
              <button className="ve-btn ve-btn--sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="ve-modal-overlay" onClick={() => setShowImport(false)}>
          <div className="ve-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Importar Contactos</h2>
            <div className="ve-form-group">
              <label className="ve-label">Pega CSV o JSON</label>
              <textarea
                className="ve-input"
                rows={10}
                placeholder={'email,first_name,last_name,company\njuan@ejemplo.com,Juan,García,Acme\n\no bien JSON:\n[{"email":"juan@ejemplo.com","first_name":"Juan"}]'}
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
              />
            </div>
            <div className="ve-modal-actions">
              <button className="ve-btn" onClick={() => setShowImport(false)}>Cancelar</button>
              <button className="ve-btn ve-btn--primary" onClick={handleImport}>Importar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
