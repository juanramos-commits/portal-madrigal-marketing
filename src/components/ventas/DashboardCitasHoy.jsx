import { Link } from 'react-router-dom'

function formatHora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function esProximaCita(fecha) {
  const ahora = Date.now()
  const citaMs = new Date(fecha).getTime()
  const diff = citaMs - ahora
  return diff > -3600000 && diff < 3600000
}

export default function DashboardCitasHoy({ citas, loading }) {
  if (loading) {
    return (
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Citas de hoy</h3>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="db-cita-sk" />
        ))}
      </div>
    )
  }

  return (
    <div className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Citas de hoy ({citas.length})</h3>
      </div>
      {citas.length === 0 ? (
        <div className="db-empty">No hay citas programadas para hoy</div>
      ) : (
        <div className="db-citas-list">
          {citas.map(c => {
            const proxima = esProximaCita(c.fecha_hora)
            return (
              <div key={c.id} className={`db-cita-item${proxima ? ' db-cita-proxima' : ''}`}>
                <span className="db-cita-hora">{formatHora(c.fecha_hora)}</span>
                <div className="db-cita-info">
                  <span className="db-cita-lead">{c.lead?.nombre || 'Sin nombre'}</span>
                  <span className="db-cita-closer">{c.closer?.nombre || c.closer?.email || '-'}</span>
                </div>
                {c.google_meet_url && (
                  <a
                    href={c.google_meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="db-cita-meet"
                    onClick={e => e.stopPropagation()}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2"/>
                    </svg>
                    Meet
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
      <Link to="/ventas/calendario" className="db-card-link">
        Ver calendario
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </Link>
    </div>
  )
}
