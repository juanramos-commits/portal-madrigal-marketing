import { useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { Kanban, List, Filter, Plus, RefreshCw } from 'lucide-react'
import { useVentasCRM } from '../../hooks/useVentasCRM'
import { useVentas } from '../../hooks/useVentas'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import CRMKanban from '../../components/ventas/CRMKanban'
import CRMTabla from '../../components/ventas/CRMTabla'
import CRMBuscador from '../../components/ventas/CRMBuscador'
import '../../styles/ventas-crm.css'
import '../../styles/ventas-ventas.css'

const CRMFiltros = lazy(() => import('../../components/ventas/CRMFiltros'))
const CRMNuevoLead = lazy(() => import('../../components/ventas/CRMNuevoLead'))
const VentaPopupCierre = lazy(() => import('../../components/ventas/VentaPopupCierre'))
const CRMAgendarCita = lazy(() => import('../../components/ventas/CRMAgendarCita'))

export default function VentasCRM() {
  const crm = useVentasCRM()
  const ventasHook = useVentas()
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const [showFilters, setShowFilters] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)

  const handleCRMError = useCallback((msg) => showToast(msg, 'error', 3000), [showToast])

  const filtroCount = useMemo(() => {
    return Object.values(crm.filtros).filter(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length
  }, [crm.filtros])

  // Error state
  if (crm.error && !crm.loading && crm.pipelines.length === 0) {
    return (
      <div className="crm-page">
        <div className="crm-error" role="alert">
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
        <div className="crm-error" role="status">
          <p>No tienes un rol comercial asignado. Contacta con tu administrador.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="crm-page">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="crm-header">
        {/* Row 1: Title + New Lead button */}
        <div className="crm-header-top">
          <div className="crm-title-row">
            <h1>CRM</h1>
            <span className="crm-lead-count">{crm.totalLeads} leads</span>
          </div>
          {tienePermiso('ventas.crm.crear_leads') && (
            <button className="crm-new-btn" onClick={() => setShowNewLead(true)} aria-label="Nuevo Lead">
              <Plus /> <span className="crm-toolbar-label">Nuevo Lead</span>
            </button>
          )}
        </div>

        {/* Row 2: Pipeline tabs (scrollable) */}
        {crm.pipelines.length > 1 && (
          <div className="crm-pipeline-tabs" role="tablist" aria-label="Pipelines">
            {crm.pipelines.map(p => (
              <button
                key={p.id}
                role="tab"
                aria-selected={crm.pipelineActivo?.id === p.id}
                className={`crm-pipeline-tab${crm.pipelineActivo?.id === p.id ? ' active' : ''}`}
                onClick={() => crm.setPipelineActivo(p)}
              >
                {p.nombre.split(' (')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Row 3: Search + view toggle + filters + refresh */}
        <div className="crm-header-row">
          <CRMBuscador value={crm.busqueda} onChange={crm.setBusqueda} resultCount={crm.searchResultCount} />

          <div className="crm-view-toggle" role="group" aria-label="Vista">
            <button
              className={`crm-view-btn${crm.vista === 'kanban' ? ' active' : ''}`}
              onClick={() => crm.setVista('kanban')}
              title="Vista Kanban"
              aria-label="Vista Kanban"
              aria-pressed={crm.vista === 'kanban'}
            >
              <Kanban />
            </button>
            <button
              className={`crm-view-btn${crm.vista === 'tabla' ? ' active' : ''}`}
              onClick={() => crm.setVista('tabla')}
              title="Vista Tabla"
              aria-label="Vista Tabla"
              aria-pressed={crm.vista === 'tabla'}
            >
              <List />
            </button>
          </div>

          <button className="crm-filter-btn" onClick={() => setShowFilters(true)} aria-label="Filtros" aria-expanded={showFilters}>
            <Filter />
            <span className="crm-toolbar-label">Filtros</span>
            {filtroCount > 0 && <span className="crm-filter-badge">{filtroCount}</span>}
          </button>

          <button
            className="crm-filter-btn"
            onClick={crm.refrescar}
            title="Refrescar"
            aria-label="Refrescar datos"
          >
            <RefreshCw />
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {crm.loading && Object.keys(crm.leads).length === 0 && crm.leadsTabla.length === 0 ? (
        <div className="crm-loading" role="status">Cargando leads...</div>
      ) : crm.vista === 'kanban' ? (
        <CRMKanban
          etapas={crm.etapas}
          leads={crm.leads}
          leadCounts={crm.leadCounts}
          hasMore={crm.hasMore}
          loadingMore={crm.loadingMore}
          onLoadMore={crm.cargarMasLeads}
          onMoverLead={crm.moverLead}
          showAssignee={tienePermiso('ventas.crm.ver_todos')}
          pipelineNombre={crm.pipelineActivo?.nombre}
          loading={crm.loading}
          onError={handleCRMError}
          canMove={tienePermiso('ventas.crm.mover_leads')}
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
      <Suspense fallback={null}>
      {showFilters && (
        <CRMFiltros
          filtros={crm.filtros}
          onFiltrosChange={crm.setFiltros}
          onCerrar={() => setShowFilters(false)}
          esAdminODirector={crm.esAdminODirector}
          setters={crm.setters}
          closers={crm.closers}
          categorias={crm.categorias}
          etapas={crm.etapas}
          fuentes={crm.fuentes}
        />
      )}

      {/* ── New Lead Modal ──────────────────────────────────────────── */}
      {showNewLead && (
        <CRMNuevoLead
          categorias={crm.categorias}
          onCrear={crm.crearLead}
          onCerrar={() => setShowNewLead(false)}
        />
      )}

      {/* ── Agendar Cita Popup ────────────────────────────────────────── */}
      {crm.leadParaCita && (
        <CRMAgendarCita
          lead={crm.leadParaCita}
          closers={crm.closers}
          onSuccess={async () => {
            crm.refrescar()
            showToast('Reunión agendada correctamente', 'success', 3000)
            crm.setLeadParaCita(null)
            crm.setEtapaCitaDestino(null)
          }}
          onCancel={() => {
            crm.setLeadParaCita(null)
            crm.setEtapaCitaDestino(null)
          }}
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
                crm.pipelineActivo?.id,
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
      </Suspense>

    </div>
  )
}
