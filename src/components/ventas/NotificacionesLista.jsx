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

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

export default function NotificacionesLista({
  notificaciones,
  loading,
  hayMas,
  onCargarMas,
  onMarcarLeida,
}) {
  if (loading && notificaciones.length === 0) {
    return <div className="ntf-loading">Cargando notificaciones...</div>
  }

  if (notificaciones.length === 0) {
    return (
      <div className="ntf-empty">
        <div className="ntf-empty-icon"><BellIcon /></div>
        <p>No tienes notificaciones</p>
      </div>
    )
  }

  const grupos = agruparPorFecha(notificaciones)

  return (
    <div className="ntf-lista">
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
              />
            ))}
          </div>
        )
      })}

      {hayMas && (
        <button className="ntf-cargar-mas" onClick={onCargarMas} disabled={loading}>
          {loading ? 'Cargando...' : 'Cargar más'}
        </button>
      )}
    </div>
  )
}
