import { useState } from 'react'
import Modal from '../ui/Modal'

export function ModalAprobar({ venta, onConfirm, onCancel }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(venta.id)
    } catch (err) {
      setError(err.message || 'Error al aprobar la venta')
      setSubmitting(false)
    }
  }

  const importe = Number(venta.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title="Aprobar venta"
      size="sm"
      footer={
        <>
          <button className="vv-btn-ghost" onClick={onCancel} disabled={submitting}>Cancelar</button>
          <button className="vv-btn-success" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Aprobando...' : 'Aprobar'}
          </button>
        </>
      }
    >
      <p>
        ¿Aprobar la venta de <strong>{venta.lead?.nombre || 'Lead'}</strong> por <strong>{importe}€</strong>?
      </p>
      <p className="vv-modal-hint">Se generarán las comisiones correspondientes.</p>
      {error && <div className="vv-error-general">{error}</div>}
    </Modal>
  )
}

export function ModalRechazar({ venta, onConfirm, onCancel, esReversion }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(venta.id)
    } catch (err) {
      setError(err.message || 'Error al rechazar la venta')
      setSubmitting(false)
    }
  }

  const importe = Number(venta.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={esReversion ? 'Revertir aprobación' : 'Rechazar venta'}
      size="sm"
      footer={
        <>
          <button className="vv-btn-ghost" onClick={onCancel} disabled={submitting}>Cancelar</button>
          <button className="vv-btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Rechazando...' : 'Rechazar'}
          </button>
        </>
      }
    >
      {esReversion ? (
        <>
          <p>
            ¿Rechazar la venta aprobada de <strong>{venta.lead?.nombre || 'Lead'}</strong> por <strong>{importe}€</strong>?
          </p>
          <p className="vv-modal-warning">
            Las comisiones ya generadas se descontarán de los wallets. Los saldos pueden quedar en negativo.
          </p>
        </>
      ) : (
        <p>
          ¿Rechazar la venta de <strong>{venta.lead?.nombre || 'Lead'}</strong> por <strong>{importe}€</strong>?
        </p>
      )}
      {error && <div className="vv-error-general">{error}</div>}
    </Modal>
  )
}
