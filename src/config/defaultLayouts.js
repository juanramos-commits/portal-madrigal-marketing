let _c = 0
const uid = (type) => `${type}_d${++_c}`

function kpiRow(types, y) {
  return types.map((type, i) => ({
    i: uid(type), type, x: i * 3, y, w: 3, h: 2,
  }))
}

export const DEFAULT_LAYOUTS = {
  admin: [
    ...kpiRow(['kpi_total_leads', 'kpi_leads_hoy', 'kpi_total_ventas', 'kpi_ingresos_totales'], 0),
    ...kpiRow(['kpi_ventas_pendientes', 'kpi_ventas_aprobadas', 'kpi_ingresos_mes', 'kpi_ticket_medio'], 2),
    { i: uid('chart_leads_por_dia'), type: 'chart_leads_por_dia', x: 0, y: 4, w: 6, h: 4 },
    { i: uid('chart_ventas_por_dia'), type: 'chart_ventas_por_dia', x: 6, y: 4, w: 6, h: 4 },
    { i: uid('table_leads_recientes'), type: 'table_leads_recientes', x: 0, y: 8, w: 6, h: 5 },
    { i: uid('table_ventas_recientes'), type: 'table_ventas_recientes', x: 6, y: 8, w: 6, h: 5 },
  ],
  director_ventas: [
    ...kpiRow(['kpi_total_leads', 'kpi_total_ventas', 'kpi_ingresos_totales', 'kpi_ticket_medio'], 0),
    { i: uid('chart_leads_por_dia'), type: 'chart_leads_por_dia', x: 0, y: 2, w: 6, h: 4 },
    { i: uid('chart_ventas_por_dia'), type: 'chart_ventas_por_dia', x: 6, y: 2, w: 6, h: 4 },
    { i: uid('table_leads_recientes'), type: 'table_leads_recientes', x: 0, y: 6, w: 6, h: 5 },
    { i: uid('table_ventas_recientes'), type: 'table_ventas_recientes', x: 6, y: 6, w: 6, h: 5 },
  ],
  closer: [
    ...kpiRow(['kpi_total_ventas', 'kpi_ventas_aprobadas', 'kpi_ingresos_totales', 'kpi_ticket_medio'], 0),
    { i: uid('chart_ventas_por_dia'), type: 'chart_ventas_por_dia', x: 0, y: 2, w: 12, h: 4 },
    { i: uid('table_ventas_recientes'), type: 'table_ventas_recientes', x: 0, y: 6, w: 12, h: 5 },
  ],
  setter: [
    ...kpiRow(['kpi_total_leads', 'kpi_leads_hoy', 'kpi_leads_esta_semana', 'kpi_leads_este_mes'], 0),
    { i: uid('chart_leads_por_dia'), type: 'chart_leads_por_dia', x: 0, y: 2, w: 12, h: 4 },
    { i: uid('table_leads_recientes'), type: 'table_leads_recientes', x: 0, y: 6, w: 12, h: 5 },
  ],
}
