import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachCampaigns } from '../../hooks/useOutreachCampaigns'
import '../../styles/ventas-email.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activa' },
  { value: 'paused', label: 'Pausada' },
  { value: 'completed', label: 'Completada' },
  { value: 'archived', label: 'Archivada' },
]

const STATUS_COLORS = {
  draft: 've-badge--gray',
  active: 've-badge--green',
  paused: 've-badge--yellow',
  completed: 've-badge--blue',
  archived: 've-badge--red',
}

const STATUS_LABELS = {
  draft: 'Borrador',
  active: 'Activa',
  paused: 'Pausada',
  completed: 'Completada',
  archived: 'Archivada',
}

const TYPE_COLORS = {
  cold: 've-badge--blue',
  warm: 've-badge--yellow',
  follow_up: 've-badge--gray',
}

export default function OutreachCampaigns() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const {
    campaigns,
    loading,
    cargar,
    activar,
    pausar,
    archivar,
  } = useOutreachCampaigns()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!tienePermiso('ventas.outreach.campanas.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const filtered = campaigns.filter((c) => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleAction = async (action, campaign) => {
    try {
      if (action === 'activate') await activar(campaign.id)
      else if (action === 'pause') await pausar(campaign.id)
      else if (action === 'archive') await archivar(campaign.id)
      showToast('Acción ejecutada correctamente', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al ejecutar la acción', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Campañas de Outreach</h1>
        {tienePermiso('ventas.outreach.campanas.crear') && (
          <button
            className="ve-btn ve-btn--primary"
            onClick={() => navigate('/ventas/outreach/campanas/nuevo')}
          >
            Nueva Campaña
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="ve-toolbar">
        <input
          type="text"
          className="ve-search-input"
          placeholder="Buscar campañas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="ve-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando campañas...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ve-empty">No se encontraron campañas.</div>
      ) : (
        <div className="ve-table-wrapper">
          <table className="ve-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Enviados</th>
                <th>Abiertos</th>
                <th>Clicks</th>
                <th>Respuestas</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="ve-table-row ve-table-row--clickable"
                  onClick={() => navigate(`/ventas/outreach/campanas/${c.id}`)}
                >
                  <td>{c.name}</td>
                  <td>
                    <span className={`ve-badge ${TYPE_COLORS[c.type] || 've-badge--gray'}`}>
                      {c.type || '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`ve-badge ${STATUS_COLORS[c.status] || ''}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td>{c.sent_count ?? 0}</td>
                  <td>{c.opened_count ?? 0}</td>
                  <td>{c.clicked_count ?? 0}</td>
                  <td>{c.replied_count ?? 0}</td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '—'}</td>
                  <td>
                    <div className="ve-actions" onClick={(e) => e.stopPropagation()}>
                      {c.status === 'draft' && tienePermiso('ventas.outreach.campanas.crear') && (
                        <button className="ve-btn ve-btn--sm ve-btn--primary" onClick={() => handleAction('activate', c)}>Activar</button>
                      )}
                      {c.status === 'active' && (
                        <button className="ve-btn ve-btn--sm ve-btn--warning" onClick={() => handleAction('pause', c)}>Pausar</button>
                      )}
                      {(c.status === 'draft' || c.status === 'paused' || c.status === 'completed') && (
                        <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={() => handleAction('archive', c)}>Archivar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
