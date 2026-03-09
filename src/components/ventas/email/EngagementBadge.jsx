export default function EngagementBadge({ score }) {
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
    <span className={className} title={`Engagement: ${num}`}>
      {num} · {label}
    </span>
  )
}
