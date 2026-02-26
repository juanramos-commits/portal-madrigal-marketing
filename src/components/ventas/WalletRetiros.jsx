function formatMoneda(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

function formatFecha(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const estadoConfig = {
  pendiente: { label: 'Pendiente', className: 'wt-badge-pendiente' },
  aprobado: { label: 'Aprobado', className: 'wt-badge-aprobado' },
  rechazado: { label: 'Rechazado', className: 'wt-badge-rechazado' },
}

export default function WalletRetiros({ retiros, loading }) {
  if (loading && retiros.length === 0) {
    return <div className="wt-loading">Cargando retiros...</div>
  }

  if (retiros.length === 0) {
    return <div className="wt-empty">No hay retiros registrados</div>
  }

  return (
    <div className="wt-retiros">
      {/* Desktop table */}
      <div className="wt-desktop-only">
        <div className="wt-table-wrap">
          <table className="wt-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Factura</th>
                <th>Motivo rechazo</th>
              </tr>
            </thead>
            <tbody>
              {retiros.map(r => {
                const estado = estadoConfig[r.estado] || estadoConfig.pendiente
                return (
                  <tr key={r.id}>
                    <td>{formatFecha(r.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoneda(r.monto)}</td>
                    <td><span className={`wt-badge ${estado.className}`}>{estado.label}</span></td>
                    <td>{r.factura?.numero_factura || '-'}</td>
                    <td>{r.motivo_rechazo || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="wt-mobile-only">
        {retiros.map(r => {
          const estado = estadoConfig[r.estado] || estadoConfig.pendiente
          return (
            <div key={r.id} className="wt-retiro-card">
              <div className="wt-retiro-top">
                <span className={`wt-badge ${estado.className}`}>{estado.label}</span>
                <span style={{ fontWeight: 700 }}>{formatMoneda(r.monto)}</span>
              </div>
              <div className="wt-retiro-meta">
                <span>{formatFecha(r.created_at)}</span>
                {r.factura?.numero_factura && <span>Factura: {r.factura.numero_factura}</span>}
              </div>
              {r.motivo_rechazo && (
                <div className="wt-retiro-motivo">Motivo: {r.motivo_rechazo}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
