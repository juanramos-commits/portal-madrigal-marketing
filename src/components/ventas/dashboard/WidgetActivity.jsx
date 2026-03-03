function tiempoRelativo(fecha) {
  if (!fecha) return ''
  const diffMs = Date.now() - new Date(fecha).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin}m`
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 24) return `Hace ${diffH}h`
  const diffD = Math.floor(diffMs / 86400000)
  if (diffD < 7) return `Hace ${diffD}d`
  return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

const TIPO_COLORS = {
  cambio_etapa: 'var(--color-category)',
  cita_agendada: 'var(--success)',
  venta: 'var(--warning)',
  venta_rechazada: 'var(--error)',
  devolucion: 'var(--error)',
  asignacion: 'var(--color-category)',
  cita_cancelada: 'var(--warning)',
  edicion: 'var(--text-muted)',
  creacion: 'var(--success)',
}

export default function WidgetActivity({ widgetDef, data }) {
  const items = Array.isArray(data) ? data : []
  if (items.length === 0) return <div className="db-widget-empty">Sin actividad reciente</div>

  return (
    <div className="db-wactivity">
      {items.map(a => {
        const color = TIPO_COLORS[a.tipo] || 'var(--text-muted)'
        return (
          <div key={a.id} className="db-wactivity-item">
            <div className="db-wactivity-dot" style={{ background: color }} />
            <div className="db-wactivity-content">
              <span className="db-wactivity-time">{tiempoRelativo(a.created_at)}</span>
              <span className="db-wactivity-desc">
                {a.usuario_nombre && <strong>{a.usuario_nombre}</strong>}
                {' '}{a.descripcion}
                {a.lead_nombre && <> — <em>{a.lead_nombre}</em></>}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
