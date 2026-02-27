import { useNavigate } from 'react-router-dom'

const TIPO_ICONOS = {
  lead_asignado: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  cita_agendada: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  cita_cancelada: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="15" stroke="#ef4444"/>
    </svg>
  ),
  venta_aprobada: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  venta_rechazada: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  comision_añadida: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  retiro_aprobado: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  retiro_rechazado: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  retiro_pendiente: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  venta_pendiente: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
}

const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

const RUTAS = {
  lead_asignado: (datos) => datos?.lead_id ? `/ventas/crm/lead/${datos.lead_id}` : '/ventas/crm',
  cita_agendada: () => '/ventas/calendario',
  cita_cancelada: () => '/ventas/calendario',
  venta_aprobada: () => '/ventas/ventas',
  venta_rechazada: () => '/ventas/ventas',
  venta_pendiente: () => '/ventas/ventas',
  comision_añadida: () => '/ventas/wallet',
  retiro_aprobado: () => '/ventas/wallet',
  retiro_rechazado: () => '/ventas/wallet',
  retiro_pendiente: () => '/ventas/wallet',
}

function tiempoRelativo(fecha) {
  const ahora = new Date()
  const f = new Date(fecha)
  const diffMs = ahora - f
  const diffMin = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMs / 3600000)
  const diffDias = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Ahora mismo'
  if (diffMin < 60) return `Hace ${diffMin} minuto${diffMin === 1 ? '' : 's'}`
  if (diffHoras < 24) return `Hace ${diffHoras} hora${diffHoras === 1 ? '' : 's'}`
  if (diffDias === 1) return 'Ayer'
  if (diffDias < 7) return `Hace ${diffDias} días`
  return f.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export { tiempoRelativo }

export default function NotificacionItem({ notificacion, onMarcarLeida }) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (!notificacion.leida) {
      onMarcarLeida(notificacion.id)
    }
    const getRuta = RUTAS[notificacion.tipo]
    if (getRuta) {
      const ruta = getRuta(notificacion.datos)
      navigate(ruta)
    }
  }

  const icono = TIPO_ICONOS[notificacion.tipo] || DEFAULT_ICON

  return (
    <div
      className={`ntf-item${!notificacion.leida ? ' ntf-no-leida' : ''}`}
      onClick={handleClick}
    >
      {!notificacion.leida && <span className="ntf-dot" />}
      <div className="ntf-icon">{icono}</div>
      <div className="ntf-content">
        <div className="ntf-titulo">{notificacion.titulo}</div>
        {notificacion.mensaje && (
          <div className="ntf-mensaje">{notificacion.mensaje}</div>
        )}
        <div className="ntf-tiempo">{tiempoRelativo(notificacion.created_at)}</div>
      </div>
    </div>
  )
}
