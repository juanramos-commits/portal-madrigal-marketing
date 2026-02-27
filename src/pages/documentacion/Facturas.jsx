import { useState } from 'react'

export default function Facturas() {
  const [facturas] = useState([])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Facturas</h1>
        <p className="page-subtitle">Gestión de facturas y documentos fiscales</p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        {facturas.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>No hay facturas registradas.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Folio</th>
                <th style={{ padding: '0.75rem' }}>Cliente</th>
                <th style={{ padding: '0.75rem' }}>Importe</th>
                <th style={{ padding: '0.75rem' }}>Fecha</th>
                <th style={{ padding: '0.75rem' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{f.folio}</td>
                  <td style={{ padding: '0.75rem' }}>{f.cliente}</td>
                  <td style={{ padding: '0.75rem' }}>{f.monto}</td>
                  <td style={{ padding: '0.75rem' }}>{f.fecha}</td>
                  <td style={{ padding: '0.75rem' }}>{f.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
