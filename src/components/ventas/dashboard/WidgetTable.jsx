function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function formatCurrency(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

const ESTADO_COLORS = {
  pendiente: 'var(--warning)',
  aprobada: 'var(--success)',
  rechazada: 'var(--error)',
}

function LeadsTable({ data }) {
  return (
    <table className="db-wtable">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Negocio</th>
          <th>Fuente</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        {data.map(l => (
          <tr key={l.id}>
            <td className="db-wtable-name">{l.nombre || '-'}</td>
            <td>{l.nombre_negocio || '-'}</td>
            <td>{l.fuente || '-'}</td>
            <td className="db-wtable-date">{formatDate(l.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function VentasTable({ data }) {
  return (
    <table className="db-wtable">
      <thead>
        <tr>
          <th>Lead</th>
          <th>Paquete</th>
          <th>Importe</th>
          <th>Estado</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        {data.map(v => (
          <tr key={v.id}>
            <td className="db-wtable-name">{v.lead_nombre || '-'}</td>
            <td>{v.paquete_nombre || '-'}</td>
            <td className="db-wtable-amount">{formatCurrency(v.importe)}</td>
            <td>
              <span className="db-wtable-estado" style={{ color: ESTADO_COLORS[v.estado] || 'var(--text-muted)' }}>
                {v.estado}
              </span>
            </td>
            <td className="db-wtable-date">{formatDate(v.fecha_venta)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function WidgetTable({ widgetDef, data }) {
  const rows = Array.isArray(data) ? data : []

  if (rows.length === 0) {
    return <div className="db-widget-empty">Sin datos recientes</div>
  }

  if (widgetDef?.dataKey === 'leads_recientes') return <LeadsTable data={rows} />
  if (widgetDef?.dataKey === 'ventas_recientes') return <VentasTable data={rows} />
  return null
}
