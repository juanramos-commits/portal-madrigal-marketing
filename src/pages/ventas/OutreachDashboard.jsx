import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useOutreachAnalytics } from '../../hooks/useOutreachAnalytics'
import '../../styles/ventas-email.css'

const HEALTH_COLOR = (score) => {
  if (score >= 80) return 've-badge--green'
  if (score >= 50) return 've-badge--yellow'
  return 've-badge--red'
}

const STATUS_COLORS = {
  active: 've-badge--green',
  warmup: 've-badge--blue',
  paused: 've-badge--yellow',
  disabled: 've-badge--gray',
}

export default function OutreachDashboard() {
  const { tienePermiso } = useAuth()
  const { dashboardStats, domains, loading, cargarDashboard } = useOutreachAnalytics()

  useEffect(() => {
    cargarDashboard()
  }, [cargarDashboard])

  if (!tienePermiso('ventas.outreach.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const kpis = [
    { label: 'Total contactos', value: dashboardStats?.totalContacts ?? 0, format: 'number' },
    { label: 'Listas', value: dashboardStats?.totalLists ?? 0, format: 'number' },
    { label: 'Campañas activas', value: dashboardStats?.activeCampaigns ?? 0, format: 'number' },
    { label: 'Enviados', value: dashboardStats?.totalSent ?? 0, format: 'number' },
    { label: 'Entregados', value: dashboardStats?.totalDelivered ?? 0, format: 'number' },
    { label: 'Abiertos', value: dashboardStats?.totalOpened ?? 0, format: 'number' },
    { label: 'Clicks', value: dashboardStats?.totalClicked ?? 0, format: 'number' },
    { label: 'Respuestas', value: dashboardStats?.totalReplied ?? 0, format: 'number' },
    { label: 'Bounces', value: dashboardStats?.totalBounced ?? 0, format: 'number' },
  ]

  const rates = [
    { label: 'Open Rate', value: dashboardStats?.openRate ?? 0 },
    { label: 'Click Rate', value: dashboardStats?.clickRate ?? 0 },
    { label: 'Reply Rate', value: dashboardStats?.replyRate ?? 0 },
    { label: 'Bounce Rate', value: dashboardStats?.bounceRate ?? 0 },
  ]

  const quickLinks = [
    { label: 'Dominios', to: '/ventas/outreach/dominios' },
    { label: 'Inboxes', to: '/ventas/outreach/inboxes' },
    { label: 'Listas', to: '/ventas/outreach/listas' },
    { label: 'Campañas', to: '/ventas/outreach/campanas' },
    { label: 'Secuencias', to: '/ventas/outreach/secuencias' },
  ]

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Cold Outreach</h1>
      </div>

      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando datos...</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="ve-kpi-grid">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="ve-kpi-card">
                <span className="ve-kpi-label">{kpi.label}</span>
                <span className="ve-kpi-value">
                  {Number(kpi.value).toLocaleString('es-ES')}
                </span>
              </div>
            ))}
          </div>

          {/* Rates */}
          <div className="ve-kpi-grid">
            {rates.map((r) => (
              <div key={r.label} className="ve-kpi-card">
                <span className="ve-kpi-label">{r.label}</span>
                <span className="ve-kpi-value">{Number(r.value).toFixed(1)}%</span>
              </div>
            ))}
          </div>

          {/* Domain Health */}
          <div className="ve-section">
            <h2 className="ve-section-title">Salud de dominios</h2>
            <div className="ve-kpi-grid">
              {(domains ?? []).map((d) => (
                <div key={d.id} className="ve-kpi-card">
                  <span className="ve-kpi-label">{d.domain}</span>
                  <span className={`ve-badge ${HEALTH_COLOR(d.health_score ?? 0)}`}>
                    {d.health_score ?? 0}
                  </span>
                  <span className="ve-kpi-value" style={{ fontSize: '0.85rem' }}>
                    Día {d.warmup_day ?? 0} / 60
                  </span>
                  <span className={`ve-badge ${STATUS_COLORS[d.status] || 've-badge--gray'}`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="ve-section">
            <h2 className="ve-section-title">Accesos rápidos</h2>
            <div className="ve-quick-links">
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to} className="ve-quick-link">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
