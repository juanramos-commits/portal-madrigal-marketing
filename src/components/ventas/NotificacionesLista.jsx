import { useCallback, useRef } from 'react'
import { AlertCircle, Bell } from 'lucide-react'
import { useTick } from '../../hooks/useTick'
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
  realtimeStatus,
}) {
  // Force re-render every 60s to update relative timestamps
  useTick(60000)

  const listaRef = useRef(null)

  const handleKeyDown = useCallback((e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const items = listaRef.current?.querySelectorAll('.ntf-item')
    if (!items || items.length === 0) return

    e.preventDefault()
    const list = Array.from(items)
    const idx = list.indexOf(document.activeElement)

    let next
    if (e.key === 'ArrowDown') next = idx < list.length - 1 ? idx + 1 : 0
    else if (e.key === 'ArrowUp') next = idx > 0 ? idx - 1 : list.length - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = list.length - 1

    list[next]?.focus()
    list[next]?.scrollIntoView({ block: 'nearest' })
  }, [])

  if (error && notificaciones.length === 0) {
    return (
      <div className="ntf-empty ntf-empty--error" role="alert">
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
      <div className="ntf-empty" role="status">
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
    <div ref={listaRef} className="ntf-lista" aria-live="polite" aria-relevant="additions removals" onKeyDown={handleKeyDown}>
      {realtimeStatus && realtimeStatus !== 'connected' && (
        <div className="ntf-realtime-banner" role="status">
          <span className="ntf-spinner" />
          {realtimeStatus === 'connecting' && 'Conectando...'}
          {realtimeStatus === 'reconnecting' && 'Reconectando...'}
          {realtimeStatus === 'error' && 'Conexión perdida. Reconectando...'}
        </div>
      )}
      {Object.entries(GRUPO_LABELS).map(([key, label]) => {
        const items = grupos[key]
        if (!items || items.length === 0) return null

        return (
          <section key={key} className="ntf-grupo" aria-labelledby={`ntf-grupo-${key}`}>
            <h3 id={`ntf-grupo-${key}`} className="ntf-grupo-label">{label}</h3>
            {items.map(n => (
              <NotificacionItem
                key={n.id}
                notificacion={n}
                onMarcarLeida={onMarcarLeida}
                onEliminar={onEliminar}
              />
            ))}
          </section>
        )
      })}

      {error && (
        <div className="ntf-error-inline" role="alert">
          {error}
          {onReintentar && (
            <button type="button" className="ntf-error-inline-btn" onClick={onReintentar}>Reintentar</button>
          )}
        </div>
      )}

      {hayMas && !error && (
        <button type="button" className="ntf-cargar-mas" onClick={onCargarMas} disabled={loading} aria-busy={loading}>
          {loading && <span className="ntf-spinner" />}
          {loading ? 'Cargando...' : 'Cargar más'}
        </button>
      )}
    </div>
  )
}
