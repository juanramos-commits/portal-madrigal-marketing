import WalletBloqueado from './WalletBloqueado'

function formatMoneda(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

const WalletIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
  </svg>
)

const TrendUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)

const ArrowDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>
)

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
          <div className="wt-card-icon"><WalletIcon /></div>
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
          <div className="wt-card-icon wt-icon-success"><TrendUpIcon /></div>
          <span className="wt-card-label">Total ganado</span>
          <span className="wt-card-value">{formatMoneda(totalGanado)}</span>
        </div>

        {/* Total retirado */}
        <div className="wt-card">
          <div className="wt-card-icon wt-icon-muted"><ArrowDownIcon /></div>
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
