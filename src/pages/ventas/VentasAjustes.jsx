import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function VentasAjustes() {
  const { usuario } = useAuth()

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Ajustes de Ventas</h1>
        <p className="page-subtitle">Configuración del módulo de ventas</p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Configuración General</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>Moneda por defecto</label>
            <select className="login-input" style={{ maxWidth: '300px' }} disabled>
              <option>MXN - Peso Mexicano</option>
              <option>USD - Dólar Americano</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>Zona horaria</label>
            <select className="login-input" style={{ maxWidth: '300px' }} disabled>
              <option>America/Mexico_City (GMT-6)</option>
            </select>
          </div>
        </div>

        <p style={{ color: '#888', marginTop: '2rem', fontSize: '0.875rem' }}>
          Más opciones de configuración estarán disponibles próximamente.
        </p>
      </div>
    </div>
  )
}
