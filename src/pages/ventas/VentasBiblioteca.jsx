import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function VentasBiblioteca() {
  const { usuario } = useAuth()
  const [recursos] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Biblioteca de Ventas</h1>
        <p className="page-subtitle">Recursos, scripts y materiales del equipo de ventas</p>
      </div>

      {recursos.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: '1.1rem' }}>No hay recursos en la biblioteca todavía.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Aquí podrás subir scripts, presentaciones y materiales de apoyo.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {recursos.map((r, i) => (
            <div key={i} className="card" style={{ padding: '1.5rem' }}>
              <h3>{r.titulo}</h3>
              <p style={{ color: '#888' }}>{r.descripcion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
