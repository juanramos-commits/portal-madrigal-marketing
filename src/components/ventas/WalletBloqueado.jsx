import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

export default function WalletBloqueado() {
  const navigate = useNavigate()

  return (
    <div className="wt-bloqueado" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div className="wt-bloqueado-text">
        <strong>No puedes solicitar retiros</strong>
        <p>Debes marcar el estado de todas tus reuniones pasadas antes de solicitar un retiro.</p>
      </div>
      <button className="wt-btn-ghost" onClick={() => navigate('/ventas/crm')}>
        Ir al CRM
      </button>
    </div>
  )
}
