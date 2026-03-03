export default function WidgetPipeline({ widgetDef, data }) {
  const stages = Array.isArray(data) ? data.filter(d => d.total > 0 || d.nombre) : []
  if (stages.length === 0) return <div className="db-widget-empty">Sin datos de pipeline</div>

  const totalLeads = stages.reduce((s, d) => s + (Number(d.total) || 0), 0)

  return (
    <div className="db-wpipeline">
      {totalLeads > 0 && (
        <div
          className="db-wpipeline-stages"
          role="img"
          aria-label={`Pipeline: ${stages.filter(s => (Number(s.total) || 0) > 0).map(s => `${s.nombre} ${Number(s.total) || 0}`).join(', ')}`}
        >
          {stages.map((s, i) => {
            const val = Number(s.total) || 0
            if (val === 0) return null
            return (
              <div
                key={i}
                className="db-wpipeline-stage"
                style={{ flex: val, background: s.color || 'var(--text-muted)' }}
                aria-hidden="true"
              />
            )
          })}
        </div>
      )}
      <div className="db-wpipeline-labels">
        {stages.map((s, i) => (
          <div key={i} className="db-wpipeline-label">
            <span className="db-wpipeline-label-dot" style={{ background: s.color || 'var(--text-muted)' }} />
            <span>{s.nombre}</span>
            <span className="db-wpipeline-label-count">{Number(s.total) || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
