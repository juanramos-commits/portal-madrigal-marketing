import { useEffect, useRef } from 'react'

const currencyFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
function formatCurrency(v) {
  return currencyFmt.format(v)
}

function formatPercent(v) {
  return `${Number(v).toFixed(1)}%`
}

function animateValue(el, end, formato, duration) {
  if (!el) return
  const numEnd = typeof end === 'number' ? end : parseFloat(String(end).replace(/[^0-9.-]/g, '')) || 0
  const startTime = performance.now()
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = numEnd * eased
    if (formato === 'currency') {
      el.textContent = formatCurrency(current)
    } else if (formato === 'percent') {
      el.textContent = formatPercent(current)
    } else {
      el.textContent = Math.round(current).toLocaleString('es-ES')
    }
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export default function WidgetKPI({ widgetDef, data }) {
  const numRef = useRef(null)

  const valor = Number(data?.valor) || 0
  const anterior = data?.anterior != null ? Number(data.anterior) : null
  const formato = widgetDef?.formato || 'number'

  useEffect(() => {
    if (numRef.current) animateValue(numRef.current, valor, formato, 600)
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
      <span className="db-wkpi-value" ref={numRef}>0</span>
      {diffText != null && (
        <span className={`db-wkpi-diff db-wkpi-diff-${diffType}`}>
          {diffType === 'up' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-wkpi-arrow"><polyline points="18 15 12 9 6 15"/></svg>}
          {diffType === 'down' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-wkpi-arrow"><polyline points="6 9 12 15 18 9"/></svg>}
          {diffText} vs anterior
        </span>
      )}
    </div>
  )
}
