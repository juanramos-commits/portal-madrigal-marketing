import { useCEDashboard } from '../../hooks/useCEDashboard'
import { useAuth } from '../../contexts/AuthContext'

const formatNum = (n) => Number(n || 0).toLocaleString('es-ES')
const formatPct = (n) => `${Number(n || 0).toFixed(1)}%`

export default function ColdEmailDashboard() {
  const { tienePermiso } = useAuth()
  const { stats, chartData, secuenciasActivas, respuestasPendientes, loading, error } = useCEDashboard()

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">Error al cargar dashboard: {error}</div>
      </div>
    )
  }

  const kpis = [
    {
      label: 'Enviados hoy',
      value: formatNum(stats?.enviadosHoy),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9z" />
        </svg>
      ),
      trend: stats?.tendenciaEnvios,
    },
    {
      label: 'Tasa apertura',
      value: formatPct(stats?.tasaApertura),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
      ),
      trend: stats?.tendenciaApertura,
    },
    {
      label: 'Tasa respuesta',
      value: formatPct(stats?.tasaRespuesta),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      trend: stats?.tendenciaRespuesta,
    },
    {
      label: 'Contactos activos',
      value: formatNum(stats?.contactosActivos),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      trend: stats?.tendenciaContactos,
    },
  ]

  const totalEnviados = chartData?.reduce((sum, d) => sum + (d.enviados || 0), 0) || 0
  const maxBarValue = totalEnviados > 0
    ? Math.max(...chartData.map(d => d.enviados || 0), 1)
    : 1

  return (
    <div className="ce-page">
      <div className="ce-page-header">
        <h1 className="ce-page-title">Dashboard</h1>
      </div>

      {/* KPI Grid */}
      <div className="ce-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="ce-kpi-card">
            <div className="ce-kpi-icon">{kpi.icon}</div>
            <div className="ce-kpi-body">
              <span className="ce-kpi-value">{kpi.value}</span>
              <span className="ce-kpi-label">{kpi.label}</span>
              {kpi.trend != null && (
                <span className={`ce-kpi-trend ${kpi.trend >= 0 ? 'ce-trend-up' : 'ce-trend-down'}`}>
                  {kpi.trend >= 0 ? '+' : ''}{kpi.trend.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 30-day Send Volume Chart */}
      <div className="ce-section">
        <h2 className="ce-section-title">Volumen de envios (30 dias)</h2>
        <div className="ce-chart-container">
          {chartData?.length > 0 && totalEnviados > 0 ? (
            <div className="ce-bar-chart">
              {chartData.map((d, i) => (
                <div key={i} className="ce-bar-col" title={`${d.fecha}: ${d.enviados} enviados`}>
                  <div
                    className="ce-bar"
                    style={{ height: `${(d.enviados / maxBarValue) * 100}%` }}
                  />
                  <span className="ce-bar-label">{d.fechaCorta || d.fecha?.slice(-2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ce-empty">
              <div className="ce-empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              </div>
              <p>Sin datos de envios en los ultimos 30 dias</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Sequences */}
      <div className="ce-section">
        <h2 className="ce-section-title">Secuencias activas</h2>
        {secuenciasActivas?.length > 0 ? (
          <div className="ce-dashboard-sequences">
            <table className="ce-table">
              <thead>
                <tr>
                  <th>Secuencia</th>
                  <th>Enrollados</th>
                  <th>Enviados</th>
                  <th>Abiertos</th>
                  <th>Respondidos</th>
                  <th>Tasa resp.</th>
                </tr>
              </thead>
              <tbody>
                {secuenciasActivas.map((seq) => (
                  <tr key={seq.id}>
                    <td className="ce-td-name">{seq.nombre}</td>
                    <td>{formatNum(seq.enrollados)}</td>
                    <td>{formatNum(seq.enviados)}</td>
                    <td>{formatNum(seq.abiertos)}</td>
                    <td>{formatNum(seq.respondidos)}</td>
                    <td>{formatPct(seq.tasaRespuesta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ce-empty">
            <div className="ce-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            </div>
            <p>No hay secuencias activas</p>
          </div>
        )}
      </div>

      {/* Recent Responses */}
      <div className="ce-section">
        <h2 className="ce-section-title">Respuestas pendientes de atencion</h2>
        {respuestasPendientes?.length > 0 ? (
          <div className="ce-dashboard-responses">
            {respuestasPendientes.map((r) => (
              <div key={r.id} className="ce-response-card">
                <div className="ce-response-header">
                  <span className="ce-response-name">{r.contacto_nombre || r.de_email}</span>
                  <span className="ce-response-time">{r.recibido_at ? new Date(r.recibido_at).toLocaleString('es-ES') : ''}</span>
                </div>
                <div className="ce-response-subject">{r.asunto}</div>
                <div className="ce-response-snippet">{r.snippet}</div>
                {r.clasificacion && (
                  <span className={`ce-badge ce-badge-${r.clasificacion}`}>{r.clasificacion}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="ce-empty">
            <div className="ce-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p>No hay respuestas pendientes</p>
          </div>
        )}
      </div>
    </div>
  )
}
