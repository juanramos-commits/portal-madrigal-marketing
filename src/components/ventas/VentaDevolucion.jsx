import { useState } from 'react'
import Modal from '../ui/Modal'

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
    <Modal
      open={true}
      onClose={onCancel}
      title="Marcar devolución"
      size="sm"
      footer={
        <>
          <button className="vv-btn-ghost" onClick={onCancel} disabled={submitting}>Cancelar</button>
          <button className="vv-btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Procesando...' : 'Confirmar devolución'}
          </button>
        </>
      }
    >
      <p>
        ¿Marcar como devolución la venta de <strong>{venta.lead?.nombre || 'Lead'}</strong> por <strong>{importe}€</strong>?
      </p>
      <p className="vv-modal-warning">
        Se descontarán las comisiones y el lead se moverá a la etapa «Devolución» en ambos pipelines.
      </p>
      {error && <div className="vv-error-general">{error}</div>}
    </Modal>
  )
}
