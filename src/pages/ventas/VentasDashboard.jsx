import { useMemo, useCallback, useRef } from 'react'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
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

  // KPIs (includes wallet KPIs + tasa_ghosting)
  if (cat === 'kpis' || cat === 'wallet' || widgetDef.formato === 'percent' || widgetDef.formato === 'currency' && cat === 'funnel') {
    return <WidgetKPI widgetDef={widgetDef} data={data} />
  }

  // Charts (line + bar)
  if (cat === 'charts') return <WidgetChart widgetDef={widgetDef} data={data} />

  // Distribution (pie + horizontal bar)
  if (cat === 'distribution') return <WidgetDistribution widgetDef={widgetDef} data={data} />

  // Tables
  if (cat === 'tables') return <WidgetTable widgetDef={widgetDef} data={data} />

  // Team
  if (cat === 'team') {
    if (dk === 'ranking_closers' || dk === 'ranking_setters') return <WidgetLeaderboard widgetDef={widgetDef} data={data} />
    if (dk === 'actividad_reciente') return <WidgetActivity widgetDef={widgetDef} data={data} />
    if (dk === 'conversion_por_closer' || dk === 'conversion_por_setter') return <WidgetConversionTable widgetDef={widgetDef} data={data} />
  }

  // Funnel
  if (cat === 'funnel') {
    if (dk === 'funnel_setters' || dk === 'funnel_closers') return <WidgetFunnel widgetDef={widgetDef} data={data} />
    if (dk === 'pipeline_resumen') return <WidgetPipeline widgetDef={widgetDef} data={data} />
    if (dk === 'tasa_ghosting') return <WidgetKPI widgetDef={widgetDef} data={data} />
  }

  // Goals
  if (cat === 'goals') return <WidgetGoal widgetDef={widgetDef} data={data} config={config} />

  return null
}

export default function VentasDashboard() {
  const { usuario } = useAuth()
  const db = useDashboard()
  const containerRef = useRef(null)
  const { width } = useContainerWidth({ ref: containerRef, initialWidth: 1000 })

  const nombre = usuario?.nombre?.split(' ')[0] || 'usuario'
  const isMobile = width < 500

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

  if (db.loading && db.layout.length === 0) {
    return (
      <div className="db-page">
        <div className="db-loading">Cargando dashboard...</div>
      </div>
    )
  }

  return (
    <div className="db-page" ref={containerRef}>
      <DashboardToolbar
        nombre={nombre}
        periodo={db.periodo}
        onPeriodoChange={db.setPeriodo}
        fechaInicio={db.fechaInicio}
        fechaFin={db.fechaFin}
        onFechaPersonalizada={db.setFechaPersonalizada}
        editMode={db.editMode}
        setEditMode={db.setEditMode}
        onSave={db.handleSave}
        onReset={db.handleReset}
        onAddWidget={db.addWidget}
        rol={db.rol}
        layout={db.layout}
      />

      <ResponsiveGridLayout
        width={width}
        layouts={rglLayouts}
        breakpoints={{ lg: 900, md: 500, sm: 0 }}
        cols={{ lg: 12, md: 6, sm: 1 }}
        rowHeight={60}
        isDraggable={db.editMode && !isMobile}
        isResizable={db.editMode && !isMobile}
        compactType="vertical"
        margin={[16, 16]}
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
                loading={db.loading}
              >
                {renderWidget(widgetDef, widgetData, item.config)}
              </WidgetShell>
            </div>
          )
        })}
      </ResponsiveGridLayout>
    </div>
  )
}
