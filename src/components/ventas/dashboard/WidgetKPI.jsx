import { useEffect, useRef } from 'react'
import { formatCurrency, formatPercent } from '../../../config/formatters'

export default function WidgetKPI({ widgetDef, data }) {
  const numRef = useRef(null)
  const rafRef = useRef(null)

  const valor = Number(data?.valor) || 0
  const anterior = data?.anterior != null ? Number(data.anterior) : null
  const formato = widgetDef?.formato || 'number'

  useEffect(() => {
    const el = numRef.current
    if (!el) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const numEnd = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^0-9.-]/g, '')) || 0
    const startTime = performance.now()
    let cancelled = false

    const step = (now) => {
      if (cancelled) return
      const progress = Math.min((now - startTime) / 600, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = numEnd * eased
      if (formato === 'currency') {
        el.textContent = formatCurrency(current)
      } else if (formato === 'percent') {
        el.textContent = formatPercent(current)
      } else {
        el.textContent = Math.round(current).toLocaleString('es-ES')
      }
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      cancelled = true
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [valor, formato])

  const rawDiff = anterior != null ? valor - anterior : null
  const diff = rawDiff != null && !Number.isNaN(rawDiff) ? rawDiff : null
  const diffType = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'
  let diffText = null
  if (diff != null) {
    if (formato === 'currency') {
      diffText = (diff > 0 ? '+' : '') + formatCurrency(diff)
    } else if (formato === 'percent') {
      diffText = (diff > 0 ? '+' : '') + formatPercent(diff)
    } else {
      diffText = (diff > 0 ? '+' : '') + diff
    }
  }

  return (
    <div className="db-wkpi">
      <span className="db-wkpi-value" ref={numRef} aria-live="polite" aria-atomic="true">0</span>
      {diffText != null && (
        <span className={`db-wkpi-diff db-wkpi-diff-${diffType}`}>
          {diffType === 'up' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-wkpi-arrow" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>}
          {diffType === 'down' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-wkpi-arrow" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>}
          {diffText} vs anterior
        </span>
      )}
    </div>
  )
}
