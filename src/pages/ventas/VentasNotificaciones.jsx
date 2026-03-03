import { useEffect } from 'react'
import { CheckCheck } from 'lucide-react'
import { useNotificaciones } from '../../hooks/useNotificaciones'
import NotificacionesLista from '../../components/ventas/NotificacionesLista'
import '../../styles/ventas-notificaciones.css'

export default function VentasNotificaciones() {
  const ntf = useNotificaciones()

  useEffect(() => {
    const base = 'Notificaciones | Madrigal Marketing'
    document.title = ntf.contadorNoLeidas > 0
      ? `(${ntf.contadorNoLeidas}) ${base}`
      : base
    return () => { document.title = 'Madrigal Marketing | Portal' }
  }, [ntf.contadorNoLeidas])

  return (
    <div className="ntf-page">
      <div className="ntf-header">
        <div className="ntf-header-left">
          <h1>Notificaciones</h1>
          {ntf.contadorNoLeidas > 0 && (
            <span className="ntf-header-badge" role="status" aria-label={`${ntf.contadorNoLeidas} sin leer`}>{ntf.contadorNoLeidas}</span>
          )}
        </div>
        {ntf.contadorNoLeidas > 0 && (
          <button type="button" className="ntf-btn-marcar-todas" onClick={ntf.marcarTodasComoLeidas} aria-label={`Marcar ${ntf.contadorNoLeidas} notificaciones como leídas`}>
            <CheckCheck size={16} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="ntf-filtros" role="group" aria-label="Filtrar notificaciones">
        <button
          type="button"
          className={`ntf-filtro${ntf.filtro === 'todas' ? ' active' : ''}`}
          aria-pressed={ntf.filtro === 'todas'}
          onClick={() => ntf.setFiltro('todas')}
        >
          Todas
          {ntf.notificaciones.length > 0 && ntf.filtro === 'todas' && (
            <span className="ntf-filtro-count ntf-filtro-count--muted">{ntf.notificaciones.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`ntf-filtro${ntf.filtro === 'no_leidas' ? ' active' : ''}`}
          aria-pressed={ntf.filtro === 'no_leidas'}
          onClick={() => ntf.setFiltro('no_leidas')}
        >
          No leídas
          {ntf.contadorNoLeidas > 0 && (
            <span className="ntf-filtro-count">{ntf.contadorNoLeidas}</span>
          )}
        </button>
      </div>

      <NotificacionesLista
        notificaciones={ntf.notificaciones}
        loading={ntf.loading}
        error={ntf.error}
        hayMas={ntf.hayMas}
        filtroActivo={ntf.filtro}
        onCargarMas={ntf.cargarMas}
        onMarcarLeida={ntf.marcarComoLeida}
        onEliminar={ntf.eliminarNotificacion}
        onReintentar={ntf.refrescar}
        realtimeStatus={ntf.realtimeStatus}
      />
    </div>
  )
}
