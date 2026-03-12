import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users, MessageSquare, Calendar, TrendingUp, Star, DollarSign,
  BarChart3, GitCompare, AlertTriangle, CheckCircle, ChevronDown,
  Loader2, RefreshCw
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

// ---------------------------------------------------------------------------
// Date Range Selector
// ---------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: 'custom', label: 'Personalizado' },
]

function DateRangeSelector({ rango, desde, hasta, onChange }) {
  return (
    <div className="ia-metricas-rango">
      <select
        className="ia-metricas-select"
        value={rango}
        onChange={e => onChange({ rango: e.target.value })}
      >
        {RANGE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {rango === 'custom' && (
        <div className="ia-metricas-fechas">
          <input
            type="date"
            className="ia-metricas-input-fecha"
            value={desde}
            max={hasta || undefined}
            onChange={e => onChange({ desde: e.target.value })}
          />
          <span className="ia-metricas-sep">—</span>
          <input
            type="date"
            className="ia-metricas-input-fecha"
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
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="ia-metricas-card">
      <div className="ia-metricas-card-icon" style={{ color }}>
        <Icon size={20} />
      </div>
      <div className="ia-metricas-card-body">
        <span className="ia-metricas-card-value">{value}</span>
        <span className="ia-metricas-card-label">{label}</span>
        {sub && <span className="ia-metricas-card-sub">{sub}</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSS Bar Chart
// ---------------------------------------------------------------------------

function BarChart({ data, dataKey, label, color = 'var(--primary, #3b82f6)' }) {
  const max = Math.max(...data.map(d => d[dataKey] || 0), 1)

  return (
    <div className="ia-chart-container">
      <div className="ia-chart-header">
        <BarChart3 size={16} />
        <span>{label}</span>
      </div>
      <div className="ia-chart-bars">
        {data.map((d, i) => {
          const val = d[dataKey] || 0
          const pct = (val / max) * 100
          return (
            <div key={d.fecha || i} className="ia-chart-bar-col" title={`${shortDate(d.fecha)}: ${val}`}>
              <div className="ia-chart-bar-track">
                <div
                  className="ia-chart-bar-fill"
                  style={{ height: `${pct}%`, background: color }}
                />
              </div>
              <span className="ia-chart-bar-label">{shortDate(d.fecha)}</span>
            </div>
          )
        })}
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
    { label: 'Respuestas recibidas', key: 'respuestas_recibidas' },
    { label: 'Reuniones agendadas', key: 'reuniones_agendadas' },
    { label: 'Leads descartados', key: 'leads_descartados' },
    { label: 'Objeciones detectadas', key: 'objeciones_detectadas' },
    { label: 'Objeciones resueltas', key: 'objeciones_resueltas' },
  ]

  return (
    <div className="ia-ab-section">
      <div className="ia-ab-header">
        <GitCompare size={18} />
        <h3>Comparación A/B</h3>
      </div>
      <table className="ia-ab-table">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Versión A</th>
            <th>Versión B</th>
            <th>Diferencia</th>
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
                <td className={diff > 0 ? 'ia-ab-positive' : diff < 0 ? 'ia-ab-negative' : ''}>
                  {diff > 0 ? '+' : ''}{diff}{diffPct !== '—' ? ` (${diffPct}%)` : ''}
                </td>
              </tr>
            )
          })}
          {/* Conversion rate row */}
          {(() => {
            const leadsA = sum(metricasA, 'leads_contactados')
            const reunA = sum(metricasA, 'reuniones_agendadas')
            const leadsB = sum(metricasB, 'leads_contactados')
            const reunB = sum(metricasB, 'reuniones_agendadas')
            const rateA = leadsA > 0 ? reunA / leadsA : 0
            const rateB = leadsB > 0 ? reunB / leadsB : 0
            return (
              <tr className="ia-ab-highlight">
                <td>Tasa de conversión</td>
                <td>{fmtPct(rateA)}</td>
                <td>{fmtPct(rateB)}</td>
                <td className={rateB > rateA ? 'ia-ab-positive' : rateB < rateA ? 'ia-ab-negative' : ''}>
                  {rateB > rateA ? '+' : ''}{((rateB - rateA) * 100).toFixed(1)}pp
                </td>
              </tr>
            )
          })()}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cost Breakdown
// ---------------------------------------------------------------------------

function CostBreakdown({ costes }) {
  const sum = (key) => costes.reduce((s, r) => s + (r[key] || 0), 0)

  const rows = [
    { label: 'Claude (Sonnet)', calls: sum('claude_calls'), coste: sum('claude_coste') },
    { label: 'Haiku', calls: sum('haiku_calls'), coste: sum('haiku_coste') },
    { label: 'Whisper', calls: sum('whisper_calls'), coste: sum('whisper_coste') },
    { label: 'GPT-4o', calls: sum('gpt4o_calls'), coste: sum('gpt4o_coste') },
    { label: 'WhatsApp', calls: sum('whatsapp_mensajes'), coste: sum('whatsapp_coste') },
  ]

  const total = rows.reduce((s, r) => s + r.coste, 0)
  const maxCoste = Math.max(...rows.map(r => r.coste), 1)

  return (
    <div className="ia-costes-section">
      <div className="ia-costes-header">
        <DollarSign size={18} />
        <h3>Desglose de costes</h3>
        <span className="ia-costes-total">{fmtMoney(total)}</span>
      </div>
      <table className="ia-costes-table">
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Llamadas / Msgs</th>
            <th>Coste</th>
            <th>Proporción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.calls.toLocaleString()}</td>
              <td>{fmtMoney(r.coste)}</td>
              <td>
                <div className="ia-costes-bar-track">
                  <div
                    className="ia-costes-bar-fill"
                    style={{ width: `${(r.coste / maxCoste) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td></td>
            <td><strong>{fmtMoney(total)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
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
    precio: 'Precio',
    tiempo: 'Tiempo',
    confianza: 'Confianza',
    competencia: 'Competencia',
    pensar: 'Necesita pensar',
    otro: 'Otro',
  }

  const totalObj = objeciones.length
  const totalRes = objeciones.filter(o => o.resuelta).length

  return (
    <div className="ia-objeciones-section">
      <div className="ia-objeciones-header">
        <AlertTriangle size={18} />
        <h3>Objeciones</h3>
        <span className="ia-objeciones-ratio">
          <CheckCircle size={14} />
          {totalRes}/{totalObj} resueltas ({totalObj > 0 ? fmtPct(totalRes / totalObj) : '0%'})
        </span>
      </div>
      <div className="ia-objeciones-grid">
        {tipos.map(t => {
          const g = grouped[t]
          if (g.total === 0) return null
          const pct = g.total > 0 ? (g.resueltas / g.total) * 100 : 0
          return (
            <div key={t} className="ia-objecion-item">
              <div className="ia-objecion-label">
                <span>{tipoLabels[t]}</span>
                <span className="ia-objecion-count">{g.resueltas}/{g.total}</span>
              </div>
              <div className="ia-objecion-bar-track">
                <div className="ia-objecion-bar-fill" style={{ width: `${pct}%` }} />
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Compute date range fresh each time (no stale memo for "today")
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
      const [metricasRes, costesRes, objecionesRes] = await Promise.all([
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
          .select('*')
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
    } catch (err) {
      console.error('Error cargando métricas:', err)
      setError(err.message || 'Error al cargar métricas')
    } finally {
      setLoading(false)
    }
  }, [agenteId, getDateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRangoChange = ({ rango: r, desde: d, hasta: h }) => {
    if (r !== undefined) setRango(r)
    if (d !== undefined) setDesde(d)
    if (h !== undefined) setHasta(h)
  }

  // ---------- Computed summaries ----------

  const totals = useMemo(() => {
    const sum = (key) => metricas.reduce((s, r) => s + (r[key] || 0), 0)
    const leads = sum('leads_contactados')
    const respuestas = sum('respuestas_recibidas')
    const reuniones = sum('reuniones_agendadas')
    const conversion = leads > 0 ? reuniones / leads : 0
    const objecionesDetectadas = sum('objeciones_detectadas')
    const objecionesResueltas = sum('objeciones_resueltas')
    const calidad = objecionesDetectadas > 0 ? objecionesResueltas / objecionesDetectadas : 0

    const gastoTotal = costes.reduce((s, r) => {
      return s + (r.claude_coste || 0) + (r.haiku_coste || 0) +
        (r.whisper_coste || 0) + (r.gpt4o_coste || 0) + (r.whatsapp_coste || 0)
    }, 0)

    return { leads, respuestas, reuniones, conversion, calidad, gastoTotal }
  }, [metricas, costes])

  // A/B split
  const { metricasA, metricasB } = useMemo(() => {
    if (!agente?.ab_test_activo) return { metricasA: [], metricasB: [] }
    return {
      metricasA: metricas.filter(m => m.ab_version === 'A'),
      metricasB: metricas.filter(m => m.ab_version === 'B'),
    }
  }, [metricas, agente?.ab_test_activo])

  // Aggregate daily for charts (combine A+B if both present)
  const dailyData = useMemo(() => {
    const byDate = {}
    metricas.forEach(m => {
      if (!byDate[m.fecha]) {
        byDate[m.fecha] = {
          fecha: m.fecha,
          leads_contactados: 0,
          respuestas_recibidas: 0,
          reuniones_agendadas: 0,
          mensajes_enviados: 0,
          mensajes_recibidos: 0,
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

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="ia-metricas-loading">
        <Loader2 size={24} className="ia-spin" />
        <span>Cargando métricas...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ia-metricas-error">
        <AlertTriangle size={20} />
        <span>{error}</span>
        <button className="ia-btn ia-btn-secondary" onClick={fetchData}>Reintentar</button>
      </div>
    )
  }

  return (
    <div className="ia-metricas">
      {/* Header + date range */}
      <div className="ia-metricas-toolbar">
        <DateRangeSelector
          rango={rango}
          desde={desde}
          hasta={hasta}
          onChange={handleRangoChange}
        />
        <button className="ia-metricas-refresh" onClick={fetchData} title="Actualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="ia-metricas-cards">
        <SummaryCard
          icon={Users}
          label="Leads contactados"
          value={totals.leads.toLocaleString()}
          color="var(--primary, #3b82f6)"
        />
        <SummaryCard
          icon={MessageSquare}
          label="Respuestas recibidas"
          value={totals.respuestas.toLocaleString()}
          color="#8b5cf6"
        />
        <SummaryCard
          icon={Calendar}
          label="Reuniones agendadas"
          value={totals.reuniones.toLocaleString()}
          color="var(--success, #2ee59d)"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Tasa de conversión"
          value={fmtPct(totals.conversion)}
          color="#f59e0b"
          sub={`${totals.reuniones} / ${totals.leads} leads`}
        />
        <SummaryCard
          icon={Star}
          label="Calidad promedio"
          value={fmtPct(totals.calidad)}
          color="#ec4899"
          sub="Objeciones resueltas"
        />
        <SummaryCard
          icon={DollarSign}
          label="Gasto total"
          value={fmtMoney(totals.gastoTotal)}
          color="var(--error, #ef4444)"
        />
      </div>

      {/* Daily charts */}
      {dailyData.length > 0 && (
        <div className="ia-metricas-charts">
          <BarChart
            data={dailyData}
            dataKey="leads_contactados"
            label="Leads contactados por día"
            color="var(--primary, #3b82f6)"
          />
          <BarChart
            data={dailyData}
            dataKey="respuestas_recibidas"
            label="Respuestas recibidas por día"
            color="#8b5cf6"
          />
          <BarChart
            data={dailyData}
            dataKey="reuniones_agendadas"
            label="Reuniones agendadas por día"
            color="var(--success, #2ee59d)"
          />
          <BarChart
            data={dailyData}
            dataKey="mensajes_enviados"
            label="Mensajes enviados por día"
            color="#f59e0b"
          />
        </div>
      )}

      {dailyData.length === 0 && (
        <div className="ia-metricas-empty">
          <BarChart3 size={32} />
          <p>No hay datos para el periodo seleccionado</p>
        </div>
      )}

      {/* A/B Comparison */}
      {agente?.ab_test_activo && metricasA.length > 0 && metricasB.length > 0 && (
        <ABComparison metricasA={metricasA} metricasB={metricasB} />
      )}

      {/* Objeciones */}
      <ObjecionesSummary objeciones={objeciones} />

      {/* Cost breakdown */}
      {costes.length > 0 && <CostBreakdown costes={costes} />}
    </div>
  )
}
