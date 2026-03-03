import { memo } from 'react'

function tasaClass(tasa) {
  const v = Number(tasa) || 0
  if (v >= 50) return 'db-wconv-tasa-high'
  if (v >= 25) return 'db-wconv-tasa-mid'
  return 'db-wconv-tasa-low'
}

export default memo(function WidgetConversionTable({ widgetDef, data }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) return <div className="db-widget-empty">Sin datos</div>

  const isCloser = widgetDef?.dataKey === 'conversion_por_closer'

  return (
    <table className="db-wtable">
      <caption className="sr-only">
        {isCloser ? 'Tasa de conversión por closer' : 'Tasa de conversión por setter'}
      </caption>
      <thead>
        <tr>
          <th scope="col">Nombre</th>
          <th scope="col">{isCloser ? 'Citas' : 'Leads'}</th>
          <th scope="col">{isCloser ? 'Ventas' : 'Citas'}</th>
          <th scope="col">Tasa</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.usuario_id || i}>
            <td className="db-wtable-name" title={r.nombre || r.email || undefined}>{r.nombre || r.email || '-'}</td>
            <td className="db-wconv-count">{isCloser ? (r.citas || 0) : (r.leads || 0)}</td>
            <td className="db-wconv-count">{isCloser ? (r.ventas || 0) : (r.citas || 0)}</td>
            <td className={tasaClass(r.tasa)}>{(Number(r.tasa) || 0).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
})
