import { useMemo } from 'react'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function OpenHeatmap({ data }) {
  const { grid, maxCount, hasDay } = useMemo(() => {
    if (!data || data.length === 0) {
      return { grid: {}, maxCount: 0, hasDay: false }
    }

    const hasDay = data.some(d => d.day !== undefined && d.day !== null)
    const grid = {}
    let maxCount = 0

    if (hasDay) {
      for (const entry of data) {
        const key = `${entry.day}-${entry.hour}`
        grid[key] = (grid[key] || 0) + entry.count
        if (grid[key] > maxCount) maxCount = grid[key]
      }
    } else {
      for (const entry of data) {
        const key = `0-${entry.hour}`
        grid[key] = (grid[key] || 0) + entry.count
        if (grid[key] > maxCount) maxCount = grid[key]
      }
    }

    return { grid, maxCount, hasDay }
  }, [data])

  if (!data || data.length === 0) {
    return <div className="ve-empty"><p>Sin datos de apertura</p></div>
  }

  const rows = hasDay ? DAYS.length : 1

  return (
    <div className="ve-heatmap" style={{
      gridTemplateRows: `auto repeat(${rows}, 1fr)`,
    }}>
      {/* Header row: empty corner + hour labels */}
      <div className="ve-heatmap-label" />
      {HOURS.map(h => (
        <div key={`h-${h}`} className="ve-heatmap-label ve-heatmap-label--hour">
          {h}
        </div>
      ))}

      {/* Data rows */}
      {(hasDay ? DAYS : ['']).map((dayLabel, dayIdx) => (
        <>
          <div key={`day-${dayIdx}`} className="ve-heatmap-label">
            {dayLabel}
          </div>
          {HOURS.map(h => {
            const key = `${dayIdx}-${h}`
            const count = grid[key] || 0
            const opacity = maxCount > 0 ? Math.max(count / maxCount, 0.05) : 0.05

            return (
              <div
                key={`cell-${dayIdx}-${h}`}
                className="ve-heatmap-cell"
                style={{ opacity }}
                title={`${dayLabel ? dayLabel + ' ' : ''}${h}:00 — ${count.toLocaleString('es-ES')} aperturas`}
              />
            )
          })}
        </>
      ))}
    </div>
  )
}
