import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const COLORS = [
  'var(--color-category)', 'var(--success)', 'var(--warning)', 'var(--error)',
  'var(--text-muted)', 'var(--color-purple)', 'var(--color-pink)', 'var(--color-sky)',
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="db-wchart-tooltip">
      <div style={{ color: d.payload?.fill || d.color }}>{d.name || d.payload?.nombre || '-'}</div>
      <div style={{ color: 'var(--text)' }}>{d.value ?? 0}</div>
    </div>
  )
}

function PieDistribution({ data, label }) {
  const total = data.reduce((s, d) => s + (Number(d.valor) || 0), 0)

  return (
    <div className="db-wdist">
      <div className="db-wdist-chart" role="img" aria-label={`Gráfico: ${label}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="valor"
              nameKey="nombre"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={d.nombre || i} fill={d.color || COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="db-wdist-legend">
        {data.map((d, i) => (
          <div key={d.nombre || i} className="db-wdist-legend-item">
            <span className="db-wdist-legend-dot" style={{ background: d.color || COLORS[i % COLORS.length] }} />
            <span>{d.nombre}</span>
            <span className="db-wdist-legend-value">{d.valor}</span>
            {total > 0 && <span className="db-wdist-legend-pct">({Math.round(d.valor / total * 100)}%)</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function HorizontalBarDistribution({ data, label }) {
  return (
    <div className="db-wdist">
      <div className="db-wdist-chart" role="img" aria-label={`Gráfico: ${label}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={100} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={d.nombre || i} fill={d.color || COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function WidgetDistribution({ widgetDef, data }) {
  const items = Array.isArray(data) ? data : []
  if (items.length === 0) return <div className="db-widget-empty">Sin datos para este periodo</div>

  const label = widgetDef?.label || 'Distribución'

  if (widgetDef?.chartType === 'horizontal_bar') {
    return <HorizontalBarDistribution data={items} label={label} />
  }
  return <PieDistribution data={items} label={label} />
}
