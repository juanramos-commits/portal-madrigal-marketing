import { Link } from 'react-router-dom'

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

export default function DashboardPendientes({ pendientes }) {
  if (!pendientes) return null
  const { ventas, retiros } = pendientes
  if (ventas === 0 && retiros === 0) return null

  return (
    <div className="db-card db-card-warning">
      <div className="db-card-header">
        <h3 className="db-card-title db-card-title-warning">
          <AlertIcon /> Pendientes de aprobacion
        </h3>
      </div>
      <div className="db-pendientes-list">
        {ventas > 0 && (
          <Link to="/ventas/ventas" className="db-pendiente-item">
            <span className="db-pendiente-icon db-pendiente-ventas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
            <span className="db-pendiente-text">
              <strong>{ventas}</strong> {ventas === 1 ? 'venta pendiente' : 'ventas pendientes'} de aprobar
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, opacity: 0.5 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        )}
        {retiros > 0 && (
          <Link to="/ventas/wallet" className="db-pendiente-item">
            <span className="db-pendiente-icon db-pendiente-retiros">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </span>
            <span className="db-pendiente-text">
              <strong>{retiros}</strong> {retiros === 1 ? 'retiro pendiente' : 'retiros pendientes'} de aprobar
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, opacity: 0.5 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
