import { useState } from 'react'

function formatCurrency(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function formatPeriodLabel(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDate()
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${day} ${months[d.getMonth()]}`
}

export default function DashboardGraficoVentas({ datos, loading }) {
  const [modo, setModo] = useState('facturacion')

  if (loading) {
    return (
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Ventas por periodo</h3>
        </div>
        <div className="db-chart-skeleton">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="db-chart-bar-sk" style={{ height: `${20 + Math.random() * 60}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!datos || datos.length === 0) {
    return (
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Ventas por periodo</h3>
        </div>
        <div className="db-empty">No hay datos de ventas para este periodo</div>
      </div>
    )
  }

  const values = datos.map(d => modo === 'facturacion' ? Number(d.facturacion) : Number(d.num_ventas))
  const maxVal = Math.max(...values, 1)
  const ySteps = 4
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const v = (maxVal / ySteps) * (ySteps - i)
    if (modo === 'facturacion') return formatCurrency(v)
    return Math.round(v).toString()
  })

  return (
    <div className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Ventas por periodo</h3>
        <div className="db-chart-toggle">
          <button
            className={`db-toggle-btn${modo === 'facturacion' ? ' active' : ''}`}
            onClick={() => setModo('facturacion')}
          >Facturacion</button>
          <button
            className={`db-toggle-btn${modo === 'cantidad' ? ' active' : ''}`}
            onClick={() => setModo('cantidad')}
          >Cantidad</button>
        </div>
      </div>
      <div className="db-chart-container">
        <div className="db-chart-y-axis">
          {yLabels.map((label, i) => (
            <span key={i} className="db-chart-y-label">{label}</span>
          ))}
        </div>
        <div className="db-chart">
          <div className="db-chart-grid">
            {yLabels.map((_, i) => (
              <div key={i} className="db-chart-grid-line" />
            ))}
          </div>
          <div className="db-chart-bars">
            {datos.map((d, i) => {
              const val = modo === 'facturacion' ? Number(d.facturacion) : Number(d.num_ventas)
              const pct = (val / maxVal) * 100
              const tooltip = modo === 'facturacion' ? formatCurrency(val) : `${val} ventas`
              return (
                <div key={i} className="db-chart-bar-wrap">
                  <div className="db-chart-bar-tooltip">{tooltip}</div>
                  <div
                    className="db-chart-bar"
                    style={{ height: `${pct}%`, animationDelay: `${i * 60}ms` }}
                  />
                  <span className="db-chart-bar-label">{formatPeriodLabel(d.periodo)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
