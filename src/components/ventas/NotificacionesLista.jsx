import { AlertCircle, Bell } from 'lucide-react'
import NotificacionItem from './NotificacionItem'

function agruparPorFecha(notificaciones) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const ayer = new Date(hoy)
  ayer.setDate(ayer.getDate() - 1)
  const inicioSemana = new Date(hoy)
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + (inicioSemana.getDay() === 0 ? -6 : 1))

  const grupos = {
    hoy: [],
    ayer: [],
    estaSemana: [],
    anteriores: [],
  }

  for (const n of notificaciones) {
    const fecha = new Date(n.created_at)
    if (isNaN(fecha.getTime())) { grupos.anteriores.push(n); continue }
    fecha.setHours(0, 0, 0, 0)

    if (fecha.getTime() === hoy.getTime()) {
      grupos.hoy.push(n)
    } else if (fecha.getTime() === ayer.getTime()) {
      grupos.ayer.push(n)
    } else if (fecha >= inicioSemana) {
      grupos.estaSemana.push(n)
    } else {
      grupos.anteriores.push(n)
    }
  }

  return grupos
}

const GRUPO_LABELS = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  estaSemana: 'Esta semana',
  anteriores: 'Anteriores',
}


export default function NotificacionesLista({
  notificaciones,
  loading,
  error,
  hayMas,
  filtroActivo,
  onCargarMas,
  onMarcarLeida,
  onEliminar,
  onReintentar,
}) {
  if (error && notificaciones.length === 0) {
    return (
      <div className="ntf-empty ntf-empty--error">
        <div className="ntf-empty-icon"><AlertCircle size={32} /></div>
        <p>{error}</p>
        {onReintentar && (
          <button type="button" className="ntf-btn-reintentar" onClick={onReintentar}>Reintentar</button>
        )}
      </div>
    )
  }

  if (loading && notificaciones.length === 0) {
    return (
      <>
        <div className="ntf-skeleton-list" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="ntf-skeleton-item">
              <div className="ntf-skeleton-icon" />
              <div className="ntf-skeleton-content">
                <div className="ntf-skeleton-line ntf-skeleton-line--title" />
                <div className="ntf-skeleton-line ntf-skeleton-line--msg" />
                <div className="ntf-skeleton-line ntf-skeleton-line--time" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only" role="status">Cargando notificaciones</span>
      </>
    )
  }

  if (notificaciones.length === 0) {
    return (
      <div className="ntf-empty">
        <div className="ntf-empty-icon"><Bell size={48} /></div>
        <p>{filtroActivo === 'no_leidas' ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}</p>
        {filtroActivo === 'no_leidas' && (
          <span className="ntf-empty-hint">Todas tus notificaciones han sido leídas</span>
        )}
      </div>
    )
  }

  const grupos = agruparPorFecha(notificaciones)

  return (
    <div className="ntf-lista" aria-live="polite">
      {Object.entries(GRUPO_LABELS).map(([key, label]) => {
        const items = grupos[key]
        if (!items || items.length === 0) return null

        return (
          <div key={key} className="ntf-grupo">
            <div className="ntf-grupo-label">{label}</div>
            {items.map(n => (
              <NotificacionItem
                key={n.id}
                notificacion={n}
                onMarcarLeida={onMarcarLeida}
                onEliminar={onEliminar}
              />
            ))}
          </div>
        )
      })}

      {error && (
        <div className="ntf-error-inline">
          {error}
          {onReintentar && (
            <button type="button" className="ntf-error-inline-btn" onClick={onReintentar}>Reintentar</button>
          )}
        </div>
      )}

      {hayMas && !error && (
        <button type="button" className="ntf-cargar-mas" onClick={onCargarMas} disabled={loading}>
          {loading && <span className="ntf-spinner" />}
          {loading ? 'Cargando...' : 'Cargar más'}
        </button>
      )}
    </div>
  )
}
