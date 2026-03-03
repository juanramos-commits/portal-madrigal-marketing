import { formatCurrency } from '../../../config/formatters'

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function tiempoRelativo(fecha) {
  if (!fecha) return '-'
  const diffMs = Date.now() - new Date(fecha).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffMs / 86400000)
  return `${diffD}d`
}

function formatDateTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const ESTADO_COLORS = {
  pendiente: 'var(--warning)',
  aprobada: 'var(--success)',
  rechazada: 'var(--error)',
  completado: 'var(--success)',
  procesando: 'var(--color-category)',
}

function LeadsTable({ data }) {
  return (
    <table className="db-wtable">
      <caption className="sr-only">Leads recientes</caption>
      <thead>
        <tr>
          <th scope="col">Nombre</th>
          <th scope="col">Negocio</th>
          <th scope="col">Fuente</th>
          <th scope="col">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {data.map(l => (
          <tr key={l.id}>
            <td className="db-wtable-name" title={l.nombre || undefined}>{l.nombre || '-'}</td>
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
      <caption className="sr-only">Ventas recientes</caption>
      <thead>
        <tr>
          <th scope="col">Lead</th>
          <th scope="col">Paquete</th>
          <th scope="col">Importe</th>
          <th scope="col">Estado</th>
          <th scope="col">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {data.map(v => (
          <tr key={v.id}>
            <td className="db-wtable-name" title={v.lead_nombre || undefined}>{v.lead_nombre || '-'}</td>
            <td>{v.paquete_nombre || '-'}</td>
            <td className="db-wtable-amount">{formatCurrency(Number(v.importe) || 0)}</td>
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

function ComisionesTable({ data }) {
  return (
    <table className="db-wtable">
      <caption className="sr-only">Comisiones recientes</caption>
      <thead>
        <tr>
          <th scope="col">Lead</th>
          <th scope="col">Concepto</th>
          <th scope="col">Monto</th>
          <th scope="col">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {data.map((c, i) => (
          <tr key={c.id || i}>
            <td className="db-wtable-name" title={c.lead_nombre || undefined}>{c.lead_nombre || '-'}</td>
            <td>{c.concepto || '-'}</td>
            <td className="db-wtable-amount">{formatCurrency(Number(c.monto) || 0)}</td>
            <td className="db-wtable-date">{formatDate(c.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RetirosTable({ data }) {
  return (
    <table className="db-wtable">
      <caption className="sr-only">Retiros recientes</caption>
      <thead>
        <tr>
          <th scope="col">Monto</th>
          <th scope="col">Estado</th>
          <th scope="col">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={r.id || i}>
            <td className="db-wtable-amount">{formatCurrency(Number(r.monto) || 0)}</td>
            <td>
              <span className="db-wtable-estado" style={{ color: ESTADO_COLORS[r.estado] || 'var(--text-muted)' }}>
                {r.estado}
              </span>
            </td>
            <td className="db-wtable-date">{formatDate(r.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LeadsSinContactarTable({ data }) {
  return (
    <table className="db-wtable">
      <caption className="sr-only">Leads sin contactar</caption>
      <thead>
        <tr>
          <th scope="col">Nombre</th>
          <th scope="col">Negocio</th>
          <th scope="col">Teléfono</th>
          <th scope="col">Tiempo</th>
        </tr>
      </thead>
      <tbody>
        {data.map((l, i) => (
          <tr key={l.id || i}>
            <td className="db-wtable-name" title={l.nombre || undefined}>{l.nombre || '-'}</td>
            <td>{l.nombre_negocio || '-'}</td>
            <td>{l.telefono || '-'}</td>
            <td className="db-wtable-date">{tiempoRelativo(l.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CitasProximasTable({ data }) {
  return (
    <table className="db-wtable">
      <caption className="sr-only">Citas próximas</caption>
      <thead>
        <tr>
          <th scope="col">Lead</th>
          <th scope="col">Closer</th>
          <th scope="col">Hora</th>
          <th scope="col">Meet</th>
        </tr>
      </thead>
      <tbody>
        {data.map((c, i) => (
          <tr key={c.id || i}>
            <td className="db-wtable-name" title={c.lead_nombre || undefined}>{c.lead_nombre || '-'}</td>
            <td>{c.closer_nombre || '-'}</td>
            <td className="db-wtable-date">{formatDateTime(c.fecha_hora)}</td>
            <td>
              {c.meet_link ? (
                <a href={c.meet_link} target="_blank" rel="noopener noreferrer" className="db-wtable-link">Enlace</a>
              ) : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const TABLE_MAP = {
  leads_recientes: LeadsTable,
  ventas_recientes: VentasTable,
  comisiones_recientes: ComisionesTable,
  retiros_recientes: RetirosTable,
  leads_sin_contactar: LeadsSinContactarTable,
  citas_proximas: CitasProximasTable,
}

export default function WidgetTable({ widgetDef, data }) {
  const rows = Array.isArray(data) ? data : []

  if (rows.length === 0) {
    return <div className="db-widget-empty">Sin datos recientes</div>
  }

  const TableComponent = TABLE_MAP[widgetDef?.dataKey]
  if (!TableComponent) return <div className="db-widget-empty">Tabla no soportada</div>
  return <TableComponent data={rows} />
}
