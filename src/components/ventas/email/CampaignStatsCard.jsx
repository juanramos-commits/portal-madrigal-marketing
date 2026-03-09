function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('es-ES')
}

function pct(a, b) {
  if (!b || b === 0) return '—'
  return ((a / b) * 100).toFixed(1) + '%'
}

const METRICS = [
  { key: 'sent', label: 'Enviados' },
  { key: 'delivered', label: 'Entregados' },
  { key: 'opened', label: 'Abiertos' },
  { key: 'clicked', label: 'Clics' },
  { key: 'bounced', label: 'Rebotados' },
]

export default function CampaignStatsCard({ campaign }) {
  if (!campaign) return null

  const stats = campaign.stats || campaign
  const sent = stats.sent || 0

  return (
    <div className="ve-card">
      <div className="ve-card-header">
        <h3>{campaign.name || 'Campaña'}</h3>
        {campaign.status && (
          <span className={`ve-badge ve-badge--${campaign.status === 'sent' ? 'success' : campaign.status === 'draft' ? 'info' : 'warning'}`}>
            {campaign.status}
          </span>
        )}
      </div>

      <div className="ve-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--space-sm)' }}>
        {METRICS.map(m => {
          const val = stats[m.key] || 0
          const isBounce = m.key === 'bounced'
          return (
            <div key={m.key} className="ve-stat-card" style={{ padding: 'var(--space-3)' }}>
              <span className="ve-stat-value" style={{ fontSize: 'var(--font-xl)' }}>
                {fmt(val)}
              </span>
              <span className="ve-stat-label" style={{ fontSize: 'var(--font-2xs)' }}>
                {m.label}
              </span>
              {sent > 0 && (
                <span style={{
                  fontSize: 'var(--font-xs)',
                  color: isBounce && val > 0 ? 'var(--error)' : 'var(--text-tertiary)',
                }}>
                  {pct(val, sent)}
                </span>
              )}
            </div>
          )
        })}

        {/* Conversion rate */}
        <div className="ve-stat-card" style={{ padding: 'var(--space-3)' }}>
          <span className="ve-stat-value" style={{ fontSize: 'var(--font-xl)', color: 'var(--success)' }}>
            {stats.conversion_rate !== undefined ? stats.conversion_rate + '%' : pct(stats.converted || 0, sent)}
          </span>
          <span className="ve-stat-label" style={{ fontSize: 'var(--font-2xs)' }}>
            Conversión
          </span>
        </div>
      </div>
    </div>
  )
}
