import { useNavigate } from 'react-router-dom'

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

export default function WalletBloqueado() {
  const navigate = useNavigate()

  return (
    <div className="wt-bloqueado">
      <AlertIcon />
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
