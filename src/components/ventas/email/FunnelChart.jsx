const STEPS = [
  { key: 'sent', label: 'Enviados', color: '#6495ed' },
  { key: 'delivered', label: 'Entregados', color: '#38bdf8' },
  { key: 'opened', label: 'Abiertos', color: '#a78bfa' },
  { key: 'clicked', label: 'Clics', color: '#2ee59d' },
  { key: 'converted', label: 'Convertidos', color: '#ffa94d' },
]

export default function FunnelChart({ data }) {
  if (!data) return null

  const maxVal = Math.max(...STEPS.map(s => data[s.key] || 0), 1)

  return (
    <div className="ve-funnel">
      {STEPS.map((step, idx) => {
        const val = data[step.key] || 0
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
        const prevVal = idx > 0 ? (data[STEPS[idx - 1].key] || 0) : null
        const stepPct = prevVal > 0 ? ((val / prevVal) * 100).toFixed(1) : null

        return (
          <div key={step.key}>
            {idx > 0 && stepPct !== null && (
              <div className="ve-funnel-percent">
                ↓ {stepPct}% {step.label.toLowerCase()}
              </div>
            )}
            <div className="ve-funnel-step">
              <span className="ve-funnel-step-label">{step.label}</span>
              <div
                className="ve-funnel-bar"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: step.color,
                  opacity: 0.85,
                }}
              />
              <span className="ve-funnel-value">
                {val.toLocaleString('es-ES')}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
