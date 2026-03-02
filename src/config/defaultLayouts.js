let _c = 0
const uid = (type) => `${type}_d${++_c}`

function kpiRow(types, y) {
  return types.map((type, i) => ({
    i: uid(type), type, x: i * 3, y, w: 3, h: 2,
  }))
}

export const DEFAULT_LAYOUTS = {
  admin: [
    // Row 0-1: Core KPIs
    ...kpiRow(['kpi_total_leads', 'kpi_leads_hoy', 'kpi_total_ventas', 'kpi_ingresos_totales'], 0),
    // Row 2-3: More KPIs
    ...kpiRow(['kpi_ventas_pendientes', 'kpi_ventas_aprobadas', 'kpi_ingresos_mes', 'kpi_ticket_medio'], 2),
    // Row 4-7: Charts side by side
    { i: uid('chart_leads_por_dia'), type: 'chart_leads_por_dia', x: 0, y: 4, w: 6, h: 4 },
    { i: uid('chart_ventas_por_dia'), type: 'chart_ventas_por_dia', x: 6, y: 4, w: 6, h: 4 },
    // Row 8-12: Tables side by side
    { i: uid('table_leads_recientes'), type: 'table_leads_recientes', x: 0, y: 8, w: 6, h: 5 },
    { i: uid('table_ventas_recientes'), type: 'table_ventas_recientes', x: 6, y: 8, w: 6, h: 5 },
    // Row 13-17: Rankings
    { i: uid('team_ranking_setters'), type: 'team_ranking_setters', x: 0, y: 13, w: 6, h: 5 },
    { i: uid('team_ranking_closers'), type: 'team_ranking_closers', x: 6, y: 13, w: 6, h: 5 },
    // Row 18-22: Funnel + Activity
    { i: uid('funnel_setters'), type: 'funnel_setters', x: 0, y: 18, w: 6, h: 5 },
    { i: uid('team_actividad_reciente'), type: 'team_actividad_reciente', x: 6, y: 18, w: 6, h: 5 },
  ],
  director_ventas: [
    ...kpiRow(['kpi_total_leads', 'kpi_total_ventas', 'kpi_ingresos_totales', 'kpi_ticket_medio'], 0),
    { i: uid('chart_leads_por_dia'), type: 'chart_leads_por_dia', x: 0, y: 2, w: 6, h: 4 },
    { i: uid('chart_ventas_por_dia'), type: 'chart_ventas_por_dia', x: 6, y: 2, w: 6, h: 4 },
    { i: uid('team_ranking_setters'), type: 'team_ranking_setters', x: 0, y: 6, w: 6, h: 5 },
    { i: uid('team_ranking_closers'), type: 'team_ranking_closers', x: 6, y: 6, w: 6, h: 5 },
    { i: uid('funnel_pipeline_resumen'), type: 'funnel_pipeline_resumen', x: 0, y: 11, w: 12, h: 4 },
    { i: uid('table_leads_recientes'), type: 'table_leads_recientes', x: 0, y: 15, w: 6, h: 5 },
    { i: uid('table_ventas_recientes'), type: 'table_ventas_recientes', x: 6, y: 15, w: 6, h: 5 },
  ],
  closer: [
    ...kpiRow(['kpi_total_ventas', 'kpi_ventas_aprobadas', 'kpi_ingresos_totales', 'kpi_ticket_medio'], 0),
    { i: uid('chart_ventas_por_dia'), type: 'chart_ventas_por_dia', x: 0, y: 2, w: 6, h: 4 },
    { i: uid('funnel_closers'), type: 'funnel_closers', x: 6, y: 2, w: 6, h: 5 },
    // Wallet row
    ...kpiRow(['kpi_mi_saldo', 'kpi_mi_saldo_disponible', 'kpi_total_ganado', 'kpi_comisiones_pendientes'], 7),
    { i: uid('table_ventas_recientes'), type: 'table_ventas_recientes', x: 0, y: 9, w: 6, h: 5 },
    { i: uid('table_citas_proximas'), type: 'table_citas_proximas', x: 6, y: 9, w: 6, h: 5 },
    { i: uid('goal_ventas_mes'), type: 'goal_ventas_mes', x: 0, y: 14, w: 4, h: 3, config: { objetivo: 15 } },
  ],
  setter: [
    ...kpiRow(['kpi_total_leads', 'kpi_leads_hoy', 'kpi_leads_esta_semana', 'kpi_leads_este_mes'], 0),
    { i: uid('chart_leads_por_dia'), type: 'chart_leads_por_dia', x: 0, y: 2, w: 6, h: 4 },
    { i: uid('funnel_setters'), type: 'funnel_setters', x: 6, y: 2, w: 6, h: 5 },
    // Wallet row
    ...kpiRow(['kpi_mi_saldo', 'kpi_mi_saldo_disponible', 'kpi_total_ganado', 'kpi_comisiones_pendientes'], 7),
    { i: uid('table_leads_recientes'), type: 'table_leads_recientes', x: 0, y: 9, w: 6, h: 5 },
    { i: uid('table_leads_sin_contactar'), type: 'table_leads_sin_contactar', x: 6, y: 9, w: 6, h: 5 },
    { i: uid('goal_leads_mes'), type: 'goal_leads_mes', x: 0, y: 14, w: 4, h: 3, config: { objetivo: 50 } },
  ],
}
