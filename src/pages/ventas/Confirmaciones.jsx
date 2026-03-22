import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  CalendarCheck, CheckCircle, AlertTriangle, RefreshCw, Phone, Mail,
  TrendingUp, Calendar, Filter, User, ChevronDown, Edit3, X, Save,
} from 'lucide-react'
import '../../styles/ventas-dashboard-widgets.css'

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(d) {
  const date = new Date(d)
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  return `${dias[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`
}

function fmtTime(d) {
  const date = new Date(d)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function fmtShortDate(d) {
  const date = new Date(d)
  return `${date.getDate()}/${date.getMonth() + 1}`
}

function RiskBadge({ score }) {
  const style = { padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'inline-block' }
  if (score >= 70) return <span style={{ ...style, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>Alto {score}%</span>
  if (score >= 50) return <span style={{ ...style, background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>Medio {score}%</span>
  return <span style={{ ...style, background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>Bajo {score}%</span>
}

function StepDot({ estado }) {
  const colors = {
    enviado: '#3B82F6', entregado: '#3B82F6',
    respondido: '#10B981', confirmado: '#10B981',
    reagendado: '#F59E0B',
    cancelado: '#4B5563', saltado: '#4B5563',
  }
  const color = colors[estado]
  const filled = !!color
  return (
    <span
      title={estado || 'pendiente'}
      style={{
        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
        background: filled ? color : 'transparent',
        border: filled ? 'none' : '2px solid var(--border)',
        boxSizing: 'border-box',
        transition: 'all 0.2s',
      }}
    />
  )
}

function KPICard({ icon, label, value, color, subtitle }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div>}
    </div>
  )
}

const PASO_ORDER = ['confirmacion', 'micro_compromiso', 'prueba_social', 'video_closer', 'recurso_valor', 'd1_escasez', 'd1_email', 'd0_2h', 'd0_15m', 'noshow_5m', 'noshow_30m', 'noshow_24h', 'post_asistencia']

const PASO_LABELS = {
  confirmacion: 'Confirm.', micro_compromiso: 'Micro', prueba_social: 'Social',
  video_closer: 'Vídeo', recurso_valor: 'Recurso', d1_escasez: 'D-1',
  d1_email: 'D-1 📧', d0_2h: '-2h', d0_15m: '-15m',
  noshow_5m: 'NS+5', noshow_30m: 'NS+30', noshow_24h: 'NS+24h', post_asistencia: 'Post',
}

// ── Main Component ───────────────────────────────────────────────────────

export default function Confirmaciones() {
  const [tab, setTab] = useState('hoy')
  const [citas, setCitas] = useState([])
  const [metricas, setMetricas] = useState({ asistencia: 0, confirmadas: 0, noShows: 0, total: 0, porCloser: [], porDia: [] })
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState([])
  const [filtroCloser, setFiltroCloser] = useState('')
  const [closers, setClosers] = useState([])

  const cargarCitas = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('ventas_citas')
        .select(`
          id, fecha_hora, estado, duracion_minutos, google_meet_url,
          noshow_risk_score, noshow_confirmado, noshow_secuencia_activa, noshow_token,
          origen_agendacion, estado_reunion_id,
          lead:ventas_leads(id, nombre, telefono, email, categoria:ventas_categorias(nombre)),
          closer:usuarios!ventas_citas_closer_id_fkey(id, nombre),
          confirmaciones:ventas_cita_confirmaciones(id, paso, estado, enviado_at, respondido_at, respuesta)
        `)
        .in('estado', ['agendada', 'cancelada'])
        .order('fecha_hora', { ascending: true })

      if (tab === 'hoy') {
        const today = new Date()
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString()
        query = query.gte('fecha_hora', start).lt('fecha_hora', tomorrow).eq('estado', 'agendada')
      } else if (tab === 'pipeline') {
        query = query.gt('fecha_hora', new Date().toISOString()).eq('estado', 'agendada')
      }

      if (filtroCloser) {
        query = query.eq('closer_id', filtroCloser)
      }

      const { data, error } = await query
      if (error) throw error
      setCitas(data || [])
    } catch (err) {
      console.error('Error loading citas:', err)
    } finally {
      setLoading(false)
    }
  }, [tab, filtroCloser])

  const cargarMetricas = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('ventas_citas')
        .select('id, estado, noshow_confirmado, estado_reunion_id, closer_id, fecha_hora, closer:usuarios!ventas_citas_closer_id_fkey(nombre)')
        .gte('fecha_hora', thirtyDaysAgo)
        .lte('fecha_hora', new Date().toISOString())

      if (!data) return

      const total = data.length
      const confirmadas = data.filter(c => c.noshow_confirmado).length
      const asistieron = data.filter(c => c.estado_reunion_id != null).length
      const noShows = Math.max(0, total - asistieron)

      // Por closer
      const closerMap = {}
      data.forEach(c => {
        const name = c.closer?.nombre || 'Sin closer'
        if (!closerMap[name]) closerMap[name] = { nombre: name, total: 0, asistieron: 0 }
        closerMap[name].total++
        if (c.estado_reunion_id) closerMap[name].asistieron++
      })
      const porCloser = Object.values(closerMap).map(c => ({
        ...c,
        tasa: c.total > 0 ? Math.round(c.asistieron / c.total * 100) : 0,
      }))

      // Por día de la semana
      const diasMap = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' }
      const diaStats = {}
      data.forEach(c => {
        const d = new Date(c.fecha_hora).getDay()
        if (!diaStats[d]) diaStats[d] = { dia: diasMap[d], total: 0, asistieron: 0 }
        diaStats[d].total++
        if (c.estado_reunion_id) diaStats[d].asistieron++
      })
      const porDia = Object.values(diaStats).map(d => ({
        ...d,
        tasa: d.total > 0 ? Math.round(d.asistieron / d.total * 100) : 0,
      }))

      setMetricas({
        total, confirmadas, noShows,
        asistencia: total > 0 ? Math.round(asistieron / total * 100) : 0,
        porCloser, porDia,
      })
    } catch (err) {
      console.error('Error loading metrics:', err)
    }
  }, [])

  const cargarClosers = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_roles_comerciales')
      .select('usuario_id, usuario:usuarios(id, nombre)')
      .eq('rol', 'closer').eq('activo', true)
    setClosers((data || []).map(r => r.usuario).filter(Boolean))
  }, [])

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase.from('ventas_noshow_config').select('*').order('orden')
    setConfig(data || [])
  }, [])

  useEffect(() => { cargarCitas() }, [cargarCitas])
  useEffect(() => { cargarMetricas(); cargarClosers() }, [cargarMetricas, cargarClosers])
  useEffect(() => { if (tab === 'config') cargarConfig() }, [tab, cargarConfig])

  const tabs = [
    { id: 'hoy', label: 'Hoy y mañana' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'metricas', label: 'Métricas' },
    { id: 'config', label: 'Configuración' },
  ]

  return (
    <div className="db-page">
      {/* Toolbar */}
      <div className="db-toolbar">
        <div className="db-toolbar-filters" style={{ gap: 12 }}>
          <CalendarCheck size={20} style={{ color: 'var(--text-muted)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Confirmaciones</h1>
          {(tab === 'hoy' || tab === 'pipeline') && (
            <select
              value={filtroCloser}
              onChange={e => setFiltroCloser(e.target.value)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 10px', color: 'var(--text)',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              <option value="">Todos los closers</option>
              {closers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
        </div>
        <div className="db-toolbar-actions">
          <button className="db-toolbar-btn" onClick={() => { cargarCitas(); cargarMetricas() }}>
            <RefreshCw size={14} /> <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-sm)' }}>
        <KPICard
          icon={<TrendingUp size={18} />}
          label="Asistencia 30d"
          value={`${metricas.asistencia}%`}
          color={metricas.asistencia >= 80 ? '#10B981' : metricas.asistencia >= 60 ? '#F59E0B' : '#EF4444'}
          subtitle={`${metricas.total - metricas.noShows} de ${metricas.total} asistieron`}
        />
        <KPICard
          icon={<CheckCircle size={18} />}
          label="Confirmadas D-1"
          value={metricas.confirmadas}
          color="#3B82F6"
          subtitle={metricas.total > 0 ? `${Math.round(metricas.confirmadas / metricas.total * 100)}% del total` : ''}
        />
        <KPICard
          icon={<AlertTriangle size={18} />}
          label="No-shows 30d"
          value={metricas.noShows}
          color={metricas.noShows > 5 ? '#EF4444' : metricas.noShows > 2 ? '#F59E0B' : '#10B981'}
          subtitle={metricas.total > 0 ? `${Math.round(metricas.noShows / metricas.total * 100)}% del total` : ''}
        />
        <KPICard
          icon={<Calendar size={18} />}
          label="Total citas 30d"
          value={metricas.total}
          color="var(--text)"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 500, fontSize: 13, transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'metricas' ? (
        <MetricasTab metricas={metricas} />
      ) : tab === 'config' ? (
        <ConfigTab config={config} onUpdate={cargarConfig} />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</div>
      ) : citas.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', padding: 48, textAlign: 'center',
        }}>
          <CalendarCheck size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {tab === 'hoy' ? 'No hay citas para hoy ni mañana' : 'No hay citas futuras'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {citas.map(cita => <CitaCard key={cita.id} cita={cita} />)}
        </div>
      )}
    </div>
  )
}

// ── Cita Card ────────────────────────────────────────────────────────────

function CitaCard({ cita }) {
  const lead = cita.lead || {}
  const closer = cita.closer || {}
  const confs = cita.confirmaciones || []
  const cat = lead.categoria?.nombre || ''
  const sentCount = confs.filter(c => c.estado !== 'programado' && c.estado !== 'cancelado' && c.estado !== 'saltado').length

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', padding: '12px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Date/time */}
        <div style={{ minWidth: 55, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(cita.fecha_hora)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(cita.fecha_hora).split(' ')[0]} {fmtShortDate(cita.fecha_hora)}</div>
        </div>

        <div style={{ width: 1, height: 40, background: 'var(--border)' }} />

        {/* Lead info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{lead.nombre || 'Sin nombre'}</span>
            {cat && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-active)', color: 'var(--text-muted)' }}>{cat}</span>}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {closer.nombre || '?'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
            {lead.telefono && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} /> {lead.telefono}</span>}
            {lead.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10} /> {lead.email}</span>}
          </div>
        </div>

        {/* Steps progress */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {PASO_ORDER.map(paso => {
              const conf = confs.find(c => c.paso === paso)
              return <StepDot key={paso} estado={conf?.estado} />
            })}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sentCount}/{PASO_ORDER.length} enviados</span>
        </div>

        {/* Status */}
        <div style={{ minWidth: 110, textAlign: 'right' }}>
          {cita.noshow_confirmado ? (
            <span style={{ color: '#10B981', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <CheckCircle size={14} /> Confirmada
            </span>
          ) : cita.noshow_secuencia_activa ? (
            <RiskBadge score={cita.noshow_risk_score} />
          ) : (
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--bg-active)', color: 'var(--text-muted)' }}>Sin secuencia</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Métricas Tab ─────────────────────────────────────────────────────────

function MetricasTab({ metricas }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
      {/* Embudo */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Embudo de asistencia (30d)</h3>
        <FunnelBar label="Agendadas" value={metricas.total} max={metricas.total} color="#3B82F6" />
        <FunnelBar label="Confirmadas D-1" value={metricas.confirmadas} max={metricas.total} color="#8B5CF6" />
        <FunnelBar label="Asistieron" value={metricas.total - metricas.noShows} max={metricas.total} color="#10B981" />
        <FunnelBar label="No-show" value={metricas.noShows} max={metricas.total} color="#EF4444" />
      </div>

      {/* Por closer */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Asistencia por closer</h3>
        {metricas.porCloser.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin datos</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>Closer</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>Citas</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>Asistieron</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}>Tasa</th>
              </tr>
            </thead>
            <tbody>
              {metricas.porCloser.map(c => (
                <tr key={c.nombre} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0', fontWeight: 500 }}>{c.nombre}</td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontVariantNumeric: 'tabular-nums' }}>{c.total}</td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontVariantNumeric: 'tabular-nums' }}>{c.asistieron}</td>
                  <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600, color: c.tasa >= 80 ? '#10B981' : c.tasa >= 60 ? '#F59E0B' : '#EF4444' }}>{c.tasa}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Por día */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: 20, gridColumn: '1 / -1' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Asistencia por día de la semana</h3>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => {
            const stat = metricas.porDia.find(d => d.dia === dia) || { total: 0, tasa: 0 }
            const barH = Math.max(4, stat.tasa * 1.2)
            return (
              <div key={dia} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 8 }}>
                  <div style={{
                    width: '60%', height: barH, borderRadius: '4px 4px 0 0',
                    background: stat.tasa >= 80 ? '#10B981' : stat.tasa >= 60 ? '#F59E0B' : stat.total > 0 ? '#EF4444' : 'var(--bg-active)',
                    transition: 'height 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{stat.tasa > 0 ? `${stat.tasa}%` : '-'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dia}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{stat.total > 0 ? `${stat.total} citas` : ''}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FunnelBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-active)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, borderRadius: 4, background: color, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

// ── Config Tab ───────────────────────────────────────────────────────────

function ConfigTab({ config, onUpdate }) {
  const [editing, setEditing] = useState(null)
  const [editText, setEditText] = useState('')

  const togglePaso = async (paso, activo) => {
    await supabase.from('ventas_noshow_config').update({ activo: !activo }).eq('paso', paso)
    onUpdate()
  }

  const startEdit = (step) => {
    setEditing(step.paso)
    setEditText(step.template_whatsapp || step.descripcion)
  }

  const saveEdit = async (paso) => {
    await supabase.from('ventas_noshow_config').update({ template_whatsapp: editText }).eq('paso', paso)
    setEditing(null)
    onUpdate()
  }

  const CANAL_ICONS = {
    whatsapp: '💬', email: '📧', whatsapp_email: '💬📧', whatsapp_sms: '💬📱',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-xs)' }}>
        Activa o desactiva pasos. Haz click en el lápiz para editar el template de WhatsApp.
      </p>
      {config.map(step => (
        <div
          key={step.paso}
          style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', padding: '12px 16px',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            opacity: step.activo ? 1 : 0.5, transition: 'opacity 0.2s',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13, minWidth: 22, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{step.orden}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>{step.descripcion}</span>
              <span style={{ fontSize: 12 }}>{CANAL_ICONS[step.canal] || step.canal}</span>
            </div>
            {editing === step.paso ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={3}
                  style={{
                    flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: 8, color: 'var(--text)', fontSize: 12,
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={() => saveEdit(step.paso)} style={{ background: 'var(--success)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: '#000' }}><Save size={12} /></button>
                  <button onClick={() => setEditing(null)} style={{ background: 'var(--bg-active)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {step.timing_tipo === 'offset_after' && `+${step.timing_valor}m tras agendar`}
                  {step.timing_tipo === 'fixed_time_before' && `${step.timing_valor}m antes de la cita`}
                  {step.timing_tipo === 'fixed_time_day_before' && `${String(Math.floor(step.timing_valor / 100)).padStart(2, '0')}:${String(step.timing_valor % 100).padStart(2, '0')} día anterior`}
                  {step.timing_tipo === 'offset_after_noshow' && `+${step.timing_valor}m tras no-show`}
                </span>
                {step.canal.includes('whatsapp') && (
                  <button
                    onClick={() => startEdit(step)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                    title="Editar template"
                  >
                    <Edit3 size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => togglePaso(step.paso, step.activo)}
            style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600,
              minWidth: 80, borderRadius: 6, border: 'none', cursor: 'pointer',
              transition: 'all 0.15s',
              background: step.activo ? 'var(--success)' : 'var(--bg-active)',
              color: step.activo ? '#000' : 'var(--text-muted)',
            }}
          >
            {step.activo ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      ))}
    </div>
  )
}
