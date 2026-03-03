function tasaClass(tasa) {
  const v = Number(tasa) || 0
  if (v >= 50) return 'db-wconv-tasa-high'
  if (v >= 25) return 'db-wconv-tasa-mid'
  return 'db-wconv-tasa-low'
}

export default function WidgetConversionTable({ widgetDef, data }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) return <div className="db-widget-empty">Sin datos</div>

  const isCloser = widgetDef?.dataKey === 'conversion_por_closer'

  return (
    <table className="db-wtable">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>{isCloser ? 'Citas' : 'Leads'}</th>
          <th>{isCloser ? 'Ventas' : 'Citas'}</th>
          <th>Tasa</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.usuario_id || i}>
            <td className="db-wtable-name">{r.nombre || r.email || '-'}</td>
            <td>{isCloser ? (r.citas || 0) : (r.leads || 0)}</td>
            <td>{isCloser ? (r.ventas || 0) : (r.citas || 0)}</td>
            <td className={tasaClass(r.tasa)}>{Number(r.tasa || 0).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
