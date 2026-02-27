import { Link } from 'react-router-dom'

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

const TIPO_ICONOS = {
  cambio_etapa: { color: '#6366F1', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )},
  cita_agendada: { color: '#22C55E', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    </svg>
  )},
  venta: { color: '#F59E0B', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  venta_rechazada: { color: '#EF4444', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )},
  devolucion: { color: '#EF4444', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  )},
  asignacion: { color: '#3B82F6', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )},
  cita_cancelada: { color: '#F97316', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
    </svg>
  )},
}

const DEFAULT_ICON = { color: '#9CA3AF', icon: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)}

export default function DashboardActividadReciente({ actividad, loading, esAdmin }) {
  if (loading) {
    return (
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Actividad reciente</h3>
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="db-activity-item-sk" />
        ))}
      </div>
    )
  }

  return (
    <div className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Actividad reciente</h3>
      </div>
      {actividad.length === 0 ? (
        <div className="db-empty">Sin actividad reciente</div>
      ) : (
        <div className="db-activity-list">
          {actividad.map(a => {
            const tipoInfo = TIPO_ICONOS[a.tipo] || DEFAULT_ICON
            return (
              <div key={a.id} className="db-activity-item">
                <div className="db-activity-dot" style={{ background: tipoInfo.color }}>
                  {tipoInfo.icon}
                </div>
                <div className="db-activity-content">
                  <span className="db-activity-time">{tiempoRelativo(a.created_at)}</span>
                  <span className="db-activity-desc">
                    {a.usuario?.nombre && <strong>{a.usuario.nombre}</strong>}
                    {' '}{a.descripcion}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {esAdmin && (
        <Link to="/ventas/ajustes" className="db-card-link">
          Ver toda la actividad
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      )}
    </div>
  )
}
