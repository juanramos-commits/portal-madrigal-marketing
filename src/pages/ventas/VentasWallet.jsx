import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function VentasWallet() {
  const { usuario } = useAuth()

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Wallet</h1>
        <p className="page-subtitle">Comisiones y balance del equipo de ventas</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <h3>Balance Disponible</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>$0.00</p>
        </div>
        <div className="stat-card">
          <h3>Comisiones Pendientes</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>$0.00</p>
        </div>
        <div className="stat-card">
          <h3>Total Pagado</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>$0.00</p>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Historial de Transacciones</h3>
        <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>No hay transacciones registradas.</p>
      </div>
    </div>
  )
}
