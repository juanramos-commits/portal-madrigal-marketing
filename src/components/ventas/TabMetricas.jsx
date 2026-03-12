import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users, MessageSquare, Calendar, TrendingUp, TrendingDown,
  DollarSign, BarChart3, GitCompare, AlertTriangle, CheckCircle,
  Loader2, RefreshCw, Heart, Filter, XCircle, Zap, Target,
  ArrowUpRight, ArrowDownRight, Activity, PieChart
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function fmtMoney(v) {
  if (v == null) return '$0.00'
  return '$' + Number(v).toFixed(2)
}

function fmtPct(v) {
  if (v == null || isNaN(v) || !isFinite(v)) return '0%'
  return (v * 100).toFixed(1) + '%'
}

function shortDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function fmtNum(n) {
  if (n == null) return '0'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}

// ---------------------------------------------------------------------------
// Date Range Pills
// ---------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'custom', label: 'Custom' },
]

function DateRangeSelector({ rango, desde, hasta, onChange }) {
  return (
    <div className="ia-met-range">
      <div className="ia-met-range-pills">
        {RANGE_OPTIONS.map(o => (
          <button
            key={o.value}
            className={`ia-met-range-pill ${rango === o.value ? 'active' : ''}`}
            onClick={() => onChange({ rango: o.value })}
          >
            {o.label}
          </button>
        ))}
      </div>
      {rango === 'custom' && (
        <div className="ia-met-range-dates">
          <input
            type="date"
            className="ia-met-date-input"
            value={desde}
            max={hasta || undefined}
            onChange={e => onChange({ desde: e.target.value })}
          />
          <span className="ia-met-date-sep">—</span>
          <input
            type="date"
            className="ia-met-date-input"
            value={hasta}
            min={desde || undefined}
            onChange={e => onChange({ hasta: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card (big number style)
// ---------------------------------------------------------------------------

function KPICard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div className="ia-met-kpi">
      <div className="ia-met-kpi-top">
        <div className="ia-met-kpi-icon" style={{ background: color + '18', color }}>
          <Icon size={18} />
        </div>
        {trend !== undefined && trend !== null && (
          <span className={`ia-met-kpi-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="ia-met-kpi-value">{value}</div>
      <div className="ia-met-kpi-label">{label}</div>
      {sub && <div className="ia-met-kpi-sub">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Funnel (horizontal bars, premium)
// ---------------------------------------------------------------------------

function FunnelVisualization({ totals }) {
  const steps = [
    { label: 'Contactados', value: totals.leads, color: '#3b82f6' },
    { label: 'Respondieron', value: totals.respondieron, color: '#8b5cf6' },
    { label: 'En proceso', value: totals.activas, color: '#f59e0b' },
    { label: 'Agendados', value: totals.agendados, color: '#10b981' },
  ]
  const maxVal = Math.max(steps[0].value, 1)

  return (
    <div className="ia-met-panel">
      <div className="ia-met-panel-header">
        <Filter size={16} />
        <span>Embudo de conversión</span>
      </div>
      <div className="ia-met-funnel">
        {steps.map((step, i) => {
          const widthPct = Math.max((step.value / maxVal) * 100, 8)
          const prevValue = i > 0 ? steps[i - 1].value : null
          const dropOff = prevValue && prevValue > 0
            ? ((prevValue - step.value) / prevValue * 100).toFixed(0)
            : null

          return (
            <div key={step.label} className="ia-met-funnel-step">
              <div className="ia-met-funnel-info">
                <span className="ia-met-funnel-label">{step.label}</span>
                <div className="ia-met-funnel-nums">
                  <span className="ia-met-funnel-value" style={{ color: step.color }}>{step.value}</span>
                  {dropOff !== null && (
                    <span className="ia-met-funnel-drop">-{dropOff}%</span>
                  )}
                </div>
              </div>
              <div className="ia-met-funnel-track">
                <div
                  className="ia-met-funnel-fill"
                  style={{ width: `${widthPct}%`, background: step.color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini Sparkline Bar Chart
// ---------------------------------------------------------------------------

function SparkChart({ data, dataKey, label, color = '#3b82f6', icon: Icon = BarChart3 }) {
  const max = Math.max(...data.map(d => d[dataKey] || 0), 1)
  const total = data.reduce((s, d) => s + (d[dataKey] || 0), 0)

  return (
    <div className="ia-met-spark">
      <div className="ia-met-spark-header">
        <div className="ia-met-spark-title">
          <Icon size={14} style={{ color }} />
          <span>{label}</span>
        </div>
        <span className="ia-met-spark-total" style={{ color }}>{fmtNum(total)}</span>
      </div>
      <div className="ia-met-spark-bars">
        {data.map((d, i) => {
          const val = d[dataKey] || 0
          const pct = (val / max) * 100
          return (
            <div key={d.fecha || i} className="ia-met-spark-col" title={`${shortDate(d.fecha)}: ${val}`}>
              <div className="ia-met-spark-bar" style={{ height: `${Math.max(pct, 3)}%`, background: color }} />
            </div>
          )
        })}
      </div>
      <div className="ia-met-spark-dates">
        <span>{shortDate(data[0]?.fecha)}</span>
        <span>{shortDate(data[data.length - 1]?.fecha)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// A/B Comparison
// ---------------------------------------------------------------------------

function ABComparison({ metricasA, metricasB }) {
  const sum = (arr, key) => arr.reduce((s, r) => s + (r[key] || 0), 0)

  const rows = [
    { label: 'Leads contactados', key: 'leads_contactados' },
    { label: 'Respuestas', key: 'respuestas_recibidas' },
    { label: 'Reuniones', key: 'reuniones_agendadas' },
    { label: 'Descartados', key: 'leads_descartados' },
    { label: 'Objeciones detectadas', key: 'objeciones_detectadas' },
    { label: 'Objeciones resueltas', key: 'objeciones_resueltas' },
  ]

  const leadsA = sum(metricasA, 'leads_contactados')
  const reunA = sum(metricasA, 'reuniones_agendadas')
  const leadsB = sum(metricasB, 'leads_contactados')
  const reunB = sum(metricasB, 'reuniones_agendadas')
  const rateA = leadsA > 0 ? reunA / leadsA : 0
  const rateB = leadsB > 0 ? reunB / leadsB : 0

  return (
    <div className="ia-met-panel">
      <div className="ia-met-panel-header">
        <GitCompare size={16} />
        <span>Comparación A/B</span>
      </div>
      <div className="ia-met-table-wrap">
        <table className="ia-met-table">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>A</th>
              <th>B</th>
              <th>Dif.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const a = sum(metricasA, r.key)
              const b = sum(metricasB, r.key)
              const diff = b - a
              const diffPct = a > 0 ? ((diff / a) * 100).toFixed(1) : '—'
              return (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>{a}</td>
                  <td>{b}</td>
                  <td className={diff > 0 ? 'ia-met-pos' : diff < 0 ? 'ia-met-neg' : ''}>
                    {diff > 0 ? '+' : ''}{diff}{diffPct !== '—' ? ` (${diffPct}%)` : ''}
                  </td>
                </tr>
              )
            })}
            <tr className="ia-met-table-highlight">
              <td>Conversión</td>
              <td>{fmtPct(rateA)}</td>
              <td>{fmtPct(rateB)}</td>
              <td className={rateB > rateA ? 'ia-met-pos' : rateB < rateA ? 'ia-met-neg' : ''}>
                {rateB > rateA ? '+' : ''}{((rateB - rateA) * 100).toFixed(1)}pp
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sentiment Gauge
// ---------------------------------------------------------------------------

function SentimientoSection({ dailySentimiento }) {
  if (!dailySentimiento || dailySentimiento.length === 0) return null

  const avgSent = dailySentimiento.reduce((s, d) => s + (d.sentimiento_promedio || 0), 0) / dailySentimiento.length
  const avgCalidad = dailySentimiento.reduce((s, d) => s + (d.score_calidad_promedio || 0), 0) / dailySentimiento.length

  const sentColor = avgSent >= 0.6 ? '#10b981' : avgSent >= 0.3 ? '#f59e0b' : '#ef4444'
  const sentLabel = avgSent >= 0.6 ? 'Positivo' : avgSent >= 0.3 ? 'Neutro' : 'Negativo'

  return (
    <div className="ia-met-panel">
      <div className="ia-met-panel-header">
        <Heart size={16} />
        <span>Sentimiento y calidad</span>
      </div>
      <div className="ia-met-sentiment-grid">
        <div className="ia-met-gauge">
          <div className="ia-met-gauge-ring" style={{ '--gauge-color': sentColor, '--gauge-pct': `${avgSent * 100}%` }}>
            <div className="ia-met-gauge-inner">
              <span className="ia-met-gauge-value" style={{ color: sentColor }}>
                {(avgSent * 100).toFixed(0)}
              </span>
            </div>
          </div>
          <span className="ia-met-gauge-label" style={{ color: sentColor }}>{sentLabel}</span>
          <span className="ia-met-gauge-sub">Sentimiento promedio</span>
        </div>
        <div className="ia-met-gauge">
          <div className="ia-met-gauge-ring" style={{ '--gauge-color': '#3b82f6', '--gauge-pct': `${avgCalidad * 10}%` }}>
            <div className="ia-met-gauge-inner">
              <span className="ia-met-gauge-value" style={{ color: '#3b82f6' }}>
                {avgCalidad.toFixed(1)}
              </span>
            </div>
          </div>
          <span className="ia-met-gauge-label" style={{ color: '#3b82f6' }}>/10</span>
          <span className="ia-met-gauge-sub">Calidad promedio</span>
        </div>
        <div className="ia-met-sentiment-history">
          {dailySentimiento.slice(-10).map(d => {
            const c = d.sentimiento_promedio >= 0.6 ? '#10b981' : d.sentimiento_promedio >= 0.3 ? '#f59e0b' : '#ef4444'
            return (
              <div key={d.fecha} className="ia-met-sentiment-dot-row" title={`${shortDate(d.fecha)}: ${(d.sentimiento_promedio * 100).toFixed(0)}%`}>
                <span className="ia-met-sentiment-dot-date">{shortDate(d.fecha)}</span>
                <div className="ia-met-sentiment-dot-track">
                  <div className="ia-met-sentiment-dot-fill" style={{ width: `${d.sentimiento_promedio * 100}%`, background: c }} />
                </div>
                <span className="ia-met-sentiment-dot-val" style={{ color: c }}>
                  {(d.sentimiento_promedio * 100).toFixed(0)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cost Breakdown (modern cards)
// ---------------------------------------------------------------------------

function CostBreakdown({ costes, totals }) {
  const sum = (key) => costes.reduce((s, r) => s + (r[key] || 0), 0)

  const allRows = [
    { label: 'Claude', calls: sum('claude_calls'), coste: sum('claude_coste'), color: '#8b5cf6' },
    { label: 'Haiku', calls: sum('haiku_calls'), coste: sum('haiku_coste'), color: '#06b6d4' },
    { label: 'Whisper', calls: sum('whisper_calls'), coste: sum('whisper_coste'), color: '#f59e0b' },
    { label: 'GPT-4o', calls: sum('gpt4o_calls'), coste: sum('gpt4o_coste'), color: '#10b981' },
    { label: 'WhatsApp', calls: sum('whatsapp_mensajes'), coste: sum('whatsapp_coste'), color: '#00a884' },
  ]

  // Only show services that have usage
  const rows = allRows.filter(r => r.calls > 0 || r.coste > 0)
  const total = allRows.reduce((s, r) => s + r.coste, 0)
  const maxCoste = Math.max(...rows.map(r => r.coste), 0.01)
  const costePorLead = totals.leads > 0 ? total / totals.leads : 0
  const costePorReunion = totals.agendados > 0 ? total / totals.agendados : 0

  return (
    <div className="ia-met-panel ia-met-costs-panel">
      <div className="ia-met-costs-top">
        <div className="ia-met-costs-total-block">
          <span className="ia-met-costs-total-label">Gasto total</span>
          <span className="ia-met-costs-total-value">{fmtMoney(total)}</span>
        </div>
        <div className="ia-met-cost-roi">
          <div className="ia-met-cost-roi-item">
            <Target size={15} />
            <div>
              <span className="ia-met-cost-roi-val">{fmtMoney(costePorLead)}</span>
              <span className="ia-met-cost-roi-label">/ lead</span>
            </div>
          </div>
          <div className="ia-met-cost-roi-item">
            <Calendar size={15} />
            <div>
              <span className="ia-met-cost-roi-val">{fmtMoney(costePorReunion)}</span>
              <span className="ia-met-cost-roi-label">/ reunión</span>
            </div>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="ia-met-cost-bars">
          {rows.map(r => {
            const pct = (r.coste / maxCoste) * 100
            const pctOfTotal = total > 0 ? ((r.coste / total) * 100).toFixed(0) : 0
            return (
              <div key={r.label} className="ia-met-cost-row">
                <div className="ia-met-cost-row-info">
                  <span className="ia-met-cost-swatch" style={{ background: r.color }} />
                  <span className="ia-met-cost-name">{r.label}</span>
                  <span className="ia-met-cost-calls">{r.calls.toLocaleString()} calls</span>
                  <span className="ia-met-cost-pct">{pctOfTotal}%</span>
                  <span className="ia-met-cost-amount">{fmtMoney(r.coste)}</span>
                </div>
                <div className="ia-met-cost-track">
                  <div className="ia-met-cost-fill" style={{ width: `${pct}%`, background: r.color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Objeciones Summary
// ---------------------------------------------------------------------------

function ObjecionesSummary({ objeciones }) {
  if (!objeciones || objeciones.length === 0) return null

  const tipos = ['precio', 'tiempo', 'confianza', 'competencia', 'pensar', 'otro']
  const grouped = {}
  tipos.forEach(t => { grouped[t] = { total: 0, resueltas: 0 } })

  objeciones.forEach(o => {
    const t = o.tipo || 'otro'
    if (!grouped[t]) grouped[t] = { total: 0, resueltas: 0 }
    grouped[t].total++
    if (o.resuelta) grouped[t].resueltas++
  })

  const tipoLabels = {
    precio: 'Precio', tiempo: 'Tiempo', confianza: 'Confianza',
    competencia: 'Competencia', pensar: 'Necesita pensar', otro: 'Otro',
  }
  const tipoColors = {
    precio: '#ef4444', tiempo: '#f59e0b', confianza: '#8b5cf6',
    competencia: '#3b82f6', pensar: '#06b6d4', otro: '#6b7280',
  }

  const totalObj = objeciones.length
  const totalRes = objeciones.filter(o => o.resuelta).length
  const resRate = totalObj > 0 ? (totalRes / totalObj) : 0

  return (
    <div className="ia-met-panel">
      <div className="ia-met-panel-header">
        <AlertTriangle size={16} />
        <span>Objeciones</span>
        <span className={`ia-met-obj-badge ${resRate >= 0.7 ? 'good' : resRate >= 0.4 ? 'warn' : 'bad'}`}>
          <CheckCircle size={12} />
          {fmtPct(resRate)} resueltas
        </span>
      </div>
      <div className="ia-met-obj-grid">
        {tipos.map(t => {
          const g = grouped[t]
          if (g.total === 0) return null
          const pct = g.total > 0 ? (g.resueltas / g.total) * 100 : 0
          return (
            <div key={t} className="ia-met-obj-item">
              <div className="ia-met-obj-info">
                <span className="ia-met-obj-dot" style={{ background: tipoColors[t] }} />
                <span className="ia-met-obj-name">{tipoLabels[t]}</span>
                <span className="ia-met-obj-count">{g.resueltas}/{g.total}</span>
              </div>
              <div className="ia-met-obj-track">
                <div className="ia-met-obj-fill" style={{ width: `${pct}%`, background: tipoColors[t] }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TabMetricas({ agenteId, agente }) {
  const [rango, setRango] = useState('7')
  const [desde, setDesde] = useState(formatDate(daysAgo(7)))
  const [hasta, setHasta] = useState(formatDate(new Date()))
  const [metricas, setMetricas] = useState([])
  const [costes, setCostes] = useState([])
  const [objeciones, setObjeciones] = useState([])
  const [convStats, setConvStats] = useState({ total: 0, respondieron: 0, agendados: 0, descartados: 0, activas: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const getDateRange = useCallback(() => {
    if (rango === 'custom') return { inicio: desde, fin: hasta }
    return { inicio: formatDate(daysAgo(Number(rango))), fin: formatDate(new Date()) }
  }, [rango, desde, hasta])

  const fetchData = useCallback(async () => {
    if (!agenteId) return
    setLoading(true)
    setError(null)
    const { inicio: fechaInicio, fin: fechaFin } = getDateRange()

    try {
      const [metricasRes, costesRes, objecionesRes, convsRes] = await Promise.all([
        supabase
          .from('ia_metricas_diarias')
          .select('*')
          .eq('agente_id', agenteId)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: true }),
        supabase
          .from('ia_costes')
          .select('*')
          .eq('agente_id', agenteId)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: true }),
        supabase
          .from('ia_objeciones')
          .select('*, conversacion:ia_conversaciones!inner(agente_id)')
          .eq('conversacion.agente_id', agenteId)
          .gte('created_at', new Date(fechaInicio).toISOString())
          .lte('created_at', new Date(fechaFin + 'T23:59:59').toISOString()),
        // Real conversation-level stats for accurate funnel
        supabase
          .from('ia_conversaciones')
          .select('id, estado, created_at')
          .eq('agente_id', agenteId)
          .gte('created_at', new Date(fechaInicio).toISOString())
          .lte('created_at', new Date(fechaFin + 'T23:59:59').toISOString()),
      ])

      if (metricasRes.error) throw metricasRes.error
      if (costesRes.error) throw costesRes.error
      if (objecionesRes.error) throw objecionesRes.error

      setMetricas(metricasRes.data || [])
      setCostes(costesRes.data || [])
      setObjeciones(objecionesRes.data || [])

      // Compute real conversation stats
      const convs = convsRes.data || []
      const noResponseStates = ['no_response', 'descartado']
      const respondedStates = ['needs_reply', 'handoff_humano', 'waiting_reply', 'scheduled_followup', 'qualify', 'meeting_pref', 'agendado']
      setConvStats({
        total: convs.length,
        respondieron: convs.filter(c => respondedStates.includes(c.estado)).length,
        agendados: convs.filter(c => c.estado === 'agendado').length,
        descartados: convs.filter(c => noResponseStates.includes(c.estado)).length,
        activas: convs.filter(c => !noResponseStates.includes(c.estado) && c.estado !== 'agendado').length,
      })
    } catch (err) {
      console.error('Error cargando métricas:', err)
      setError(err.message || 'Error al cargar métricas')
    } finally {
      setLoading(false)
    }
  }, [agenteId, getDateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRangoChange = ({ rango: r, desde: d, hasta: h }) => {
    if (r !== undefined) setRango(r)
    if (d !== undefined) setDesde(d)
    if (h !== undefined) setHasta(h)
  }

  // ---------- Computed ----------

  const totals = useMemo(() => {
    const sum = (key) => metricas.reduce((s, r) => s + (r[key] || 0), 0)
    const msgEnviados = sum('mensajes_enviados')
    const msgRecibidos = sum('mensajes_recibidos')

    // Use real conversation-level data for funnel metrics
    const leads = convStats.total
    const respondieron = convStats.respondieron
    const agendados = convStats.agendados
    const descartados = convStats.descartados
    const activas = convStats.activas
    const tasaRespuesta = leads > 0 ? respondieron / leads : 0
    const conversion = leads > 0 ? agendados / leads : 0

    const gastoTotal = costes.reduce((s, r) => {
      return s + (r.claude_coste || 0) + (r.haiku_coste || 0) +
        (r.whisper_coste || 0) + (r.gpt4o_coste || 0) + (r.whatsapp_coste || 0)
    }, 0)

    return { leads, respondieron, agendados, descartados, activas, conversion, tasaRespuesta, gastoTotal, msgEnviados, msgRecibidos }
  }, [metricas, costes, convStats])

  const { metricasA, metricasB } = useMemo(() => {
    if (!agente?.ab_test_activo) return { metricasA: [], metricasB: [] }
    return {
      metricasA: metricas.filter(m => m.ab_version === 'A'),
      metricasB: metricas.filter(m => m.ab_version === 'B'),
    }
  }, [metricas, agente?.ab_test_activo])

  const dailyData = useMemo(() => {
    const byDate = {}
    metricas.forEach(m => {
      if (!byDate[m.fecha]) {
        byDate[m.fecha] = {
          fecha: m.fecha, leads_contactados: 0, respuestas_recibidas: 0,
          reuniones_agendadas: 0, mensajes_enviados: 0, mensajes_recibidos: 0,
        }
      }
      const d = byDate[m.fecha]
      d.leads_contactados += m.leads_contactados || 0
      d.respuestas_recibidas += m.respuestas_recibidas || 0
      d.reuniones_agendadas += m.reuniones_agendadas || 0
      d.mensajes_enviados += m.mensajes_enviados || 0
      d.mensajes_recibidos += m.mensajes_recibidos || 0
    })
    return Object.values(byDate).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [metricas])

  const dailySentimiento = useMemo(() => {
    const byDate = {}
    metricas.forEach(m => {
      if (m.sentimiento_promedio == null && m.score_calidad_promedio == null) return
      if (!byDate[m.fecha]) {
        byDate[m.fecha] = { fecha: m.fecha, sentimiento_total: 0, calidad_total: 0, count: 0 }
      }
      const d = byDate[m.fecha]
      if (m.sentimiento_promedio != null) {
        d.sentimiento_total += m.sentimiento_promedio
        d.count++
      }
      if (m.score_calidad_promedio != null) {
        d.calidad_total += m.score_calidad_promedio
      }
    })
    return Object.values(byDate)
      .map(d => ({
        fecha: d.fecha,
        sentimiento_promedio: d.count > 0 ? d.sentimiento_total / d.count : null,
        score_calidad_promedio: d.count > 0 ? d.calidad_total / d.count : null,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [metricas])

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="ia-met-loading">
        <Loader2 size={28} className="ia-spin" />
        <span>Cargando métricas...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ia-met-error">
        <AlertTriangle size={24} />
        <span>{error}</span>
        <button className="ia-met-retry-btn" onClick={fetchData}>Reintentar</button>
      </div>
    )
  }

  return (
    <div className="ia-met">
      {/* Toolbar */}
      <div className="ia-met-toolbar">
        <DateRangeSelector rango={rango} desde={desde} hasta={hasta} onChange={handleRangoChange} />
        <button className="ia-met-refresh" onClick={fetchData} title="Actualizar">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="ia-met-kpis">
        <KPICard
          icon={Users}
          label="Conversaciones"
          value={fmtNum(totals.leads)}
          color="#3b82f6"
        />
        <KPICard
          icon={MessageSquare}
          label="Respondieron"
          value={fmtNum(totals.respondieron)}
          color="#8b5cf6"
          sub={`Tasa: ${fmtPct(totals.tasaRespuesta)}`}
        />
        <KPICard
          icon={Calendar}
          label="Agendados"
          value={fmtNum(totals.agendados)}
          color="#10b981"
          sub={`Conversión: ${fmtPct(totals.conversion)}`}
        />
        <KPICard
          icon={XCircle}
          label="Descartados"
          value={fmtNum(totals.descartados)}
          color="#ef4444"
        />
        <KPICard
          icon={Zap}
          label="Msgs enviados"
          value={fmtNum(totals.msgEnviados)}
          color="#f59e0b"
        />
        <KPICard
          icon={DollarSign}
          label="Gasto total"
          value={fmtMoney(totals.gastoTotal)}
          color="#00a884"
        />
      </div>

      {/* Funnel */}
      {totals.leads > 0 && <FunnelVisualization totals={totals} />}

      {/* Charts */}
      {dailyData.length > 0 && (
        <div className="ia-met-charts">
          <SparkChart data={dailyData} dataKey="leads_contactados" label="Leads / día" color="#3b82f6" icon={Users} />
          <SparkChart data={dailyData} dataKey="mensajes_recibidos" label="Msgs recibidos / día" color="#8b5cf6" icon={MessageSquare} />
          <SparkChart data={dailyData} dataKey="reuniones_agendadas" label="Reuniones / día" color="#10b981" icon={Calendar} />
          <SparkChart data={dailyData} dataKey="mensajes_enviados" label="Mensajes / día" color="#f59e0b" icon={Activity} />
        </div>
      )}

      {dailyData.length === 0 && (
        <div className="ia-met-empty">
          <BarChart3 size={36} />
          <p>No hay datos para el periodo seleccionado</p>
        </div>
      )}

      {/* Costs — full width */}
      {costes.length > 0 && <CostBreakdown costes={costes} totals={totals} />}

      {/* Bottom grid: 2 columns */}
      <div className="ia-met-bottom-grid">
        <div className="ia-met-bottom-col">
          {agente?.ab_test_activo && metricasA.length > 0 && metricasB.length > 0 && (
            <ABComparison metricasA={metricasA} metricasB={metricasB} />
          )}
          <ObjecionesSummary objeciones={objeciones} />
        </div>
        <div className="ia-met-bottom-col">
          <SentimientoSection dailySentimiento={dailySentimiento} />
        </div>
      </div>
    </div>
  )
}
