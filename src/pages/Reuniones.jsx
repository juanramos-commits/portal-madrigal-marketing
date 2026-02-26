import { useState } from 'react'

export default function Reuniones() {
  const [reuniones] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reuniones</h1>
        <p className="page-subtitle">Calendario y registro de reuniones</p>
      </div>

      {reuniones.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: '1.1rem' }}>No hay reuniones programadas.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Las reuniones agendadas aparecerán aquí.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '2rem' }}>
          {reuniones.map((r, i) => (
            <div key={i} style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
              <h3>{r.titulo}</h3>
              <p style={{ color: '#888' }}>{r.fecha}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
