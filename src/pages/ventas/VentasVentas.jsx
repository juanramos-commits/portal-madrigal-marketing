import { Search, X } from 'lucide-react'
import { useVentas } from '../../hooks/useVentas'
import VentasListado from '../../components/ventas/VentasListado'
import '../../styles/ventas-ventas.css'

const tabs = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aprobada', label: 'Aprobadas' },
  { key: 'rechazada', label: 'Rechazadas' },
  { key: 'devolucion', label: 'Devoluciones' },
]

export default function VentasVentas() {
  const ventas = useVentas()

  const handleAprobar = async (ventaId) => {
    await ventas.aprobarVenta(ventaId)
  }

  const handleRechazar = async (ventaId) => {
    await ventas.rechazarVenta(ventaId)
  }

  const handleDevolucion = async (ventaId) => {
    await ventas.marcarDevolucion(ventaId)
  }

  return (
    <div className="vv-page">
      {/* Header */}
      <div className="vv-header">
        <div className="vv-header-top">
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <h1>Ventas</h1>
            <span className="vv-count">{ventas.totalVentas} ventas</span>
          </div>
          <div className="vv-search" style={{ position: 'relative' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar en todos los campos..."
              value={ventas.busqueda}
              onChange={e => ventas.setBusqueda(e.target.value)}
            />
            {ventas.busqueda && ventas.searchResultCount !== null && ventas.searchResultCount !== undefined && (
              <span className="vv-search-count">
                {ventas.searchResultCount} {ventas.searchResultCount === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
            {ventas.busqueda && (
              <button
                className="vv-search-clear"
                onClick={() => ventas.setBusqueda('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="vv-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`vv-tab${ventas.filtroEstado === tab.key ? ' active' : ''}`}
              onClick={() => ventas.setFiltroEstado(tab.key)}
            >
              {tab.label}
              <span className="vv-tab-count">
                {ventas.contadores[tab.key] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {ventas.error && (
        <div className="vv-error-banner">
          <p>{ventas.error}</p>
          <button className="vv-btn-ghost" onClick={ventas.refrescar}>Reintentar</button>
        </div>
      )}

      {/* Listing */}
      <VentasListado
        ventas={ventas.ventas}
        totalCount={ventas.totalVentas}
        page={ventas.paginaActual}
        pageSize={ventas.pageSize}
        onPageChange={ventas.setPaginaActual}
        loading={ventas.loading}
        esAdmin={ventas.esAdmin}
        onAprobar={handleAprobar}
        onRechazar={handleRechazar}
        onDevolucion={handleDevolucion}
        cargarComisiones={ventas.cargarComisiones}
      />
    </div>
  )
}
