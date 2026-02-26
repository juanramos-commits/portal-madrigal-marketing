import { useState } from 'react'

export default function CRM() {
  const [leads] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>CRM</h1>
        <p className="page-subtitle">Gestión de relaciones con clientes</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <h3>Leads Activos</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
        </div>
        <div className="stat-card">
          <h3>En Seguimiento</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
        </div>
        <div className="stat-card">
          <h3>Convertidos</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Pipeline</h3>
        {leads.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>No hay leads registrados.</p>
        ) : null}
      </div>
    </div>
  )
}
