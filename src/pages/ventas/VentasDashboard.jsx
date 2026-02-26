import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function VentasDashboard() {
  const { usuario } = useAuth()

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dashboard de Ventas</h1>
        <p className="page-subtitle">Resumen general del área de ventas</p>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <h3>Leads Nuevos</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
          <span style={{ color: '#888', fontSize: '0.875rem' }}>Este mes</span>
        </div>
        <div className="stat-card">
          <h3>Citas Agendadas</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
          <span style={{ color: '#888', fontSize: '0.875rem' }}>Esta semana</span>
        </div>
        <div className="stat-card">
          <h3>Cierres</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
          <span style={{ color: '#888', fontSize: '0.875rem' }}>Este mes</span>
        </div>
        <div className="stat-card">
          <h3>Ingresos</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0' }}>$0</p>
          <span style={{ color: '#888', fontSize: '0.875rem' }}>Este mes</span>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
        <p>Los datos del dashboard se conectarán próximamente.</p>
      </div>
    </div>
  )
}
