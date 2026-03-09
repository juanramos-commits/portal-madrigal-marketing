import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachAnalytics } from '../../hooks/useOutreachAnalytics'
import '../../styles/ventas-email.css'

const TABS = [
  { value: 'overview', label: 'Resumen' },
  { value: 'reputation', label: 'Reputación' },
  { value: 'performance', label: 'Rendimiento de Campañas' },
]

const HEALTH_COLORS = {
  healthy: 've-badge--green',
  warning: 've-badge--yellow',
  critical: 've-badge--red',
}

export default function OutreachAnalytics() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const {
    overview,
    domains,
    reputationData,
    campaigns,
    funnelData,
    loading,
    cargarResumen,
    cargarReputacion,
    cargarRendimiento,
  } = useOutreachAnalytics()

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState('')

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  useEffect(() => {
    if (activeTab === 'reputation' && selectedDomain) {
      cargarReputacion(selectedDomain)
    }
  }, [activeTab, selectedDomain, cargarReputacion])

  useEffect(() => {
    if (activeTab === 'performance' && selectedCampaign) {
      cargarRendimiento(selectedCampaign)
    }
  }, [activeTab, selectedCampaign, cargarRendimiento])

  if (!tienePermiso('ventas.outreach.analytics.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="ve-page">
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando analíticas...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Analíticas de Outreach</h1>
      </div>

      {/* Tabs */}
      <div className="ve-toolbar">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`ve-btn ve-btn--sm ${activeTab === tab.value ? 've-btn--primary' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="ve-section">
          <h2 className="ve-section-title">Resumen General</h2>
          <div className="ve-form-grid">
            {[
              { label: 'Campañas activas', value: overview.active_campaigns ?? 0 },
              { label: 'Total enviados', value: overview.total_sent ?? 0 },
              { label: 'Total abiertos', value: overview.total_opened ?? 0 },
              { label: 'Total clicks', value: overview.total_clicked ?? 0 },
              { label: 'Total respuestas', value: overview.total_replied ?? 0 },
              { label: 'Tasa de apertura', value: `${overview.open_rate ?? 0}%` },
              { label: 'Tasa de respuesta', value: `${overview.reply_rate ?? 0}%` },
              { label: 'Tasa de rebote', value: `${overview.bounce_rate ?? 0}%` },
            ].map(({ label, value }) => (
              <div className="ve-form-group" key={label}>
                <label className="ve-label">{label}</label>
                <div className="ve-input" style={{ background: 'transparent', fontWeight: 'bold', fontSize: '1.25rem' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reputation Tab */}
      {activeTab === 'reputation' && (
        <div className="ve-section">
          <h2 className="ve-section-title">Reputación de Dominio</h2>
          <div className="ve-toolbar">
            <select
              className="ve-select"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
            >
              <option value="">Seleccionar dominio...</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {reputationData.length > 0 ? (
            <div className="ve-table-wrapper">
              <table className="ve-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Enviados</th>
                    <th>Entregados</th>
                    <th>Abiertos</th>
                    <th>Rebotados</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reputationData.map((row, idx) => (
                    <tr key={idx} className="ve-table-row">
                      <td>{row.date ? new Date(row.date).toLocaleDateString('es-ES') : '—'}</td>
                      <td>{row.sent ?? 0}</td>
                      <td>{row.delivered ?? 0}</td>
                      <td>{row.opened ?? 0}</td>
                      <td>{row.bounced ?? 0}</td>
                      <td>
                        <span className={`ve-badge ${HEALTH_COLORS[row.health_status] || 've-badge--gray'}`}>
                          {row.health_status || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ve-empty">Selecciona un dominio para ver su reputación.</div>
          )}
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="ve-section">
          <h2 className="ve-section-title">Rendimiento por Campaña</h2>
          <div className="ve-toolbar">
            <select
              className="ve-select"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="">Seleccionar campaña...</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {funnelData.length > 0 ? (
            <div className="ve-table-wrapper">
              <table className="ve-table">
                <thead>
                  <tr>
                    <th>Paso</th>
                    <th>Tipo</th>
                    <th>Enviados</th>
                    <th>Abiertos</th>
                    <th>Clicks</th>
                    <th>Respuestas</th>
                    <th>Tasa apertura</th>
                    <th>Tasa respuesta</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelData.map((step, idx) => (
                    <tr key={idx} className="ve-table-row">
                      <td>Paso {step.step_number}</td>
                      <td>{step.type || '—'}</td>
                      <td>{step.sent ?? 0}</td>
                      <td>{step.opened ?? 0}</td>
                      <td>{step.clicked ?? 0}</td>
                      <td>{step.replied ?? 0}</td>
                      <td>{step.open_rate ?? 0}%</td>
                      <td>{step.reply_rate ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ve-empty">Selecciona una campaña para ver su rendimiento.</div>
          )}
        </div>
      )}
    </div>
  )
}
