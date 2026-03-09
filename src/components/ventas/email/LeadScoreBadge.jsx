import { useState } from 'react'

export default function LeadScoreBadge({ score, factors }) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (score === null || score === undefined) return null

  const num = Number(score)
  let className = 've-badge ve-badge--score '
  let label

  if (num > 70) {
    className += 've-score-high'
    label = 'Alto'
  } else if (num > 40) {
    className += 've-score-mid'
    label = 'Medio'
  } else {
    className += 've-score-low'
    label = 'Bajo'
  }

  return (
    <span
      className={className}
      style={{ position: 'relative', cursor: factors ? 'help' : 'default' }}
      onMouseEnter={() => factors && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {num} · {label}

      {showTooltip && factors && factors.length > 0 && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
          background: 'var(--bg-tooltip)',
          color: '#fff',
          padding: 'var(--space-sm) var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--font-xs)',
          whiteSpace: 'nowrap',
          zIndex: 'var(--z-dropdown)',
          boxShadow: 'var(--shadow-dropdown)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2xs)',
        }}>
          {factors.map((f, i) => (
            <span key={i}>
              {f.label || f.factor}: <strong>{f.points > 0 ? '+' : ''}{f.points}</strong>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
