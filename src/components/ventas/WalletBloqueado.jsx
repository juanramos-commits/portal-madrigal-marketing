import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Calendar } from 'lucide-react'

function formatFechaCita(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function WalletBloqueado({ citasPendientes = [] }) {
  const navigate = useNavigate()

  return (
    <div className="wt-bloqueado" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div className="wt-bloqueado-text">
        <strong>No puedes solicitar retiros</strong>
        <p>
          Tienes {citasPendientes.length || 'varias'} reunión{citasPendientes.length !== 1 ? 'es' : ''} pasada{citasPendientes.length !== 1 ? 's' : ''} sin calificar.
          Marca el resultado (Realizada / No Show) para poder retirar.
        </p>
        {citasPendientes.length > 0 && (
          <div className="wt-bloqueado-citas">
            {citasPendientes.map(c => (
              <div key={c.id} className="wt-bloqueado-cita" onClick={() => navigate(`/ventas/crm/lead/${c.lead?.id}`)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/ventas/crm/lead/${c.lead?.id}`)}>
                <Calendar size={14} />
                <span className="wt-bloqueado-cita-nombre">{c.lead?.nombre || 'Lead'}</span>
                <span className="wt-bloqueado-cita-fecha">{formatFechaCita(c.fecha_hora)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="wt-btn-ghost" onClick={() => navigate('/ventas/calendario')}>
        Ir al calendario
      </button>
    </div>
  )
}
