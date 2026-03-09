import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useEmailContacts } from '../../hooks/useEmailContacts'
import EngagementBadge from '../../components/ventas/email/EngagementBadge'
import LeadScoreBadge from '../../components/ventas/email/LeadScoreBadge'
import '../../styles/ventas-email.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'unsubscribed', label: 'Desuscrito' },
  { value: 'bounced', label: 'Rebotado' },
]

const STATUS_LABELS = {
  active: 'Activo',
  unsubscribed: 'Desuscrito',
  bounced: 'Rebotado',
}

const STATUS_COLORS = {
  active: 've-badge--green',
  unsubscribed: 've-badge--yellow',
  bounced: 've-badge--red',
}

const PAGE_SIZE = 50

export default function EmailContacts() {
  const { tienePermiso } = useAuth()
  const {
    contacts,
    stats,
    loading,
    page,
    total,
    hayMas,
    setSearch,
    setStatusFilter,
    setPage,
    paginaSiguiente,
    paginaAnterior,
  } = useEmailContacts()

  const [searchInput, setSearchInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [expandedContact, setExpandedContact] = useState(null)

  if (!tienePermiso('ventas.email.contactos.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = page + 1

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Contactos</h1>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="ve-stats-bar">
          <div className="ve-stat-item">
            <span className="ve-stat-label">Total</span>
            <span className="ve-stat-value">{stats.total ?? 0}</span>
          </div>
          <div className="ve-stat-item">
            <span className="ve-stat-label">Activos</span>
            <span className="ve-stat-value">{stats.active ?? 0}</span>
          </div>
          <div className="ve-stat-item">
            <span className="ve-stat-label">Desuscritos</span>
            <span className="ve-stat-value">{stats.unsubscribed ?? 0}</span>
          </div>
          <div className="ve-stat-item">
            <span className="ve-stat-label">Rebotados</span>
            <span className="ve-stat-value">{stats.bounced ?? 0}</span>
          </div>
          <div className="ve-stat-item">
            <span className="ve-stat-label">Engagement prom.</span>
            <span className="ve-stat-value">{stats.avgEngagement?.toFixed(1) ?? '—'}</span>
          </div>
          <div className="ve-stat-item">
            <span className="ve-stat-label">Lead Score prom.</span>
            <span className="ve-stat-value">{stats.avgLeadScore?.toFixed(1) ?? '—'}</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="ve-toolbar">
        <input
          type="text"
          className="ve-search-input"
          placeholder="Buscar contactos..."
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setSearch(e.target.value) }}
        />
        <select
          className="ve-select"
          value={statusInput}
          onChange={(e) => { setStatusInput(e.target.value); setStatusFilter(e.target.value) }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando contactos...</span>
        </div>
      ) : contacts.length === 0 ? (
        <div className="ve-empty">No se encontraron contactos.</div>
      ) : (
        <>
          <div className="ve-table-wrapper">
            <table className="ve-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Engagement</th>
                  <th>Lead Score</th>
                  <th>Mejor hora</th>
                  <th>Último envío</th>
                  <th>Última apertura</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className={`ve-table-row ve-table-row--clickable${expandedContact === c.id ? ' ve-table-row--expanded' : ''}`}
                    onClick={() => setExpandedContact(expandedContact === c.id ? null : c.id)}
                  >
                    <td>{c.name || '—'}</td>
                    <td>{c.email}</td>
                    <td>{c.company || '—'}</td>
                    <td>
                      <span className={`ve-badge ${STATUS_COLORS[c.status] || ''}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td><EngagementBadge score={c.engagement_score} /></td>
                    <td><LeadScoreBadge score={c.lead_score} /></td>
                    <td>{c.best_send_hour != null ? `${c.best_send_hour}:00` : '—'}</td>
                    <td>{c.last_sent_at ? new Date(c.last_sent_at).toLocaleDateString('es-ES') : '—'}</td>
                    <td>{c.last_opened_at ? new Date(c.last_opened_at).toLocaleDateString('es-ES') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded detail */}
          {expandedContact && (() => {
            const contact = contacts.find((c) => c.id === expandedContact)
            if (!contact) return null
            return (
              <div className="ve-contact-detail">
                <h3>{contact.name || contact.email}</h3>
                <div className="ve-detail-grid">
                  <div><strong>Email:</strong> {contact.email}</div>
                  <div><strong>Empresa:</strong> {contact.company || '—'}</div>
                  <div><strong>Estado:</strong> {STATUS_LABELS[contact.status] || contact.status}</div>
                  <div><strong>Engagement:</strong> {contact.engagement_score ?? '—'}</div>
                  <div><strong>Lead Score:</strong> {contact.lead_score ?? '—'}</div>
                  <div><strong>Mejor hora de envío:</strong> {contact.best_send_hour != null ? `${contact.best_send_hour}:00` : '—'}</div>
                  <div><strong>Último envío:</strong> {contact.last_sent_at ? new Date(contact.last_sent_at).toLocaleString('es-ES') : '—'}</div>
                  <div><strong>Última apertura:</strong> {contact.last_opened_at ? new Date(contact.last_opened_at).toLocaleString('es-ES') : '—'}</div>
                </div>
              </div>
            )
          })()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ve-pagination">
              <button
                className="ve-btn ve-btn--sm"
                disabled={page <= 0}
                onClick={() => paginaAnterior()}
              >
                Anterior
              </button>
              <span className="ve-pagination-info">
                Página {currentPage} de {totalPages}
              </span>
              <button
                className="ve-btn ve-btn--sm"
                disabled={!hayMas}
                onClick={() => paginaSiguiente()}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
