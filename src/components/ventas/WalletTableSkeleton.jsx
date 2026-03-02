export default function WalletTableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="wt-skeleton-table">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="wt-skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="wt-skeleton-cell">
              <div className="wt-skeleton-bar" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
