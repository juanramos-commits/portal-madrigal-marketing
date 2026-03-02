import { Wallet, TrendingUp, ArrowDown } from 'lucide-react'
import WalletBloqueado from './WalletBloqueado'
import { formatMoneda } from '../../utils/formatters'

export default function WalletResumen({ wallet, saldoDisponible, esCloser, closerAlDia, onSolicitarRetiro }) {
  const saldo = wallet?.saldo || 0
  const totalGanado = wallet?.total_ganado || 0
  const totalRetirado = wallet?.total_retirado || 0
  const saldoNegativo = saldo < 0
  const disponibleDiferente = Math.abs(saldoDisponible - saldo) > 0.01

  const puedeRetirar = saldoDisponible > 0 && (!esCloser || closerAlDia)

  return (
    <div className="wt-resumen">
      <div className="wt-cards-grid">
        {/* Saldo actual */}
        <div className={`wt-card ${saldoNegativo ? 'wt-card-negative' : ''}`}>
          <div className="wt-card-icon"><Wallet size={20} /></div>
          <span className="wt-card-label">Saldo actual</span>
          <span className={`wt-card-value ${saldoNegativo ? 'wt-text-danger' : ''}`}>
            {formatMoneda(saldo)}
          </span>
          {puedeRetirar && (
            <button className="wt-btn-retiro" onClick={onSolicitarRetiro}>
              Solicitar retiro
            </button>
          )}
        </div>

        {/* Total ganado */}
        <div className="wt-card">
          <div className="wt-card-icon wt-icon-success"><TrendingUp size={20} /></div>
          <span className="wt-card-label">Total ganado</span>
          <span className="wt-card-value">{formatMoneda(totalGanado)}</span>
        </div>

        {/* Total retirado */}
        <div className="wt-card">
          <div className="wt-card-icon wt-icon-muted"><ArrowDown size={20} /></div>
          <span className="wt-card-label">Total retirado</span>
          <span className="wt-card-value">{formatMoneda(totalRetirado)}</span>
        </div>
      </div>

      {/* Saldo disponible info */}
      <div className="wt-saldo-info">
        <span>Saldo disponible para retiro: <strong>{formatMoneda(saldoDisponible)}</strong></span>
        {disponibleDiferente && saldoDisponible < saldo && (
          <span className="wt-saldo-note">
            Algunas comisiones aún no están disponibles (periodo de 48h)
          </span>
        )}
      </div>

      {/* Bloqueo closer */}
      {esCloser && !closerAlDia && <WalletBloqueado />}
    </div>
  )
}
