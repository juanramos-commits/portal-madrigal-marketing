import { useState } from 'react'

export default function Notificaciones() {
  const [notificaciones] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Notificaciones</h1>
        <p className="page-subtitle">Centro de alertas y actualizaciones</p>
      </div>

      {notificaciones.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: '1.1rem' }}>No hay notificaciones por el momento.</p>
        </div>
      ) : (
        <div className="card">
          {notificaciones.map((n, i) => (
            <div key={i} style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
              {n.mensaje}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
