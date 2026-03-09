import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useEmailAnalytics } from '../../hooks/useEmailAnalytics'
import { useEmailSettings } from '../../hooks/useEmailSettings'
import '../../styles/ventas-email.css'

export default function EmailDashboard() {
  const { tienePermiso } = useAuth()
  const { dashboardStats, loading: statsLoading, cargarDashboard } = useEmailAnalytics()
  const { settings, loading: settingsLoading } = useEmailSettings()

  useEffect(() => {
    cargarDashboard()
  }, [cargarDashboard])

  if (!tienePermiso('ventas.email.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const loading = statsLoading || settingsLoading

  const kpis = [
    { label: 'Contactos totales', value: dashboardStats?.totalContacts ?? 0, format: 'number' },
    { label: 'Campañas activas', value: dashboardStats?.activeCampaigns ?? 0, format: 'number' },
    { label: 'Emails enviados', value: dashboardStats?.totalSent ?? 0, format: 'number' },
    { label: 'Tasa de apertura', value: dashboardStats?.openRate ?? 0, format: 'percent' },
    { label: 'Tasa de click', value: dashboardStats?.clickRate ?? 0, format: 'percent' },
    { label: 'Conversiones', value: dashboardStats?.totalConverted ?? 0, format: 'number' },
  ]

  const warmupTotalDays = Number(settings?.warmup_days) || 42
  const warmupCurrentDay = dashboardStats?.warmup_current_day ?? warmupTotalDays
  const warmupPercent = warmupTotalDays > 0 ? Math.min((warmupCurrentDay / warmupTotalDays) * 100, 100) : 0

  const quickLinks = [
    { label: 'Campañas', to: '/ventas/email/campanas' },
    { label: 'Plantillas', to: '/ventas/email/plantillas' },
    { label: 'Contactos', to: '/ventas/email/contactos' },
    { label: 'Segmentos', to: '/ventas/email/segmentos' },
    { label: 'Automaciones', to: '/ventas/email/automaciones' },
    { label: 'Analytics', to: '/ventas/email/analytics' },
    { label: 'Ajustes', to: '/ventas/email/ajustes' },
  ]

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Email Marketing</h1>
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
                  {kpi.format === 'percent'
                    ? `${Number(kpi.value).toFixed(1)}%`
                    : Number(kpi.value).toLocaleString('es-ES')}
                </span>
              </div>
            ))}
          </div>

          {/* Warmup Progress */}
          <div className="ve-section">
            <h2 className="ve-section-title">Progreso de Warmup</h2>
            <div className="ve-warmup-bar">
              <div className="ve-warmup-fill" style={{ width: `${warmupPercent}%` }} />
            </div>
            <span className="ve-warmup-label">
              Día {warmupCurrentDay} de {warmupTotalDays}
            </span>
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
