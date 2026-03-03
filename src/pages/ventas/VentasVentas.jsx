import { useState } from 'react'
import { Search, X, Filter, Download } from 'lucide-react'
import { useVentas } from '../../hooks/useVentas'
import VentasListado from '../../components/ventas/VentasListado'
import VentasFiltros from '../../components/ventas/VentasFiltros'
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
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const filtrosActivos = Object.values(ventas.filtros).filter(v => v !== '' && v !== null && v !== undefined).length

  return (
    <div className="vv-page">
      {/* Header */}
      <div className="vv-header">
        <div className="vv-header-top">
          <div className="vv-title-row">
            <h1>Ventas</h1>
            <span className="vv-count">{ventas.totalVentas} ventas</span>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="vv-toolbar">
          <div className="vv-tabs" role="tablist" aria-label="Filtrar por estado">
            {tabs.map(tab => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={ventas.filtroEstado === tab.key}
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
          <div className="vv-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Buscar en todos los campos..."
              value={ventas.busqueda}
              onChange={e => ventas.setBusqueda(e.target.value)}
              aria-label="Buscar ventas"
            />
            {ventas.busqueda && ventas.searchResultCount !== null && ventas.searchResultCount !== undefined && (
              <span className="vv-search-count" aria-live="polite">
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
          <button className="vv-filter-btn" onClick={() => setMostrarFiltros(true)} aria-label="Filtros">
            <Filter size={16} />
            <span className="vv-toolbar-label">Filtros</span>
            {filtrosActivos > 0 && (
              <span className="vv-filter-badge">{filtrosActivos}</span>
            )}
          </button>
          <button
            className="vv-export-btn"
            onClick={ventas.exportarCSV}
            disabled={ventas.exportando || ventas.totalVentas === 0}
            aria-label="Exportar a CSV"
          >
            <Download size={16} />
            <span className="vv-toolbar-label">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {mostrarFiltros && (
        <VentasFiltros
          filtros={ventas.filtros}
          onAplicar={ventas.setFiltros}
          onCerrar={() => setMostrarFiltros(false)}
          setters={ventas.settersList}
          closers={ventas.closersList}
          paquetes={ventas.paquetes}
        />
      )}

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
        onCambiarEstado={ventas.cambiarEstado}
        cargarComisiones={ventas.cargarComisiones}
      />
    </div>
  )
}
