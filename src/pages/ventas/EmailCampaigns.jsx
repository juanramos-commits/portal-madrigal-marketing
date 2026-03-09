import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEmailCampaigns } from '../../hooks/useEmailCampaigns'
import '../../styles/ventas-email.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'sending', label: 'Enviando' },
  { value: 'sent', label: 'Enviada' },
  { value: 'paused', label: 'Pausada' },
  { value: 'cancelled', label: 'Cancelada' },
]

const STATUS_COLORS = {
  draft: 've-badge--gray',
  sending: 've-badge--blue',
  sent: 've-badge--green',
  paused: 've-badge--yellow',
  cancelled: 've-badge--red',
}

const STATUS_LABELS = {
  draft: 'Borrador',
  sending: 'Enviando',
  sent: 'Enviada',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export default function EmailCampaigns() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const {
    campaigns,
    loading,
    cargar,
    preparar,
    iniciar,
    pausar,
    cancelar,
  } = useEmailCampaigns()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!tienePermiso('ventas.email.campanas.ver')) {
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
      if (action === 'edit') {
        navigate(`/ventas/email/campanas/${campaign.id}`)
        return
      }
      if (action === 'prepare') await preparar(campaign.id)
      else if (action === 'send') await iniciar(campaign.id)
      else if (action === 'pause') await pausar(campaign.id)
      else if (action === 'cancel') await cancelar(campaign.id)
      showToast('Acción ejecutada correctamente', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al ejecutar la acción', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Campañas</h1>
        {tienePermiso('ventas.email.campanas.crear') && (
          <button
            className="ve-btn ve-btn--primary"
            onClick={() => navigate('/ventas/email/campanas/nuevo')}
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
                <th>Estado</th>
                <th>Plantilla</th>
                <th>Segmento</th>
                <th>Enviados</th>
                <th>Abiertos</th>
                <th>Clicks</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="ve-table-row ve-table-row--clickable"
                  onClick={() => navigate(`/ventas/email/campanas/${c.id}`)}
                >
                  <td>{c.name}</td>
                  <td>
                    <span className={`ve-badge ${STATUS_COLORS[c.status] || ''}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td>{c.template_name || '—'}</td>
                  <td>{c.segment_name || '—'}</td>
                  <td>{c.sent_count ?? 0}</td>
                  <td>{c.opened_count ?? 0}</td>
                  <td>{c.clicked_count ?? 0}</td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '—'}</td>
                  <td>
                    <div className="ve-actions" onClick={(e) => e.stopPropagation()}>
                      {c.status === 'draft' && tienePermiso('ventas.email.campanas.crear') && (
                        <>
                          <button className="ve-btn ve-btn--sm" onClick={() => handleAction('edit', c)}>Editar</button>
                          <button className="ve-btn ve-btn--sm" onClick={() => handleAction('prepare', c)}>Preparar</button>
                        </>
                      )}
                      {c.status === 'draft' && tienePermiso('ventas.email.campanas.enviar') && (
                        <button className="ve-btn ve-btn--sm ve-btn--primary" onClick={() => handleAction('send', c)}>Enviar</button>
                      )}
                      {c.status === 'sending' && tienePermiso('ventas.email.campanas.pausar') && (
                        <button className="ve-btn ve-btn--sm ve-btn--warning" onClick={() => handleAction('pause', c)}>Pausar</button>
                      )}
                      {(c.status === 'draft' || c.status === 'sending' || c.status === 'paused') && tienePermiso('ventas.email.campanas.cancelar') && (
                        <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={() => handleAction('cancel', c)}>Cancelar</button>
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
