import {
  Users, UserPlus, CalendarPlus, TrendingUp,
  DollarSign, Clock, CheckCircle, Receipt,
  BarChart3, Table2,
  Wallet, CreditCard, ArrowDownToLine, ArrowUpFromLine, Hourglass,
  PieChart, Target, Activity, Trophy, GitBranch, Ghost,
  CalendarClock, Percent,
} from 'lucide-react'

export const WIDGET_CATEGORIES = [
  { key: 'kpis', label: 'KPIs', icon: TrendingUp },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
  { key: 'charts', label: 'Graficos', icon: BarChart3 },
  { key: 'distribution', label: 'Distribucion', icon: PieChart },
  { key: 'tables', label: 'Tablas', icon: Table2 },
  { key: 'team', label: 'Equipo', icon: Trophy },
  { key: 'funnel', label: 'Funnel', icon: GitBranch },
  { key: 'goals', label: 'Objetivos', icon: Target },
]

export const WIDGET_CATALOG = {
  // ── KPIs (10) — Fase 1 ──────────────────────────────────
  kpi_total_leads: {
    type: 'kpi_total_leads', label: 'Total leads', category: 'kpis',
    icon: Users, dataKey: 'total_leads', formato: 'number',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  kpi_leads_hoy: {
    type: 'kpi_leads_hoy', label: 'Leads hoy', category: 'kpis',
    icon: UserPlus, dataKey: 'leads_hoy', formato: 'number',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  kpi_leads_esta_semana: {
    type: 'kpi_leads_esta_semana', label: 'Leads esta semana', category: 'kpis',
    icon: CalendarPlus, dataKey: 'leads_esta_semana', formato: 'number',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  kpi_leads_este_mes: {
    type: 'kpi_leads_este_mes', label: 'Leads este mes', category: 'kpis',
    icon: Users, dataKey: 'leads_este_mes', formato: 'number',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  kpi_total_ventas: {
    type: 'kpi_total_ventas', label: 'Total ventas', category: 'kpis',
    icon: DollarSign, dataKey: 'total_ventas', formato: 'number',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  kpi_ventas_pendientes: {
    type: 'kpi_ventas_pendientes', label: 'Ventas pendientes', category: 'kpis',
    icon: Clock, dataKey: 'ventas_pendientes', formato: 'number',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas'],
  },
  kpi_ventas_aprobadas: {
    type: 'kpi_ventas_aprobadas', label: 'Ventas aprobadas', category: 'kpis',
    icon: CheckCircle, dataKey: 'ventas_aprobadas', formato: 'number',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  kpi_ingresos_totales: {
    type: 'kpi_ingresos_totales', label: 'Ingresos totales', category: 'kpis',
    icon: DollarSign, dataKey: 'ingresos_totales', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  kpi_ingresos_mes: {
    type: 'kpi_ingresos_mes', label: 'Ingresos este mes', category: 'kpis',
    icon: Receipt, dataKey: 'ingresos_mes', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  kpi_ticket_medio: {
    type: 'kpi_ticket_medio', label: 'Ticket medio', category: 'kpis',
    icon: TrendingUp, dataKey: 'ticket_medio', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer'],
  },

  // ── Wallet KPIs (6) — Fase 2 ───────────────────────────
  kpi_mi_saldo: {
    type: 'kpi_mi_saldo', label: 'Mi saldo', category: 'wallet',
    icon: Wallet, dataKey: 'mi_saldo', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  kpi_mi_saldo_disponible: {
    type: 'kpi_mi_saldo_disponible', label: 'Saldo disponible', category: 'wallet',
    icon: CreditCard, dataKey: 'mi_saldo_disponible', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  kpi_total_ganado: {
    type: 'kpi_total_ganado', label: 'Total ganado', category: 'wallet',
    icon: ArrowDownToLine, dataKey: 'total_ganado', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  kpi_total_retirado: {
    type: 'kpi_total_retirado', label: 'Total retirado', category: 'wallet',
    icon: ArrowUpFromLine, dataKey: 'total_retirado', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  kpi_comisiones_pendientes: {
    type: 'kpi_comisiones_pendientes', label: 'Comisiones pendientes', category: 'wallet',
    icon: Hourglass, dataKey: 'comisiones_pendientes', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  kpi_retiros_pendientes: {
    type: 'kpi_retiros_pendientes', label: 'Retiros pendientes', category: 'wallet',
    icon: Clock, dataKey: 'retiros_pendientes', formato: 'currency',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },

  // ── Charts Fase 1 (2) ──────────────────────────────────
  chart_leads_por_dia: {
    type: 'chart_leads_por_dia', label: 'Leads por dia', category: 'charts',
    icon: BarChart3, dataKey: 'leads_por_dia', chartType: 'line',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  chart_ventas_por_dia: {
    type: 'chart_ventas_por_dia', label: 'Ventas por dia', category: 'charts',
    icon: BarChart3, dataKey: 'ventas_por_dia', chartType: 'line',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer'],
  },

  // ── Charts Fase 2 (6) ──────────────────────────────────
  chart_leads_por_semana: {
    type: 'chart_leads_por_semana', label: 'Leads por semana', category: 'charts',
    icon: BarChart3, dataKey: 'leads_por_semana', chartType: 'bar',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  chart_ventas_por_mes: {
    type: 'chart_ventas_por_mes', label: 'Ventas por mes', category: 'charts',
    icon: BarChart3, dataKey: 'ventas_por_mes', chartType: 'bar',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  chart_ingresos_por_dia: {
    type: 'chart_ingresos_por_dia', label: 'Ingresos por dia', category: 'charts',
    icon: BarChart3, dataKey: 'ingresos_por_dia', chartType: 'line',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  chart_ingresos_por_mes: {
    type: 'chart_ingresos_por_mes', label: 'Ingresos por mes', category: 'charts',
    icon: BarChart3, dataKey: 'ingresos_por_mes', chartType: 'bar',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  chart_comisiones_por_mes: {
    type: 'chart_comisiones_por_mes', label: 'Comisiones por mes', category: 'charts',
    icon: BarChart3, dataKey: 'comisiones_por_mes', chartType: 'bar',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  chart_conversion_por_dia: {
    type: 'chart_conversion_por_dia', label: 'Conversion por dia', category: 'charts',
    icon: Percent, dataKey: 'conversion_por_dia', chartType: 'line',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas'],
  },

  // ── Distribution (6) — Fase 2 ──────────────────────────
  dist_leads_por_fuente: {
    type: 'dist_leads_por_fuente', label: 'Leads por fuente', category: 'distribution',
    icon: PieChart, dataKey: 'leads_por_fuente', chartType: 'pie',
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  dist_leads_por_categoria: {
    type: 'dist_leads_por_categoria', label: 'Leads por categoria', category: 'distribution',
    icon: PieChart, dataKey: 'leads_por_categoria', chartType: 'pie',
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 },
    roles: ['admin', 'director_ventas'],
  },
  dist_ventas_por_paquete: {
    type: 'dist_ventas_por_paquete', label: 'Ventas por paquete', category: 'distribution',
    icon: PieChart, dataKey: 'ventas_por_paquete', chartType: 'pie',
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  dist_ventas_por_metodo_pago: {
    type: 'dist_ventas_por_metodo_pago', label: 'Ventas por metodo pago', category: 'distribution',
    icon: PieChart, dataKey: 'ventas_por_metodo_pago', chartType: 'pie',
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  dist_leads_por_etapa: {
    type: 'dist_leads_por_etapa', label: 'Leads por etapa', category: 'distribution',
    icon: BarChart3, dataKey: 'leads_por_etapa', chartType: 'horizontal_bar',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas'],
  },
  dist_ventas_por_estado: {
    type: 'dist_ventas_por_estado', label: 'Ventas por estado', category: 'distribution',
    icon: PieChart, dataKey: 'ventas_por_estado', chartType: 'pie',
    defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 },
    roles: ['admin', 'director_ventas'],
  },

  // ── Tables Fase 1 (2) ──────────────────────────────────
  table_leads_recientes: {
    type: 'table_leads_recientes', label: 'Leads recientes', category: 'tables',
    icon: Table2, dataKey: 'leads_recientes',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  table_ventas_recientes: {
    type: 'table_ventas_recientes', label: 'Ventas recientes', category: 'tables',
    icon: Table2, dataKey: 'ventas_recientes',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer'],
  },

  // ── Tables Fase 2 (4) ──────────────────────────────────
  table_comisiones_recientes: {
    type: 'table_comisiones_recientes', label: 'Comisiones recientes', category: 'tables',
    icon: Table2, dataKey: 'comisiones_recientes',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  table_retiros_recientes: {
    type: 'table_retiros_recientes', label: 'Retiros recientes', category: 'tables',
    icon: Table2, dataKey: 'retiros_recientes',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },
  table_leads_sin_contactar: {
    type: 'table_leads_sin_contactar', label: 'Leads sin contactar', category: 'tables',
    icon: Table2, dataKey: 'leads_sin_contactar',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  table_citas_proximas: {
    type: 'table_citas_proximas', label: 'Citas proximas', category: 'tables',
    icon: CalendarClock, dataKey: 'citas_proximas',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas', 'closer', 'setter'],
  },

  // ── Team (5) — Fase 3 ──────────────────────────────────
  team_ranking_closers: {
    type: 'team_ranking_closers', label: 'Ranking closers', category: 'team',
    icon: Trophy, dataKey: 'ranking_closers',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
    roles: ['admin', 'director_ventas'],
  },
  team_ranking_setters: {
    type: 'team_ranking_setters', label: 'Ranking setters', category: 'team',
    icon: Trophy, dataKey: 'ranking_setters',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
    roles: ['admin', 'director_ventas'],
  },
  team_actividad_reciente: {
    type: 'team_actividad_reciente', label: 'Actividad reciente', category: 'team',
    icon: Activity, dataKey: 'actividad_reciente',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas'],
  },
  team_conversion_por_closer: {
    type: 'team_conversion_por_closer', label: 'Conversion por closer', category: 'team',
    icon: Percent, dataKey: 'conversion_por_closer',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas'],
  },
  team_conversion_por_setter: {
    type: 'team_conversion_por_setter', label: 'Conversion por setter', category: 'team',
    icon: Percent, dataKey: 'conversion_por_setter',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
    roles: ['admin', 'director_ventas'],
  },

  // ── Funnel (4) — Fase 3 ─────────────────────────────────
  funnel_setters: {
    type: 'funnel_setters', label: 'Funnel setters', category: 'funnel',
    icon: GitBranch, dataKey: 'funnel_setters',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
    roles: ['admin', 'director_ventas', 'setter'],
  },
  funnel_closers: {
    type: 'funnel_closers', label: 'Funnel closers', category: 'funnel',
    icon: GitBranch, dataKey: 'funnel_closers',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
    roles: ['admin', 'director_ventas', 'closer'],
  },
  funnel_pipeline_resumen: {
    type: 'funnel_pipeline_resumen', label: 'Pipeline resumen', category: 'funnel',
    icon: GitBranch, dataKey: 'pipeline_resumen',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
    roles: ['admin', 'director_ventas'],
  },
  kpi_tasa_ghosting: {
    type: 'kpi_tasa_ghosting', label: 'Tasa de ghosting', category: 'funnel',
    icon: Ghost, dataKey: 'tasa_ghosting', formato: 'percent',
    defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    roles: ['admin', 'director_ventas'],
  },

  // ── Goals (2) — Fase 3 ─────────────────────────────────
  goal_ventas_mes: {
    type: 'goal_ventas_mes', label: 'Objetivo ventas mes', category: 'goals',
    icon: Target, dataKey: 'objetivo_ventas_mes',
    defaultSize: { w: 4, h: 3 }, minSize: { w: 3, h: 2 },
    roles: ['admin', 'director_ventas', 'closer'],
    defaultConfig: { objetivo: 15 },
  },
  goal_leads_mes: {
    type: 'goal_leads_mes', label: 'Objetivo leads mes', category: 'goals',
    icon: Target, dataKey: 'objetivo_leads_mes',
    defaultSize: { w: 4, h: 3 }, minSize: { w: 3, h: 2 },
    roles: ['admin', 'director_ventas', 'setter'],
    defaultConfig: { objetivo: 50 },
  },
}

export function getWidgetsForRole(rol) {
  return Object.fromEntries(
    Object.entries(WIDGET_CATALOG).filter(([, w]) => w.roles.includes(rol))
  )
}
