import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { ResponsiveGridLayout } from 'react-grid-layout'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboard } from '../../hooks/useDashboard'
import { WIDGET_CATALOG } from '../../config/widgetCatalog'
import DashboardToolbar from '../../components/ventas/dashboard/DashboardToolbar'
import WidgetShell from '../../components/ventas/dashboard/WidgetShell'
import WidgetKPI from '../../components/ventas/dashboard/WidgetKPI'
import WidgetChart from '../../components/ventas/dashboard/WidgetChart'
import WidgetTable from '../../components/ventas/dashboard/WidgetTable'
import WidgetDistribution from '../../components/ventas/dashboard/WidgetDistribution'
import WidgetLeaderboard from '../../components/ventas/dashboard/WidgetLeaderboard'
import WidgetActivity from '../../components/ventas/dashboard/WidgetActivity'
import WidgetConversionTable from '../../components/ventas/dashboard/WidgetConversionTable'
import WidgetFunnel from '../../components/ventas/dashboard/WidgetFunnel'
import WidgetPipeline from '../../components/ventas/dashboard/WidgetPipeline'
import WidgetGoal from '../../components/ventas/dashboard/WidgetGoal'
import 'react-grid-layout/css/styles.css'
import '../../styles/ventas-dashboard-widgets.css'

function renderWidget(widgetDef, data, config) {
  if (!widgetDef) return null
  const cat = widgetDef.category
  const dk = widgetDef.dataKey

  if (cat === 'kpis' || cat === 'wallet' || widgetDef.formato === 'percent' || (widgetDef.formato === 'currency' && cat === 'funnel')) {
    return <WidgetKPI widgetDef={widgetDef} data={data} />
  }
  if (cat === 'charts') return <WidgetChart widgetDef={widgetDef} data={data} />
  if (cat === 'distribution') return <WidgetDistribution widgetDef={widgetDef} data={data} />
  if (cat === 'tables') return <WidgetTable widgetDef={widgetDef} data={data} />
  if (cat === 'team') {
    if (dk === 'ranking_closers' || dk === 'ranking_setters') return <WidgetLeaderboard widgetDef={widgetDef} data={data} />
    if (dk === 'actividad_reciente') return <WidgetActivity widgetDef={widgetDef} data={data} />
    if (dk === 'conversion_por_closer' || dk === 'conversion_por_setter') return <WidgetConversionTable widgetDef={widgetDef} data={data} />
  }
  if (cat === 'funnel') {
    if (dk === 'funnel_setters' || dk === 'funnel_closers') return <WidgetFunnel widgetDef={widgetDef} data={data} />
    if (dk === 'pipeline_resumen') return <WidgetPipeline widgetDef={widgetDef} data={data} />
    if (dk === 'tasa_ghosting') return <WidgetKPI widgetDef={widgetDef} data={data} />
  }
  if (cat === 'goals') return <WidgetGoal widgetDef={widgetDef} data={data} config={config} />
  return <div className="db-widget-empty">Widget no soportado</div>
}

export default function VentasDashboard() {
  const { usuario } = useAuth()
  const db = useDashboard()
  const [gridWidth, setGridWidth] = useState(0)
  const observerRef = useRef(null)

  // Callback ref: fires when element attaches/detaches from DOM
  const measureRef = useCallback(node => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (node) {
      // Immediate measurement
      setGridWidth(node.offsetWidth)
      // Watch for resizes
      observerRef.current = new ResizeObserver(entries => {
        const w = entries[0]?.contentRect?.width
        if (w > 0) setGridWidth(w)
      })
      observerRef.current.observe(node)
    }
  }, [])

  // Disconnect observer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [])

  const isMobile = gridWidth < 500

  const rglLayouts = useMemo(() => {
    const lg = db.layout.map(item => {
      const def = WIDGET_CATALOG[item.type]
      return {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: def?.minSize?.w || 2,
        minH: def?.minSize?.h || 2,
      }
    })
    return { lg, md: lg, sm: lg }
  }, [db.layout])

  const handleLayoutChange = useCallback((layout, allLayouts) => {
    db.onLayoutChange(allLayouts.lg || layout)
  }, [db.onLayoutChange])

  if (db.layoutLoading) {
    return (
      <div className="db-page">
        <div className="db-loading" role="status" aria-label="Cargando dashboard"><span aria-hidden="true">Cargando dashboard...</span></div>
      </div>
    )
  }

  return (
    <div className="db-page">
      <div className="db-header">
        <h1>Dashboard</h1>
      </div>
      <DashboardToolbar
        periodo={db.periodo}
        onPeriodoChange={db.setPeriodo}
        fechaInicio={db.fechaInicio}
        fechaFin={db.fechaFin}
        onFechaPersonalizada={db.setFechaPersonalizada}
        usuarioFiltro={db.usuarioFiltro}
        onUsuarioFiltroChange={db.setUsuarioFiltro}
        miembrosEquipo={db.miembrosEquipo}
        editMode={db.editMode}
        setEditMode={db.setEditMode}
        onSave={db.handleSave}
        onReset={db.handleReset}
        isSaving={db.isSaving}
        onAddWidget={db.addWidget}
        rol={db.rol}
        layout={db.layout}
      />

      {db.error && !db.dataLoading && (
        <div className="db-error" role="alert">
          <span>Error al cargar datos.</span>
          <button type="button" className="db-toolbar-btn" onClick={db.refrescar}>Reintentar</button>
        </div>
      )}

      <div ref={measureRef} className="db-grid-container">
        {gridWidth > 0 && (
          <ResponsiveGridLayout
            width={gridWidth}
            layouts={rglLayouts}
            breakpoints={{ lg: 900, md: 500, sm: 0 }}
            cols={{ lg: 12, md: 6, sm: 1 }}
            rowHeight={60}
            isDraggable={db.editMode && !isMobile}
            isResizable={db.editMode && !isMobile}
            compactType="vertical"
            containerPadding={[0, 0]}
            margin={[12, 12]}
            draggableHandle=".db-widget-drag-handle"
            onLayoutChange={handleLayoutChange}
          >
            {db.layout.map(item => {
              const widgetDef = WIDGET_CATALOG[item.type]
              if (!widgetDef) return null
              const widgetData = db.data?.[widgetDef.dataKey]

              return (
                <div key={item.i}>
                  <WidgetShell
                    widgetDef={widgetDef}
                    editMode={db.editMode}
                    onRemove={() => db.removeWidget(item.i)}
                    loading={db.dataLoading}
                  >
                    {renderWidget(widgetDef, widgetData, item.config)}
                  </WidgetShell>
                </div>
              )
            })}
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  )
}
