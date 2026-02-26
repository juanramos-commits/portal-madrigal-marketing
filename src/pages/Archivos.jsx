import { useState } from 'react'

export default function Archivos() {
  const [archivos] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Archivos</h1>
        <p className="page-subtitle">Gestión de archivos y documentos</p>
      </div>

      {archivos.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: '1.1rem' }}>No hay archivos subidos.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Aquí podrás gestionar los archivos del equipo.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {archivos.map((a, i) => (
            <div key={i} className="card" style={{ padding: '1.5rem' }}>
              <h3>{a.nombre}</h3>
              <p style={{ color: '#888', fontSize: '0.875rem' }}>{a.tipo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
