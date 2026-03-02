import { useState } from 'react'
import Modal from '../ui/Modal'

const transicionConfig = {
  'pendiente->aprobada': {
    titulo: 'Aprobar venta',
    mensaje: (v) => `¿Aprobar la venta de ${v.lead?.nombre || 'Lead'} por ${fmt(v.importe)}?`,
    hint: 'Se generarán las comisiones correspondientes.',
    label: 'Aprobar',
    btnClass: 'vv-btn-success',
    labelLoading: 'Aprobando...',
  },
  'pendiente->rechazada': {
    titulo: 'Rechazar venta',
    mensaje: (v) => `¿Rechazar la venta de ${v.lead?.nombre || 'Lead'} por ${fmt(v.importe)}?`,
    hint: null,
    label: 'Rechazar',
    btnClass: 'vv-btn-danger',
    labelLoading: 'Rechazando...',
  },
  'aprobada->rechazada': {
    titulo: 'Revertir aprobación',
    mensaje: (v) => `¿Rechazar la venta aprobada de ${v.lead?.nombre || 'Lead'} por ${fmt(v.importe)}?`,
    hint: 'Las comisiones ya generadas se descontarán de los wallets. Los saldos pueden quedar en negativo.',
    warning: true,
    label: 'Rechazar',
    btnClass: 'vv-btn-danger',
    labelLoading: 'Rechazando...',
  },
  'aprobada->devolucion': {
    titulo: 'Marcar devolución',
    mensaje: (v) => `¿Marcar devolución en la venta de ${v.lead?.nombre || 'Lead'} por ${fmt(v.importe)}?`,
    hint: 'Se marcarán las comisiones como devolución.',
    warning: true,
    label: 'Marcar devolución',
    btnClass: 'vv-btn-devolucion',
    labelLoading: 'Procesando...',
  },
  'rechazada->pendiente': {
    titulo: 'Revertir rechazo',
    mensaje: (v) => `¿Revertir el rechazo de la venta de ${v.lead?.nombre || 'Lead'} por ${fmt(v.importe)}?`,
    hint: 'La venta volverá a estado pendiente de revisión.',
    label: 'Revertir a pendiente',
    btnClass: 'vv-btn-warning',
    labelLoading: 'Revirtiendo...',
  },
  'devolucion->aprobada': {
    titulo: 'Revertir devolución',
    mensaje: (v) => `¿Revertir la devolución de la venta de ${v.lead?.nombre || 'Lead'} por ${fmt(v.importe)}?`,
    hint: 'La venta volverá a estado aprobada. Las comisiones se restaurarán automáticamente.',
    warning: true,
    label: 'Restaurar a aprobada',
    btnClass: 'vv-btn-success',
    labelLoading: 'Restaurando...',
  },
}

function fmt(v) {
  return Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + '€'
}

export default function ModalCambioEstado({ venta, nuevoEstado, onConfirm, onCancel }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const estadoActual = venta.es_devolucion ? 'devolucion' : venta.estado
  const key = `${estadoActual}->${nuevoEstado}`
  const config = transicionConfig[key]

  if (!config) return null

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message || 'Error al cambiar el estado')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={config.titulo}
      size="sm"
      footer={
        <>
          <button className="vv-btn-ghost" onClick={onCancel} disabled={submitting}>Cancelar</button>
          <button className={config.btnClass} onClick={handleConfirm} disabled={submitting}>
            {submitting ? config.labelLoading : config.label}
          </button>
        </>
      }
    >
      <p dangerouslySetInnerHTML={{ __html: config.mensaje(venta).replace(
        /\*\*(.*?)\*\*/g, '<strong>$1</strong>'
      ) }} />
      {config.hint && (
        <p className={config.warning ? 'vv-modal-warning' : 'vv-modal-hint'}>
          {config.hint}
        </p>
      )}
      {error && <div className="vv-error-general">{error}</div>}
    </Modal>
  )
}
