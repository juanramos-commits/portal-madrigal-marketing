export default function CohortTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="ve-empty"><p>Sin datos de cohorte</p></div>
  }

  const maxWeeks = Math.max(...data.map(r => r.weeks?.length || 0))
  const weekHeaders = Array.from({ length: maxWeeks }, (_, i) => `Sem ${i}`)

  return (
    <div className="ve-cohort">
      <table>
        <thead>
          <tr>
            <th className="ve-cohort-header" style={{ textAlign: 'left' }}>Cohorte</th>
            <th className="ve-cohort-header">Usuarios</th>
            {weekHeaders.map((h, i) => (
              <th key={i} className="ve-cohort-header">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => {
            const firstWeek = row.weeks?.[0]
            const totalUsers = firstWeek?.total_count || 0

            return (
              <tr key={rowIdx}>
                <td className="ve-cohort-cell" style={{ fontWeight: 600 }}>
                  {row.cohort_week}
                </td>
                <td className="ve-cohort-cell">
                  {totalUsers.toLocaleString('es-ES')}
                </td>
                {weekHeaders.map((_, weekIdx) => {
                  const weekData = row.weeks?.[weekIdx]
                  if (!weekData) {
                    return <td key={weekIdx} className="ve-cohort-cell">—</td>
                  }

                  const rate = weekData.total_count > 0
                    ? (weekData.active_count / weekData.total_count) * 100
                    : 0
                  const opacity = Math.max(rate / 100, 0.05)

                  return (
                    <td
                      key={weekIdx}
                      className="ve-cohort-cell"
                      style={{
                        background: `rgba(46, 229, 157, ${opacity})`,
                        color: rate > 50 ? '#000' : undefined,
                      }}
                      title={`${weekData.active_count}/${weekData.total_count} (${rate.toFixed(1)}%)`}
                    >
                      {rate.toFixed(0)}%
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
