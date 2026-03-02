import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart, BarChart, Bar } from 'recharts'

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getDate()}/${date.getMonth() + 1}`
}

function formatCurrency(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="db-wchart-tooltip">
      <div className="db-wchart-tooltip-date">{formatDate(label)}</div>
      {payload.map((p, i) => (
        <div key={i} className="db-wchart-tooltip-row">
          <span style={{ color: p.stroke || p.fill || p.color }}>{p.name}:</span>{' '}
          {p.name === 'Importe' || p.name === 'Ingresos' || p.name === 'Comisiones' ? formatCurrency(p.value) : p.value}
          {p.name === 'Tasa' && '%'}
        </div>
      ))}
    </div>
  )
}

const CHART_COLORS = {
  leads_por_dia: { stroke: 'var(--info)', fill: 'rgba(100, 149, 237, 0.1)' },
  ventas_por_dia: { stroke: 'var(--success)', fill: 'rgba(46, 229, 157, 0.1)' },
  leads_por_semana: { stroke: '#6366F1', fill: '#6366F1' },
  ventas_por_mes: { stroke: '#22C55E', fill: '#22C55E' },
  ingresos_por_dia: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.1)' },
  ingresos_por_mes: { stroke: '#F59E0B', fill: '#F59E0B' },
  comisiones_por_mes: { stroke: '#8B5CF6', fill: '#8B5CF6' },
  conversion_por_dia: { stroke: '#6366F1', fill: 'rgba(99, 102, 241, 0.1)' },
}

function getChartConfig(dataKey) {
  return CHART_COLORS[dataKey] || { stroke: 'var(--info)', fill: 'rgba(100, 149, 237, 0.1)' }
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

export default function WidgetChart({ widgetDef, data }) {
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
      <div className="db-wchart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
    <div className="db-wchart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad_${widgetDef.type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.stroke} stopOpacity={0.2} />
              <stop offset="95%" stopColor={colors.stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={formatDate} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey={field} stroke={colors.stroke} fill={`url(#grad_${widgetDef.type})`} strokeWidth={2} dot={false} name={name} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
