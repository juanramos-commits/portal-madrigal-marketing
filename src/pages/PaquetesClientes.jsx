import { useState } from 'react'

export default function PaquetesClientes() {
  const [paquetes] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Paquetes de Clientes</h1>
        <p className="page-subtitle">Gestión de paquetes y servicios contratados</p>
      </div>

      {paquetes.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: '1.1rem' }}>No hay paquetes registrados.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Aquí podrás gestionar los paquetes de servicios de cada cliente.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {paquetes.map((p, i) => (
            <div key={i} className="card" style={{ padding: '1.5rem' }}>
              <h3>{p.nombre}</h3>
              <p style={{ color: '#888' }}>{p.descripcion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
