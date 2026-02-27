import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({
  open, onConfirm, onCancel, title = 'Confirmar',
  message, confirmText = 'Confirmar', cancelText = 'Cancelar',
  variant = 'default', loading = false,
}) {
  const btnVariant = variant === 'danger' ? 'danger' : variant === 'warning' ? 'danger' : 'primary'

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelText}</Button>
          <Button variant={btnVariant} onClick={onConfirm} loading={loading}>{confirmText}</Button>
        </>
      }
    >
      {message && <p className="ui-confirm-message">{message}</p>}
    </Modal>
  )
}
