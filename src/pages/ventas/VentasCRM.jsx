import { useState, useMemo } from 'react'
import { useVentasCRM } from '../../hooks/useVentasCRM'
import { useVentas } from '../../hooks/useVentas'
import CRMKanban from '../../components/ventas/CRMKanban'
import CRMTabla from '../../components/ventas/CRMTabla'
import CRMBuscador from '../../components/ventas/CRMBuscador'
import CRMFiltros from '../../components/ventas/CRMFiltros'
import CRMNuevoLead from '../../components/ventas/CRMNuevoLead'
import VentaPopupCierre from '../../components/ventas/VentaPopupCierre'
import '../../styles/ventas-crm.css'
import '../../styles/ventas-ventas.css'

const KanbanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/>
  </svg>
)

const TableIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>
  </svg>
)

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14"/><path d="M5 12h14"/>
  </svg>
)

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>
  </svg>
)

export default function VentasCRM() {
  const crm = useVentasCRM()
  const ventasHook = useVentas()
  const [showFilters, setShowFilters] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)
  const [toast, setToast] = useState(null)

  const filtroCount = useMemo(() => {
    return Object.values(crm.filtros).filter(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length
  }, [crm.filtros])

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleCrearLead = async (datos) => {
    await crm.crearLead(datos)
    crm.refrescar()
  }

  // Error state
  if (crm.error && !crm.loading && crm.pipelines.length === 0) {
    return (
      <div className="crm-page">
        <div className="crm-error">
          <p>{crm.error}</p>
          <button className="btn primary" onClick={crm.refrescar}>Reintentar</button>
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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1>CRM</h1>
            <span className="crm-lead-count">{crm.totalLeads} leads</span>
          </div>
          <div className="crm-header-actions">
            <button
              className="crm-filter-btn"
              onClick={crm.refrescar}
              title="Refrescar"
              style={{ padding: '0 8px' }}
            >
              <RefreshIcon />
            </button>

            {crm.esAdminODirector && (
              <button className="crm-new-btn" onClick={() => setShowNewLead(true)}>
                <PlusIcon /> Nuevo Lead
              </button>
            )}
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
              <KanbanIcon />
            </button>
            <button
              className={`crm-view-btn${crm.vista === 'tabla' ? ' active' : ''}`}
              onClick={() => crm.setVista('tabla')}
              title="Vista Tabla"
            >
              <TableIcon />
            </button>
          </div>

          {/* Search */}
          <CRMBuscador value={crm.busqueda} onChange={crm.setBusqueda} />

          {/* Filter button */}
          <button className="crm-filter-btn" onClick={() => setShowFilters(true)}>
            <FilterIcon />
            <span>Filtros</span>
            {filtroCount > 0 && <span className="crm-filter-badge">{filtroCount}</span>}
          </button>
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
          onError={(msg) => showToast(msg, 'error')}
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
            await ventasHook.registrarVenta(datosVenta)
            await ventasHook.moverLeadAVenta(
              crm.leadParaVenta.id,
              crm.pipelineActivo.id,
              crm.etapaVentaDestino
            )
            crm.setLeadParaVenta(null)
            crm.setEtapaVentaDestino(null)
            crm.refrescar()
            showToast('Venta registrada correctamente', 'success')
          }}
          onCancel={() => {
            crm.setLeadParaVenta(null)
            crm.setEtapaVentaDestino(null)
          }}
        />
      )}

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className={`crm-toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
