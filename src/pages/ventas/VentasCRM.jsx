import { useState, useMemo } from 'react'
import { Kanban, List, Filter, Plus, RefreshCw } from 'lucide-react'
import { useVentasCRM } from '../../hooks/useVentasCRM'
import { useVentas } from '../../hooks/useVentas'
import { useToast } from '../../contexts/ToastContext'
import CRMKanban from '../../components/ventas/CRMKanban'
import CRMTabla from '../../components/ventas/CRMTabla'
import CRMBuscador from '../../components/ventas/CRMBuscador'
import CRMFiltros from '../../components/ventas/CRMFiltros'
import CRMNuevoLead from '../../components/ventas/CRMNuevoLead'
import VentaPopupCierre from '../../components/ventas/VentaPopupCierre'
import '../../styles/ventas-crm.css'
import '../../styles/ventas-ventas.css'

export default function VentasCRM() {
  const crm = useVentasCRM()
  const ventasHook = useVentas()
  const { showToast } = useToast()
  const [showFilters, setShowFilters] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)

  const filtroCount = useMemo(() => {
    return Object.values(crm.filtros).filter(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length
  }, [crm.filtros])

  const handleCrearLead = async (datos) => {
    await crm.crearLead(datos)
  }

  // Error state
  if (crm.error && !crm.loading && crm.pipelines.length === 0) {
    return (
      <div className="crm-page">
        <div className="crm-error">
          <p>{crm.error}</p>
          <button className="ui-btn ui-btn--primary ui-btn--md" onClick={crm.refrescar}>Reintentar</button>
        </div>
      </div>
    )
  }

  // No commercial role
  if (!crm.loading && crm.pipelines.length === 0 && crm.misRoles.length === 0) {
    return (
      <div className="crm-page">
        <div className="crm-error">
          <p>No tienes un rol comercial asignado. Contacta con tu administrador.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="crm-page">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="crm-header">
        <div className="crm-header-top">
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <h1>CRM</h1>
            <span className="crm-lead-count">{crm.totalLeads} leads</span>
          </div>
        </div>

        <div className="crm-header-row">
          {/* Pipeline tabs */}
          {crm.pipelines.length > 1 && (
            <div className="crm-pipeline-tabs">
              {crm.pipelines.map(p => (
                <button
                  key={p.id}
                  className={`crm-pipeline-tab${crm.pipelineActivo?.id === p.id ? ' active' : ''}`}
                  onClick={() => crm.setPipelineActivo(p)}
                >
                  {p.nombre.split(' (')[0]}
                </button>
              ))}
            </div>
          )}

          {/* View toggle */}
          <div className="crm-view-toggle">
            <button
              className={`crm-view-btn${crm.vista === 'kanban' ? ' active' : ''}`}
              onClick={() => crm.setVista('kanban')}
              title="Vista Kanban"
            >
              <Kanban />
            </button>
            <button
              className={`crm-view-btn${crm.vista === 'tabla' ? ' active' : ''}`}
              onClick={() => crm.setVista('tabla')}
              title="Vista Tabla"
            >
              <List />
            </button>
          </div>

          {/* Search */}
          <CRMBuscador value={crm.busqueda} onChange={crm.setBusqueda} resultCount={crm.searchResultCount} />

          {/* Filter button */}
          <button className="crm-filter-btn" onClick={() => setShowFilters(true)}>
            <Filter />
            <span className="crm-toolbar-label">Filtros</span>
            {filtroCount > 0 && <span className="crm-filter-badge">{filtroCount}</span>}
          </button>

          {/* Refresh */}
          <button
            className="crm-filter-btn"
            onClick={crm.refrescar}
            title="Refrescar"
          >
            <RefreshCw />
          </button>

          {/* Nuevo Lead */}
          {crm.esAdminODirector && (
            <button className="crm-new-btn" onClick={() => setShowNewLead(true)}>
              <Plus /> <span className="crm-toolbar-label">Nuevo Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {crm.vista === 'kanban' ? (
        <CRMKanban
          etapas={crm.etapas}
          leads={crm.leads}
          leadCounts={crm.leadCounts}
          hasMore={crm.hasMore}
          loadingMore={crm.loadingMore}
          onLoadMore={crm.cargarMasLeads}
          onMoverLead={crm.moverLead}
          showAssignee={crm.esAdminODirector}
          loading={crm.loading}
          onError={(msg) => showToast(msg, 'error', 3000)}
        />
      ) : (
        <CRMTabla
          leads={crm.leadsTabla}
          totalCount={crm.tablaTotalCount}
          page={crm.tablaPage}
          onPageChange={crm.setTablaPage}
          sort={crm.tablaSort}
          onSortChange={crm.setTablaSort}
          loading={crm.loading}
        />
      )}

      {/* ── Filters Panel ───────────────────────────────────────────── */}
      {showFilters && (
        <CRMFiltros
          filtros={crm.filtros}
          onFiltrosChange={crm.setFiltros}
          onCerrar={() => setShowFilters(false)}
          esAdminODirector={crm.esAdminODirector}
          setters={crm.setters}
          closers={crm.closers}
          categorias={crm.categorias}
          etiquetas={crm.etiquetas}
          etapas={crm.etapas}
          fuentes={crm.fuentes}
        />
      )}

      {/* ── New Lead Modal ──────────────────────────────────────────── */}
      {showNewLead && (
        <CRMNuevoLead
          categorias={crm.categorias}
          onCrear={handleCrearLead}
          onCerrar={() => setShowNewLead(false)}
        />
      )}

      {/* ── Venta Popup ──────────────────────────────────────────────── */}
      {crm.leadParaVenta && (
        <VentaPopupCierre
          lead={crm.leadParaVenta}
          onConfirm={async (datosVenta) => {
            try {
              await ventasHook.registrarVenta(datosVenta)
              await ventasHook.moverLeadAVenta(
                crm.leadParaVenta.id,
                crm.pipelineActivo.id,
                crm.etapaVentaDestino
              )
              crm.refrescar()
              showToast('Venta registrada correctamente', 'success', 3000)
            } catch (err) {
              showToast(err.message || 'Error al registrar la venta', 'error', 4000)
            } finally {
              crm.setLeadParaVenta(null)
              crm.setEtapaVentaDestino(null)
            }
          }}
          onCancel={() => {
            crm.setLeadParaVenta(null)
            crm.setEtapaVentaDestino(null)
          }}
        />
      )}

    </div>
  )
}
