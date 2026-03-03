import { memo, useId } from 'react'
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart, BarChart, Bar } from 'recharts'
import { formatCurrency } from '../../../config/formatters'

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="db-wchart-tooltip">
      <div className="db-wchart-tooltip-date">{formatDate(label)}</div>
      {payload.map((p, i) => (
        <div key={p.name || i} className="db-wchart-tooltip-row">
          <span className="db-wchart-tooltip-label" style={{ '--label-color': p.stroke || p.fill || p.color }}>{p.name}:</span>{' '}
          <span className="db-wchart-tooltip-value">
            {p.name === 'Ingresos' || p.name === 'Comisiones' ? formatCurrency(p.value) : p.value}
            {p.name === 'Tasa' && '%'}
          </span>
        </div>
      ))}
    </div>
  )
}

const CHART_COLORS = {
  leads_por_dia: { stroke: 'var(--primary)', fill: 'var(--primary-muted)' },
  ventas_por_dia: { stroke: 'var(--success)', fill: 'var(--success-bg)' },
  leads_por_semana: { stroke: 'var(--primary)', fill: 'var(--primary)' },
  ventas_por_mes: { stroke: 'var(--success)', fill: 'var(--success)' },
  ingresos_por_dia: { stroke: 'var(--warning)', fill: 'var(--warning-bg)' },
  ingresos_por_mes: { stroke: 'var(--warning)', fill: 'var(--warning)' },
  comisiones_por_mes: { stroke: 'var(--success)', fill: 'var(--success)' },
  conversion_por_dia: { stroke: 'var(--primary)', fill: 'var(--primary-muted)' },
}

function getChartConfig(dataKey) {
  return CHART_COLORS[dataKey] || { stroke: 'var(--primary)', fill: 'var(--primary-muted)' }
}

function getDataKeyField(dataKey) {
  if (dataKey === 'ingresos_por_dia' || dataKey === 'ingresos_por_mes') return 'total'
  if (dataKey === 'comisiones_por_mes') return 'total'
  if (dataKey === 'conversion_por_dia') return 'tasa'
  return 'total'
}

function getSeriesName(dataKey) {
  if (dataKey === 'ventas_por_dia' || dataKey === 'ventas_por_mes') return 'Ventas'
  if (dataKey === 'ingresos_por_dia' || dataKey === 'ingresos_por_mes') return 'Ingresos'
  if (dataKey === 'comisiones_por_mes') return 'Comisiones'
  if (dataKey === 'conversion_por_dia') return 'Tasa'
  return 'Leads'
}

export default memo(function WidgetChart({ widgetDef, data }) {
  const gradId = useId()
  const series = Array.isArray(data) ? data : []

  if (series.length === 0) {
    return <div className="db-widget-empty">Sin datos para este periodo</div>
  }

  const dk = widgetDef?.dataKey
  const chartType = widgetDef?.chartType || 'line'
  const colors = getChartConfig(dk)
  const field = getDataKeyField(dk)
  const name = getSeriesName(dk)

  if (chartType === 'bar') {
    return (
      <div className="db-wchart" role="img" aria-label={`Gráfico: ${widgetDef?.label || name}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={series} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="fecha" tickFormatter={formatDate} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
            <Bar dataKey={field} fill={colors.fill} radius={[3, 3, 0, 0]} name={name} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="db-wchart" role="img" aria-label={`Gráfico: ${widgetDef?.label || name}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={series} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad_${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.stroke} stopOpacity={0.2} />
              <stop offset="95%" stopColor={colors.stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={formatDate} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-hover)' }} />
          <Area type="monotone" dataKey={field} stroke={colors.stroke} fill={`url(#grad_${gradId})`} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name={name} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})
