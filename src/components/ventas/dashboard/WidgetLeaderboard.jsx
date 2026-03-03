import { useMemo } from 'react'

const currencyFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
function formatCurrency(v) {
  return currencyFmt.format(Number(v) || 0)
}

function MedalIcon({ pos }) {
  if (pos === 0) return <span className="db-wlead-medal db-wlead-gold">1</span>
  if (pos === 1) return <span className="db-wlead-medal db-wlead-silver">2</span>
  if (pos === 2) return <span className="db-wlead-medal db-wlead-bronze">3</span>
  return <span className="db-wlead-pos">{pos + 1}</span>
}

export default function WidgetLeaderboard({ widgetDef, data }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) return <div className="db-widget-empty">Sin datos</div>

  const isCloser = widgetDef?.dataKey === 'ranking_closers'

  const maxVal = useMemo(() => isCloser
    ? Math.max(...rows.map(r => Number(r.facturacion) || 0), 1)
    : Math.max(...rows.map(r => Number(r.citas) || 0), 1),
  [rows, isCloser])

  return (
    <div className="db-wlead">
      {rows.map((r, i) => {
        const barPct = isCloser
          ? ((Number(r.facturacion) || 0) / maxVal) * 100
          : ((Number(r.citas) || 0) / maxVal) * 100

        return (
          <div key={r.usuario_id || i} className="db-wlead-item" style={{ animationDelay: `${i * 60}ms` }}>
            <MedalIcon pos={i} />
            <div className="db-wlead-info">
              <div className="db-wlead-top">
                <span className="db-wlead-name">{r.nombre || r.email}</span>
                <span className="db-wlead-stats">
                  {isCloser
                    ? `${Number(r.ventas) || 0} ventas · ${formatCurrency(Number(r.facturacion) || 0)}`
                    : `${Number(r.citas) || 0} citas · ${Number(r.leads_asignados) || 0} leads`
                  }
                </span>
              </div>
              <div className="db-wlead-bar-bg">
                <div
                  className={`db-wlead-bar ${isCloser ? 'db-wlead-bar--closer' : 'db-wlead-bar--setter'}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
