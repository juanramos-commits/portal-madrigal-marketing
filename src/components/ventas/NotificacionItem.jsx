import { useNavigate } from 'react-router-dom'
import {
  UserPlus, CalendarCheck, CalendarX, CircleCheckBig, CircleX,
  DollarSign, Clock, Bell, X,
} from 'lucide-react'

const TIPO_CONFIG = {
  lead_asignado:    { icon: UserPlus,       color: 'ntf-color-info' },
  cita_agendada:    { icon: CalendarCheck,   color: 'ntf-color-info' },
  cita_cancelada:   { icon: CalendarX,       color: 'ntf-color-error' },
  venta_aprobada:   { icon: CircleCheckBig,  color: 'ntf-color-success' },
  venta_rechazada:  { icon: CircleX,         color: 'ntf-color-error' },
  comision_añadida: { icon: DollarSign,      color: 'ntf-color-success' },
  retiro_aprobado:  { icon: CircleCheckBig,  color: 'ntf-color-success' },
  retiro_rechazado: { icon: CircleX,         color: 'ntf-color-error' },
  retiro_pendiente: { icon: Clock,           color: 'ntf-color-warning' },
  venta_pendiente:  { icon: Clock,           color: 'ntf-color-warning' },
}

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
  if (!fecha) return ''
  const f = new Date(fecha)
  if (isNaN(f.getTime())) return ''
  const ahora = new Date()
  const diffMs = ahora - f
  const diffMin = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMs / 3600000)
  const diffDias = Math.floor(diffMs / 86400000)

  if (diffMs < 0 || diffMin < 1) return 'Ahora mismo'
  if (diffMin < 60) return `Hace ${diffMin} minuto${diffMin === 1 ? '' : 's'}`
  if (diffHoras < 24) return `Hace ${diffHoras} hora${diffHoras === 1 ? '' : 's'}`
  if (diffDias === 1) return f.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (diffDias < 7) return `Hace ${diffDias} días`
  return f.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function NotificacionItem({ notificacion, onMarcarLeida, onEliminar }) {
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

  const handleEliminar = (e) => {
    e.stopPropagation()
    onEliminar(notificacion.id)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const config = TIPO_CONFIG[notificacion.tipo]
  const Icon = config?.icon || Bell
  const colorClass = config?.color || ''

  return (
    <div
      className={`ntf-item${!notificacion.leida ? ' ntf-no-leida' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {!notificacion.leida && <span className="ntf-dot" />}
      <div className={`ntf-icon${colorClass ? ` ${colorClass}` : ''}`}><Icon size={20} /></div>
      <div className="ntf-content">
        <div className="ntf-top-row">
          <div className="ntf-titulo">{notificacion.titulo}</div>
          <span className="ntf-tiempo">{tiempoRelativo(notificacion.created_at)}</span>
        </div>
        {notificacion.mensaje && (
          <div className="ntf-mensaje">{notificacion.mensaje}</div>
        )}
      </div>
      <button type="button" className="ntf-btn-eliminar" onClick={handleEliminar} aria-label="Eliminar notificación">
        <X size={14} />
      </button>
    </div>
  )
}
