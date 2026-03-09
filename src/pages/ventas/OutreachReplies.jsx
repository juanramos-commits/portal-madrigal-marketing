import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachReplies } from '../../hooks/useOutreachReplies'
import { getCampaigns } from '../../lib/coldOutreach'
import '../../styles/ventas-email.css'

const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'Todas las clasificaciones' },
  { value: 'interested', label: 'Interesado' },
  { value: 'not_interested', label: 'No interesado' },
  { value: 'out_of_office', label: 'Fuera de oficina' },
  { value: 'unsubscribe', label: 'Baja' },
  { value: 'bounce', label: 'Rebote' },
  { value: 'other', label: 'Otro' },
]

const CLASSIFICATION_COLORS = {
  interested: 've-badge--green',
  not_interested: 've-badge--red',
  out_of_office: 've-badge--yellow',
  unsubscribe: 've-badge--red',
  bounce: 've-badge--gray',
  other: 've-badge--gray',
}

const CLASSIFICATION_LABELS = {
  interested: 'Interesado',
  not_interested: 'No interesado',
  out_of_office: 'Fuera de oficina',
  unsubscribe: 'Baja',
  bounce: 'Rebote',
  other: 'Otro',
}

const SENTIMENT_COLORS = {
  positive: 've-badge--green',
  neutral: 've-badge--gray',
  negative: 've-badge--red',
}

export default function OutreachReplies() {
  const { tienePermiso, user } = useAuth()
  const { showToast } = useToast()
  const {
    replies,
    loading,
    cargar,
    clasificar,
    marcarGestionada,
  } = useOutreachReplies()

  const [campaigns, setCampaigns] = useState([])
  const [campaignFilter, setCampaignFilter] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('')
  const [requiresActionFilter, setRequiresActionFilter] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    cargar()
    const loadCampaigns = async () => {
      const { data } = await getCampaigns()
      if (data) setCampaigns(data)
    }
    loadCampaigns()
  }, [cargar])

  if (!tienePermiso('ventas.outreach.respuestas.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const filtered = replies.filter((r) => {
    const matchCampaign = !campaignFilter || r.campaign_id === campaignFilter
    const matchClassification = !classificationFilter || r.classification === classificationFilter
    const matchAction = !requiresActionFilter || r.requires_action
    return matchCampaign && matchClassification && matchAction
  })

  const handleClasificar = async (replyId, classification) => {
    try {
      await clasificar(replyId, { classification, sentiment: null })
      showToast('Respuesta clasificada correctamente', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al clasificar la respuesta', 'error')
    }
  }

  const handleMarcarAccionada = async (replyId, userId) => {
    try {
      await marcarGestionada(replyId, userId)
      showToast('Respuesta marcada como accionada', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al marcar la respuesta', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Respuestas de Outreach</h1>
      </div>

      {/* Toolbar */}
      <div className="ve-toolbar">
        <select
          className="ve-select"
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
        >
          <option value="">Todas las campañas</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="ve-select"
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value)}
        >
          {CLASSIFICATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <label className="ve-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={requiresActionFilter}
            onChange={(e) => setRequiresActionFilter(e.target.checked)}
          />
          Requiere acción
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando respuestas...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ve-empty">No se encontraron respuestas.</div>
      ) : (
        <div className="ve-table-wrapper">
          <table className="ve-table">
            <thead>
              <tr>
                <th>De</th>
                <th>Asunto</th>
                <th>Clasificación</th>
                <th>Sentimiento</th>
                <th>Acción</th>
                <th>Recibida</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className="ve-table-row ve-table-row--clickable"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td>{r.from_email}</td>
                    <td>{r.subject}</td>
                    <td>
                      <span className={`ve-badge ${CLASSIFICATION_COLORS[r.classification] || 've-badge--gray'}`}>
                        {CLASSIFICATION_LABELS[r.classification] || r.classification || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`ve-badge ${SENTIMENT_COLORS[r.sentiment] || 've-badge--gray'}`}>
                        {r.sentiment || '—'}
                      </span>
                    </td>
                    <td>
                      {r.requires_action && (
                        <span className="ve-badge ve-badge--yellow">Pendiente</span>
                      )}
                    </td>
                    <td>{r.received_at ? new Date(r.received_at).toLocaleDateString('es-ES') : '—'}</td>
                    <td>
                      <div className="ve-actions" onClick={(e) => e.stopPropagation()}>
                        <select
                          className="ve-select"
                          value={r.classification || ''}
                          onChange={(e) => handleClasificar(r.id, e.target.value)}
                          style={{ minWidth: '120px' }}
                        >
                          <option value="">Clasificar...</option>
                          {CLASSIFICATION_OPTIONS.filter((o) => o.value).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {r.requires_action && (
                          <button className="ve-btn ve-btn--sm" onClick={() => handleMarcarAccionada(r.id, user?.id)}>Accionada</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr key={`${r.id}-detail`} className="ve-table-row">
                      <td colSpan={7}>
                        <div style={{ padding: '1rem' }}>
                          {r.ai_summary && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <strong>Resumen IA:</strong>
                              <p>{r.ai_summary}</p>
                            </div>
                          )}
                          <div>
                            <strong>Contenido:</strong>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{r.body_text}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
