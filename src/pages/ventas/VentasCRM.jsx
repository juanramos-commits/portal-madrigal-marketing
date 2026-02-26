import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function VentasCRM() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('setters')

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>CRM de Ventas</h1>
        <p className="page-subtitle">Gestión de leads, setters y closers</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setTab('setters')}
          className="btn"
          style={{
            background: tab === 'setters' ? '#6c5ce7' : '#f0f0f0',
            color: tab === 'setters' ? '#fff' : '#333',
            border: 'none',
            padding: '0.5rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Setters
        </button>
        <button
          onClick={() => setTab('closers')}
          className="btn"
          style={{
            background: tab === 'closers' ? '#6c5ce7' : '#f0f0f0',
            color: tab === 'closers' ? '#fff' : '#333',
            border: 'none',
            padding: '0.5rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Closers
        </button>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        {tab === 'setters' ? (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Pipeline Setters</h3>
            <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>
              No hay leads en el pipeline de setters.
            </p>
          </div>
        ) : (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Pipeline Closers</h3>
            <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>
              No hay leads en el pipeline de closers.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
