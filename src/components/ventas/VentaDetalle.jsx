import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const DashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatImporte(v) {
  return Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + '€'
}

const metodoLabels = { stripe: 'Stripe', sequra: 'SeQura', transferencia: 'Transferencia' }

export default function VentaDetalle({ venta, comisiones, loadingComisiones, onLoadComisiones }) {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!loaded && onLoadComisiones) {
      onLoadComisiones(venta.id)
      setLoaded(true)
    }
  }, [venta.id, loaded, onLoadComisiones])

  return (
    <div className="vv-detalle">
      <div className="vv-detalle-grid">
        {/* Left column — Sale data */}
        <div className="vv-detalle-section">
          <h4>Datos de la venta</h4>
          <div className="vv-detalle-rows">
            <div className="vv-detalle-row">
              <span>Lead</span>
              <span>
                {venta.lead?.nombre || '-'}
                {venta.lead_id && (
                  <button
                    className="vv-detalle-link"
                    onClick={(e) => { e.stopPropagation(); navigate(`/ventas/crm/lead/${venta.lead_id}`) }}
                  >
                    <LinkIcon /> Ver en CRM
                  </button>
                )}
              </span>
            </div>
            <div className="vv-detalle-row">
              <span>Paquete</span>
              <span>{venta.paquete?.nombre || '-'}</span>
            </div>
            <div className="vv-detalle-row">
              <span>Importe</span>
              <span className="vv-detalle-importe">{formatImporte(venta.importe)}</span>
            </div>
            <div className="vv-detalle-row">
              <span>Método de pago</span>
              <span>{metodoLabels[venta.metodo_pago] || venta.metodo_pago || '-'}</span>
            </div>
            <div className="vv-detalle-row">
              <span>Pago único</span>
              <span>{venta.es_pago_unico ? <CheckIcon /> : <DashIcon />}</span>
            </div>
            <div className="vv-detalle-row">
              <span>Fecha venta</span>
              <span>{formatDate(venta.fecha_venta)}</span>
            </div>
            <div className="vv-detalle-row">
              <span>Setter</span>
              <span>{venta.setter?.nombre || venta.setter?.email || '-'}</span>
            </div>
            <div className="vv-detalle-row">
              <span>Closer</span>
              <span>{venta.closer?.nombre || venta.closer?.email || '-'}</span>
            </div>
            {venta.fecha_aprobacion && (
              <div className="vv-detalle-row">
                <span>Aprobada el</span>
                <span>{formatDateTime(venta.fecha_aprobacion)}</span>
              </div>
            )}
            {venta.fecha_rechazo && (
              <div className="vv-detalle-row">
                <span>Rechazada el</span>
                <span>{formatDateTime(venta.fecha_rechazo)}</span>
              </div>
            )}
            {venta.es_devolucion && (
              <div className="vv-detalle-row">
                <span>Devolución el</span>
                <span>{formatDateTime(venta.fecha_devolucion)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Commissions */}
        {(venta.estado === 'aprobada' || venta.es_devolucion) && (
          <div className="vv-detalle-section">
            <h4>Comisiones</h4>
            {loadingComisiones ? (
              <div className="vv-detalle-loading">Cargando comisiones...</div>
            ) : comisiones && comisiones.length > 0 ? (
              <table className="vv-comisiones-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Monto</th>
                    <th>Tipo</th>
                    <th>Disponible desde</th>
                  </tr>
                </thead>
                <tbody>
                  {comisiones.map(c => (
                    <tr key={c.id} className={c.monto < 0 ? 'vv-comision-negativa' : ''}>
                      <td>{c.usuario?.nombre || c.usuario?.email || '-'}</td>
                      <td>{c.rol}</td>
                      <td className={c.monto < 0 ? 'vv-text-danger' : 'vv-text-success'}>
                        {c.monto >= 0 ? '+' : ''}{formatImporte(c.monto)}
                      </td>
                      <td>{c.es_bonus ? 'Bonus' : 'Fija'}</td>
                      <td>{formatDateTime(c.disponible_desde)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="vv-detalle-empty">Sin comisiones registradas</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
