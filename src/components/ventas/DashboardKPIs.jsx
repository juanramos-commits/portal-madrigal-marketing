import { useEffect, useRef } from 'react'

function animateValue(el, end, duration) {
  if (!el) return
  const isPercent = typeof end === 'string' && end.includes('%')
  const isCurrency = typeof end === 'string' && end.includes('€')
  let numEnd = parseFloat(String(end).replace(/[^0-9.-]/g, '')) || 0
  const start = 0
  const startTime = performance.now()

  const step = (now) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = start + (numEnd - start) * eased

    if (isCurrency) {
      el.textContent = formatCurrency(current)
    } else if (isPercent) {
      el.textContent = current.toFixed(1) + '%'
    } else {
      el.textContent = Math.round(current).toLocaleString('es-ES')
    }

    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function formatCurrency(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function KPICard({ label, valor, valorPrevio, formato, delay }) {
  const numRef = useRef(null)

  const getDisplay = () => {
    if (formato === 'currency') return formatCurrency(valor || 0)
    if (formato === 'percent') return (valor || 0).toFixed(1) + '%'
    return (valor || 0).toLocaleString('es-ES')
  }

  const getDiff = () => {
    if (valorPrevio === null || valorPrevio === undefined) return null
    const diff = (valor || 0) - (valorPrevio || 0)
    if (formato === 'currency') {
      const prefix = diff > 0 ? '+' : ''
      return { text: prefix + formatCurrency(diff), type: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' }
    }
    if (formato === 'percent') {
      const prefix = diff > 0 ? '+' : ''
      return { text: prefix + diff.toFixed(1) + '%', type: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' }
    }
    const prefix = diff > 0 ? '+' : ''
    return { text: prefix + diff, type: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral' }
  }

  useEffect(() => {
    if (!numRef.current) return
    const timer = setTimeout(() => {
      const display = getDisplay()
      animateValue(numRef.current, display, 600)
    }, delay || 0)
    return () => clearTimeout(timer)
  }, [valor])

  const diff = getDiff()

  return (
    <div className="db-kpi-card">
      <span className="db-kpi-label">{label}</span>
      <span className="db-kpi-value" ref={numRef}>0</span>
      {diff && (
        <span className={`db-kpi-diff db-kpi-diff-${diff.type}`}>
          {diff.type === 'up' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}><polyline points="18 15 12 9 6 15"/></svg>
          )}
          {diff.type === 'down' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}><polyline points="6 9 12 15 18 9"/></svg>
          )}
          {diff.type === 'neutral' && '= '}
          {diff.text} vs anterior
        </span>
      )}
    </div>
  )
}

function KPISkeleton() {
  return (
    <div className="db-kpi-card db-skeleton">
      <span className="db-kpi-label-sk" />
      <span className="db-kpi-value-sk" />
      <span className="db-kpi-diff-sk" />
    </div>
  )
}

export default function DashboardKPIs({ kpis, kpisPrevios, loading }) {
  if (loading) {
    return (
      <div className="db-kpis-grid">
        {[1, 2, 3, 4].map(i => <KPISkeleton key={i} />)}
      </div>
    )
  }

  if (!kpis) return null

  const rol = kpis.rol

  const calcTasa = (num, den) => den > 0 ? (num / den) * 100 : 0
  const prev = kpisPrevios || {}

  if (rol === 'setter') {
    const tasa = calcTasa(kpis.citas_agendadas, kpis.leads_asignados)
    const tasaPrev = calcTasa(prev.citas_agendadas, prev.leads_asignados)
    return (
      <div className="db-kpis-grid">
        <KPICard label="Leads asignados" valor={kpis.leads_asignados} valorPrevio={prev.leads_asignados} delay={0} />
        <KPICard label="Contactados" valor={kpis.contactados} valorPrevio={prev.contactados} delay={80} />
        <KPICard label="Citas agendadas" valor={kpis.citas_agendadas} valorPrevio={prev.citas_agendadas} delay={160} />
        <KPICard label="Tasa agendamiento" valor={tasa} valorPrevio={tasaPrev} formato="percent" delay={240} />
      </div>
    )
  }

  if (rol === 'closer') {
    const tasa = calcTasa(kpis.ventas_cerradas, kpis.citas_recibidas)
    const tasaPrev = calcTasa(prev.ventas_cerradas, prev.citas_recibidas)
    return (
      <div className="db-kpis-grid">
        <KPICard label="Citas recibidas" valor={kpis.citas_recibidas} valorPrevio={prev.citas_recibidas} delay={0} />
        <KPICard label="Llamadas realizadas" valor={kpis.llamadas_realizadas} valorPrevio={prev.llamadas_realizadas} delay={80} />
        <KPICard label="Ventas cerradas" valor={kpis.ventas_cerradas} valorPrevio={prev.ventas_cerradas} delay={160} />
        <KPICard label="Tasa de cierre" valor={tasa} valorPrevio={tasaPrev} formato="percent" delay={240} />
      </div>
    )
  }

  // Director / Admin
  const tasaCierre = calcTasa(kpis.ventas_cerradas, kpis.citas_agendadas)
  const tasaCierrePrev = calcTasa(prev.ventas_cerradas, prev.citas_agendadas)
  const ticketMedio = kpis.ventas_cerradas > 0 ? kpis.facturacion_total / kpis.ventas_cerradas : 0
  const ticketMedioPrev = prev.ventas_cerradas > 0 ? (prev.facturacion_total || 0) / prev.ventas_cerradas : 0

  return (
    <div className="db-kpis-grid db-kpis-6">
      <KPICard label="Leads nuevos" valor={kpis.leads_nuevos} valorPrevio={prev.leads_nuevos} delay={0} />
      <KPICard label="Citas agendadas" valor={kpis.citas_agendadas} valorPrevio={prev.citas_agendadas} delay={80} />
      <KPICard label="Ventas cerradas" valor={kpis.ventas_cerradas} valorPrevio={prev.ventas_cerradas} delay={160} />
      <KPICard label="Facturacion total" valor={kpis.facturacion_total} valorPrevio={prev.facturacion_total} formato="currency" delay={240} />
      <KPICard label="Tasa de cierre" valor={tasaCierre} valorPrevio={tasaCierrePrev} formato="percent" delay={320} />
      <KPICard label="Ticket medio" valor={ticketMedio} valorPrevio={ticketMedioPrev} formato="currency" delay={400} />
    </div>
  )
}
