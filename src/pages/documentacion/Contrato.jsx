import { useState } from 'react'

export default function Contrato() {
  const [contratos] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Contratos</h1>
        <p className="page-subtitle">Gestión de contratos con clientes</p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        {contratos.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>No hay contratos registrados.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Cliente</th>
                <th style={{ padding: '0.75rem' }}>Tipo</th>
                <th style={{ padding: '0.75rem' }}>Inicio</th>
                <th style={{ padding: '0.75rem' }}>Fin</th>
                <th style={{ padding: '0.75rem' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{c.cliente}</td>
                  <td style={{ padding: '0.75rem' }}>{c.tipo}</td>
                  <td style={{ padding: '0.75rem' }}>{c.inicio}</td>
                  <td style={{ padding: '0.75rem' }}>{c.fin}</td>
                  <td style={{ padding: '0.75rem' }}>{c.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
