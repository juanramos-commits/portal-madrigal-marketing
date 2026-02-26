import { useState } from 'react'

export default function Calendario() {
  const currentDate = new Date()
  const [mesActual] = useState(currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }))

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Calendario de Ventas</h1>
        <p className="page-subtitle">Agenda y eventos del equipo de ventas</p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', textTransform: 'capitalize' }}>{mesActual}</h3>
        <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>
          No hay eventos programados para este mes.
        </p>
      </div>
    </div>
  )
}
