const NIVELES_SETTERS = [
  { key: 'leads', label: 'Leads nuevos', color: 'var(--color-category)' },
  { key: 'contactados', label: 'Contactados', color: 'var(--warning)' },
  { key: 'citas', label: 'Citas agendadas', color: 'var(--warning)' },
  { key: 'llamadas', label: 'Llamadas realizadas', color: 'var(--success)' },
  { key: 'ventas', label: 'Ventas cerradas', color: 'var(--success)' },
]

const NIVELES_CLOSERS = [
  { key: 'citas_recibidas', label: 'Citas recibidas', color: 'var(--color-category)' },
  { key: 'realizadas', label: 'Realizadas', color: 'var(--warning)' },
  { key: 'ventas', label: 'Ventas cerradas', color: 'var(--success)' },
]

const currencyFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
function formatCurrency(v) {
  return currencyFmt.format(Number(v) || 0)
}

export default function WidgetFunnel({ widgetDef, data }) {
  if (!data || typeof data !== 'object') return <div className="db-widget-empty">Sin datos</div>

  const isCloser = widgetDef?.dataKey === 'funnel_closers'
  const niveles = isCloser ? NIVELES_CLOSERS : NIVELES_SETTERS
  const firstVal = Number(data[niveles[0]?.key]) || 1
  const allZero = niveles.every(n => (Number(data[n.key]) || 0) === 0)

  if (allZero) return <div className="db-widget-empty">Sin datos para este periodo</div>

  const lastKey = niveles[niveles.length - 1].key
  const tasaGlobal = firstVal > 0 ? ((Number(data[lastKey]) || 0) / firstVal * 100).toFixed(1) : '0.0'

  return (
    <div className="db-wfunnel" role="list" aria-label="Etapas del funnel">
      {niveles.map((nivel, i) => {
        const val = Number(data[nivel.key]) || 0
        const pct = (val / firstVal) * 100
        const prevVal = i > 0 ? (Number(data[niveles[i - 1].key]) || 0) : null
        const convRate = prevVal && prevVal > 0 ? ((val / prevVal) * 100).toFixed(1) : null

        return (
          <div key={nivel.key} className="db-wfunnel-row" role="listitem" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="db-wfunnel-info">
              <span className="db-wfunnel-label">{nivel.label}</span>
              <span className="db-wfunnel-count">{val}</span>
            </div>
            <div className="db-wfunnel-bar-bg">
              <div className="db-wfunnel-bar" style={{ width: `${Math.max(pct, 3)}%`, background: nivel.color }} />
            </div>
            <span className="db-wfunnel-rate">{convRate ? `${convRate}%` : ''}</span>
          </div>
        )
      })}
      {isCloser && data.facturacion != null && (
        <div className="db-wfunnel-global">
          Facturación: <strong>{formatCurrency(Number(data.facturacion) || 0)}</strong>
        </div>
      )}
      <div className="db-wfunnel-global">
        Tasa global: <strong>{tasaGlobal}%</strong>
      </div>
    </div>
  )
}
