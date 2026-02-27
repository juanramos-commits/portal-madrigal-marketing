const NIVELES = [
  { key: 'leads', label: 'Leads nuevos', color: '#6366F1' },
  { key: 'contactados', label: 'Contactados', color: '#8B5CF6' },
  { key: 'citas', label: 'Citas agendadas', color: '#A855F7' },
  { key: 'llamadas', label: 'Llamadas realizadas', color: '#22C55E' },
  { key: 'ventas', label: 'Ventas cerradas', color: '#10B981' },
]

export default function DashboardGraficoFunnel({ funnel, loading }) {
  if (loading) {
    return (
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Embudo de conversion</h3>
        </div>
        <div className="db-funnel-skeleton">
          {[100, 75, 50, 35, 20].map((w, i) => (
            <div key={i} className="db-funnel-bar-sk" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!funnel) return null

  const firstVal = funnel.leads || 1
  const allZero = NIVELES.every(n => (funnel[n.key] || 0) === 0)

  if (allZero) {
    return (
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Embudo de conversion</h3>
        </div>
        <div className="db-empty">No hay datos para este periodo</div>
      </div>
    )
  }

  const tasaGlobal = firstVal > 0 ? ((funnel.ventas || 0) / firstVal * 100).toFixed(1) : '0.0'

  return (
    <div className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Embudo de conversion</h3>
      </div>
      <div className="db-funnel">
        {NIVELES.map((nivel, i) => {
          const val = funnel[nivel.key] || 0
          const pct = (val / firstVal) * 100
          const prevVal = i > 0 ? (funnel[NIVELES[i - 1].key] || 0) : null
          const convRate = prevVal && prevVal > 0 ? ((val / prevVal) * 100).toFixed(1) : null

          return (
            <div key={nivel.key} className="db-funnel-row" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="db-funnel-info">
                <span className="db-funnel-label">{nivel.label}</span>
                <span className="db-funnel-count">{val}</span>
              </div>
              <div className="db-funnel-bar-container">
                <div
                  className="db-funnel-bar"
                  style={{ width: `${Math.max(pct, 2)}%`, background: nivel.color }}
                />
              </div>
              {convRate && (
                <span className="db-funnel-rate">{convRate}%</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="db-funnel-global">
        Tasa global: <strong>{tasaGlobal}%</strong> (leads a ventas)
      </div>
    </div>
  )
}
