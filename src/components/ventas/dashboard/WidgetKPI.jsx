import { useEffect, useRef } from 'react'

function formatCurrency(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function animateValue(el, end, isCurrency, duration) {
  if (!el) return
  const numEnd = typeof end === 'number' ? end : parseFloat(String(end).replace(/[^0-9.-]/g, '')) || 0
  const startTime = performance.now()
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = numEnd * eased
    el.textContent = isCurrency ? formatCurrency(current) : Math.round(current).toLocaleString('es-ES')
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export default function WidgetKPI({ widgetDef, data }) {
  const numRef = useRef(null)

  const valor = Number(data?.valor) || 0
  const anterior = data?.anterior != null ? Number(data.anterior) : null
  const isCurrency = widgetDef?.formato === 'currency'

  useEffect(() => {
    if (numRef.current) animateValue(numRef.current, valor, isCurrency, 600)
  }, [valor, isCurrency])

  const diff = anterior != null ? valor - anterior : null
  const diffType = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'
  const diffText = diff != null
    ? (isCurrency ? (diff > 0 ? '+' : '') + formatCurrency(diff) : (diff > 0 ? '+' : '') + diff)
    : null

  return (
    <div className="db-wkpi">
      <span className="db-wkpi-value" ref={numRef}>0</span>
      {diffText != null && (
        <span className={`db-wkpi-diff db-wkpi-diff-${diffType}`}>
          {diffType === 'up' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}><polyline points="18 15 12 9 6 15"/></svg>}
          {diffType === 'down' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}><polyline points="6 9 12 15 18 9"/></svg>}
          {diffText} vs anterior
        </span>
      )}
    </div>
  )
}
