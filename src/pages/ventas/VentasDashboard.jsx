import { useAuth } from '../../contexts/AuthContext'
import { useDashboard } from '../../hooks/useDashboard'
import DashboardFiltroFecha from '../../components/ventas/DashboardFiltroFecha'
import DashboardKPIs from '../../components/ventas/DashboardKPIs'
import DashboardGraficoVentas from '../../components/ventas/DashboardGraficoVentas'
import DashboardGraficoFunnel from '../../components/ventas/DashboardGraficoFunnel'
import DashboardRankingEquipo from '../../components/ventas/DashboardRankingEquipo'
import DashboardActividadReciente from '../../components/ventas/DashboardActividadReciente'
import DashboardCitasHoy from '../../components/ventas/DashboardCitasHoy'
import DashboardPendientes from '../../components/ventas/DashboardPendientes'
import '../../styles/ventas-dashboard.css'

function getSaludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos dias'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

export default function VentasDashboard() {
  const { usuario } = useAuth()
  const dashboard = useDashboard()
  const {
    periodo, setPeriodo,
    fechaInicio, fechaFin, setFechaPersonalizada,
    kpis, kpisPrevios,
    graficoVentas, funnel,
    rankingSetters, rankingClosers,
    actividad, citasHoy, pendientes,
    loading, esAdmin, esCloser, esSetter, esDirector,
    refrescar,
  } = dashboard

  const nombre = usuario?.nombre?.split(' ')[0] || 'usuario'
  const showGrafico = esCloser || esDirector || esAdmin
  const showFunnel = esDirector || esAdmin
  const showRanking = esDirector || esAdmin
  const showPendientes = esAdmin

  return (
    <div className="db-page">
      <div className="db-header">
        <div className="db-header-left">
          <h1 className="db-title">Dashboard</h1>
          <p className="db-saludo">{getSaludo()}, {nombre}</p>
        </div>
        <div className="db-header-right">
          <DashboardFiltroFecha
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            onFechaPersonalizada={setFechaPersonalizada}
          />
          <button className="db-btn-refresh" onClick={refrescar} title="Refrescar">
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className="db-layout">
        {/* KPIs - always shown */}
        <section className="db-section db-section-kpis">
          <DashboardKPIs kpis={kpis} kpisPrevios={kpisPrevios} loading={loading} />
        </section>

        {/* Pendientes - only super_admin */}
        {showPendientes && (pendientes.ventas > 0 || pendientes.retiros > 0) && (
          <section className="db-section db-section-pendientes">
            <DashboardPendientes pendientes={pendientes} />
          </section>
        )}

        {/* Main content grid */}
        <div className="db-grid-main">
          {/* Left column */}
          <div className="db-col-left">
            {showGrafico && (
              <section className="db-section">
                <DashboardGraficoVentas datos={graficoVentas} loading={loading} />
              </section>
            )}
            {showFunnel && (
              <section className="db-section">
                <DashboardGraficoFunnel funnel={funnel} loading={loading} />
              </section>
            )}
          </div>

          {/* Right column */}
          <div className="db-col-right">
            <section className="db-section">
              <DashboardCitasHoy citas={citasHoy} loading={loading} />
            </section>
            <section className="db-section">
              <DashboardActividadReciente actividad={actividad} loading={loading} esAdmin={esAdmin} />
            </section>
          </div>
        </div>

        {/* Ranking - full width */}
        {showRanking && (
          <section className="db-section db-section-ranking">
            <DashboardRankingEquipo
              setters={rankingSetters}
              closers={rankingClosers}
              loading={loading}
            />
          </section>
        )}
      </div>
    </div>
  )
}
