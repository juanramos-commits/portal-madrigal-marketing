import { useState } from 'react'

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)

export default function VentaDevolucion({ venta, onConfirm, onCancel }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(venta.id)
    } catch (err) {
      setError(err.message || 'Error al marcar la devolución')
      setSubmitting(false)
    }
  }

  const importe = Number(venta.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })

  return (
    <>
      <div className="vv-modal-overlay" onClick={onCancel} />
      <div className="vv-modal vv-modal-confirm">
        <div className="vv-modal-header">
          <h2>Marcar devolución</h2>
          <button className="vv-modal-close" onClick={onCancel}><CloseIcon /></button>
        </div>
        <div className="vv-modal-body">
          <p>
            ¿Marcar como devolución la venta de <strong>{venta.lead?.nombre || 'Lead'}</strong> por <strong>{importe}€</strong>?
          </p>
          <p className="vv-modal-warning">
            Se descontarán las comisiones y el lead se moverá a la etapa «Devolución» en ambos pipelines.
          </p>
          {error && <div className="vv-error-general">{error}</div>}
        </div>
        <div className="vv-modal-actions">
          <button className="vv-btn-ghost" onClick={onCancel} disabled={submitting}>Cancelar</button>
          <button className="vv-btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Procesando...' : 'Confirmar devolución'}
          </button>
        </div>
      </div>
    </>
  )
}
