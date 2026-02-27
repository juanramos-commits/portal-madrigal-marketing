function formatCurrency(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function MedalIcon({ pos }) {
  if (pos === 0) return <span className="db-rank-medal db-rank-gold">1</span>
  if (pos === 1) return <span className="db-rank-medal db-rank-silver">2</span>
  if (pos === 2) return <span className="db-rank-medal db-rank-bronze">3</span>
  return <span className="db-rank-pos">{pos + 1}</span>
}

function RankingSkeleton() {
  return (
    <div className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title-sk" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="db-rank-item-sk" />
      ))}
    </div>
  )
}

function SetterRanking({ setters, loading }) {
  if (loading) return <RankingSkeleton />

  const maxCitas = setters.length > 0 ? Math.max(...setters.map(s => Number(s.citas))) : 1

  return (
    <div className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Ranking Setters</h3>
      </div>
      {setters.length === 0 ? (
        <div className="db-empty">Sin datos de setters</div>
      ) : (
        <div className="db-ranking">
          {setters.map((s, i) => {
            const tasa = Number(s.leads_asignados) > 0
              ? ((Number(s.citas) / Number(s.leads_asignados)) * 100).toFixed(1)
              : '0.0'
            const barPct = (Number(s.citas) / maxCitas) * 100
            return (
              <div key={s.usuario_id} className="db-rank-item" style={{ animationDelay: `${i * 80}ms` }}>
                <MedalIcon pos={i} />
                <div className="db-rank-info">
                  <div className="db-rank-top">
                    <span className="db-rank-name">{s.nombre || s.email}</span>
                    <span className="db-rank-stats">{Number(s.citas)} citas &middot; {tasa}%</span>
                  </div>
                  <div className="db-rank-bar-bg">
                    <div className="db-rank-bar" style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CloserRanking({ closers, loading }) {
  if (loading) return <RankingSkeleton />

  const maxFact = closers.length > 0 ? Math.max(...closers.map(c => Number(c.facturacion)), 1) : 1

  return (
    <div className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Ranking Closers</h3>
      </div>
      {closers.length === 0 ? (
        <div className="db-empty">Sin datos de closers</div>
      ) : (
        <div className="db-ranking">
          {closers.map((c, i) => {
            const tasa = Number(c.citas_recibidas) > 0
              ? ((Number(c.ventas) / Number(c.citas_recibidas)) * 100).toFixed(1)
              : '0.0'
            const barPct = (Number(c.facturacion) / maxFact) * 100
            return (
              <div key={c.usuario_id} className="db-rank-item" style={{ animationDelay: `${i * 80}ms` }}>
                <MedalIcon pos={i} />
                <div className="db-rank-info">
                  <div className="db-rank-top">
                    <span className="db-rank-name">{c.nombre || c.email}</span>
                    <span className="db-rank-stats">
                      {Number(c.ventas)} ventas &middot; {formatCurrency(Number(c.facturacion))} &middot; {tasa}%
                    </span>
                  </div>
                  <div className="db-rank-bar-bg">
                    <div className="db-rank-bar db-rank-bar-closer" style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DashboardRankingEquipo({ setters, closers, loading }) {
  return (
    <div className="db-ranking-grid">
      <SetterRanking setters={setters} loading={loading} />
      <CloserRanking closers={closers} loading={loading} />
    </div>
  )
}
