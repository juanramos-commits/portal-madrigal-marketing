import { useNotificaciones } from '../../hooks/useNotificaciones'
import NotificacionesLista from '../../components/ventas/NotificacionesLista'
import '../../styles/ventas-notificaciones.css'

const CheckAllIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)

export default function VentasNotificaciones() {
  const ntf = useNotificaciones()

  return (
    <div className="ntf-page">
      <div className="ntf-header">
        <h1>Notificaciones</h1>
        {ntf.contadorNoLeidas > 0 && (
          <button className="ntf-btn-marcar-todas" onClick={ntf.marcarTodasComoLeidas}>
            <CheckAllIcon />
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="ntf-filtros">
        <button
          className={`ntf-filtro${ntf.filtro === 'todas' ? ' active' : ''}`}
          onClick={() => ntf.setFiltro('todas')}
        >
          Todas
        </button>
        <button
          className={`ntf-filtro${ntf.filtro === 'no_leidas' ? ' active' : ''}`}
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
        hayMas={ntf.hayMas}
        onCargarMas={ntf.cargarMas}
        onMarcarLeida={ntf.marcarComoLeida}
      />
    </div>
  )
}
