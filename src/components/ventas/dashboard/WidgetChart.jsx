import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts'

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
          <span style={{ color: p.stroke || p.color }}>{p.name}:</span>{' '}
          {p.name === 'Importe' ? formatCurrency(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function WidgetChart({ widgetDef, data }) {
  const series = Array.isArray(data) ? data : []

  if (series.length === 0) {
    return <div className="db-widget-empty">Sin datos para este periodo</div>
  }

  const isVentas = widgetDef?.dataKey === 'ventas_por_dia'
  const strokeColor = isVentas ? 'var(--success)' : 'var(--info)'
  const fillColor = isVentas ? 'rgba(46, 229, 157, 0.1)' : 'rgba(100, 149, 237, 0.1)'

  return (
    <div className="db-wchart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad_${widgetDef.type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={formatDate} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="total" stroke={strokeColor} fill={`url(#grad_${widgetDef.type})`} strokeWidth={2} dot={false} name={isVentas ? 'Ventas' : 'Leads'} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
