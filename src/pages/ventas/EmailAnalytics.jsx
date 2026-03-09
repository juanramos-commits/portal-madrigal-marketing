import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useEmailAnalytics } from '../../hooks/useEmailAnalytics'
import { useEmailCampaigns } from '../../hooks/useEmailCampaigns'
import FunnelChart from '../../components/ventas/email/FunnelChart'
import CohortTable from '../../components/ventas/email/CohortTable'
import OpenHeatmap from '../../components/ventas/email/OpenHeatmap'
import '../../styles/ventas-email.css'

const TABS = [
  { key: 'funnel', label: 'Funnel' },
  { key: 'cohorts', label: 'Cohorts' },
  { key: 'heatmap', label: 'Heatmap' },
  { key: 'reputation', label: 'Reputación' },
]

const HEALTH_COLORS = {
  good: 've-badge--green',
  healthy: 've-badge--green',
  warning: 've-badge--yellow',
  critical: 've-badge--red',
}

export default function EmailAnalytics() {
  const { tienePermiso } = useAuth()
  const {
    funnelData,
    cohortData,
    heatmapData,
    reputationLogs,
    loading,
    cargarFunnel,
    cargarCohort,
    cargarHeatmap,
    cargarReputacion,
  } = useEmailAnalytics()
  const { campaigns, cargar: cargarCampaigns } = useEmailCampaigns()

  const [activeTab, setActiveTab] = useState('funnel')
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [cohortDays, setCohortDays] = useState(30)

  useEffect(() => {
    cargarCampaigns()
  }, [cargarCampaigns])

  const loadTabData = useCallback(() => {
    if (activeTab === 'funnel') cargarFunnel(selectedCampaignId || undefined)
    if (activeTab === 'cohorts') cargarCohort(cohortDays)
    if (activeTab === 'heatmap') cargarHeatmap()
    if (activeTab === 'reputation') cargarReputacion()
  }, [activeTab, selectedCampaignId, cohortDays, cargarFunnel, cargarCohort, cargarHeatmap, cargarReputacion])

  useEffect(() => {
    loadTabData()
  }, [loadTabData])

  if (!tienePermiso('ventas.email.analytics.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Analytics</h1>
      </div>

      {/* Tabs */}
      <div className="ve-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`ve-tab${activeTab === tab.key ? ' ve-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="ve-tab-content">
        {loading ? (
          <div className="ve-loading" role="status">
            <div className="ve-spinner" aria-hidden="true" />
            <span>Cargando datos...</span>
          </div>
        ) : (
          <>
            {/* Funnel Tab */}
            {activeTab === 'funnel' && (
              <div className="ve-analytics-section">
                <div className="ve-toolbar">
                  <select
                    className="ve-select"
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                  >
                    <option value="">Todas las campañas</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <FunnelChart data={funnelData} />
              </div>
            )}

            {/* Cohorts Tab */}
            {activeTab === 'cohorts' && (
              <div className="ve-analytics-section">
                <div className="ve-toolbar">
                  <select
                    className="ve-select"
                    value={cohortDays}
                    onChange={(e) => setCohortDays(Number(e.target.value))}
                  >
                    <option value={7}>Últimos 7 días</option>
                    <option value={14}>Últimos 14 días</option>
                    <option value={30}>Últimos 30 días</option>
                    <option value={60}>Últimos 60 días</option>
                    <option value={90}>Últimos 90 días</option>
                  </select>
                </div>
                <CohortTable data={cohortData} />
              </div>
            )}

            {/* Heatmap Tab */}
            {activeTab === 'heatmap' && (
              <div className="ve-analytics-section">
                <OpenHeatmap data={heatmapData} />
              </div>
            )}

            {/* Reputation Tab */}
            {activeTab === 'reputation' && (
              <div className="ve-analytics-section">
                {!reputationLogs || reputationLogs.length === 0 ? (
                  <div className="ve-empty">No hay datos de reputación disponibles.</div>
                ) : (
                  <div className="ve-table-wrapper">
                    <table className="ve-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Proveedor</th>
                          <th>Enviados</th>
                          <th>Entregados</th>
                          <th>Rebotados</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reputationLogs.map((log, idx) => (
                          <tr key={idx} className="ve-table-row">
                            <td>{log.date ? new Date(log.date).toLocaleDateString('es-ES') : '—'}</td>
                            <td>{log.provider || '—'}</td>
                            <td>{log.sent ?? 0}</td>
                            <td>{log.delivered ?? 0}</td>
                            <td>{log.bounced ?? 0}</td>
                            <td>
                              <span className={`ve-badge ${HEALTH_COLORS[log.health_status] || ''}`}>
                                {log.health_status || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
