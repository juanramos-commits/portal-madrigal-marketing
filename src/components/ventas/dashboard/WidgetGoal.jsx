export default function WidgetGoal({ widgetDef, data, config }) {
  const objetivo = config?.objetivo || widgetDef?.defaultConfig?.objetivo || 10
  const actual = Number(data?.actual) || 0
  const diasRestantes = Number(data?.dias_restantes) || 0
  const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0

  const colorClass = pct >= 66 ? 'db-wgoal--green' : pct >= 33 ? 'db-wgoal--yellow' : 'db-wgoal--red'

  // SVG ring
  const size = 100
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className={`db-wgoal ${colorClass}`}>
      <div className="db-wgoal-ring">
        <svg width={size} height={size}>
          <circle
            className="db-wgoal-ring-bg"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
          />
          <circle
            className="db-wgoal-ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="db-wgoal-center">
          <span className="db-wgoal-pct">{Math.round(pct)}%</span>
        </div>
      </div>
      <span className="db-wgoal-fraction">{actual} / {objetivo}</span>
      <span className="db-wgoal-remaining">{diasRestantes} dias restantes</span>
    </div>
  )
}
