import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  CalendarCheck, CheckCircle, AlertTriangle, RefreshCw, Phone, Mail, TrendingUp, Calendar,
} from 'lucide-react'
import '../../styles/ventas-dashboard-widgets.css'

function formatDateShort(d) {
  const date = new Date(d)
  return `${date.getDate()}/${date.getMonth() + 1}`
}

function formatTime(d) {
  const date = new Date(d)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function RiskBadge({ score }) {
  if (score >= 70) return <span className="db-wtable-estado" style={{ background: 'var(--error)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Alto {score}%</span>
  if (score >= 50) return <span className="db-wtable-estado" style={{ background: 'var(--warning)', color: '#000', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Medio {score}%</span>
  return <span className="db-wtable-estado" style={{ background: 'var(--success)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Bajo {score}%</span>
}

function StepDot({ estado }) {
  const colors = {
    enviado: 'var(--primary)', entregado: 'var(--primary)',
    respondido: 'var(--success)', confirmado: 'var(--success)',
    reagendado: 'var(--warning)',
    cancelado: 'var(--text-muted)', saltado: 'var(--text-muted)',
  }
  const color = colors[estado] || 'var(--bg-active)'
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} title={estado || 'pendiente'} />
}

export default function Confirmaciones() {
  const [tab, setTab] = useState('hoy')
  const [citas, setCitas] = useState([])
  const [metricas, setMetricas] = useState({ asistencia: 0, confirmadas: 0, noShows: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState([])

  const cargarCitas = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('ventas_citas')
        .select(`
          id, fecha_hora, estado, duracion_minutos, google_meet_url,
          noshow_risk_score, noshow_confirmado, noshow_secuencia_activa, noshow_token,
          lead:ventas_leads(id, nombre, telefono, email, categoria:ventas_categorias(nombre)),
          closer:usuarios!ventas_citas_closer_id_fkey(id, nombre),
          confirmaciones:ventas_cita_confirmaciones(id, paso, estado, enviado_at, respondido_at, respuesta)
        `)
        .eq('estado', 'agendada')
        .gt('fecha_hora', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('fecha_hora', { ascending: true })

      if (tab === 'hoy') {
        const today = new Date()
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
        query = query.gte('fecha_hora', start).lt('fecha_hora', end)
      }

      const { data, error } = await query
      if (error) throw error
      setCitas(data || [])
    } catch (err) {
      console.error('Error loading citas:', err)
    } finally {
      setLoading(false)
    }
  }, [tab])

  const cargarMetricas = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('ventas_citas')
        .select('id, estado, noshow_confirmado, estado_reunion_id')
        .gte('fecha_hora', thirtyDaysAgo)
        .lte('fecha_hora', new Date().toISOString())

      if (data) {
        const total = data.length
        const confirmadas = data.filter(c => c.noshow_confirmado).length
        const { data: realizadas } = await supabase
          .from('ventas_citas')
          .select('id')
          .gte('fecha_hora', thirtyDaysAgo)
          .lte('fecha_hora', new Date().toISOString())
          .not('estado_reunion_id', 'is', null)

        const asistieron = realizadas?.length || 0
        setMetricas({
          total,
          confirmadas,
          asistencia: total > 0 ? Math.round(asistieron / total * 100) : 0,
          noShows: Math.max(0, total - asistieron),
        })
      }
    } catch (err) {
      console.error('Error loading metrics:', err)
    }
  }, [])

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase.from('ventas_noshow_config').select('*').order('orden')
    setConfig(data || [])
  }, [])

  useEffect(() => { cargarCitas() }, [cargarCitas])
  useEffect(() => { cargarMetricas() }, [cargarMetricas])
  useEffect(() => { if (tab === 'config') cargarConfig() }, [tab, cargarConfig])

  const tabs = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'config', label: 'Configuración' },
  ]

  return (
    <div className="db-page">
      {/* Toolbar */}
      <div className="db-toolbar">
        <div className="db-toolbar-filters">
          <CalendarCheck size={20} style={{ color: 'var(--text-muted)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Confirmaciones</h1>
        </div>
        <div className="db-toolbar-actions">
          <button className="db-toolbar-btn" onClick={() => { cargarCitas(); cargarMetricas() }}>
            <RefreshCw size={14} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* KPIs — using widget shell style */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-sm)' }}>
        <KPICard icon={<TrendingUp size={18} />} label="Asistencia 30d" value={`${metricas.asistencia}%`} color="var(--success)" />
        <KPICard icon={<CheckCircle size={18} />} label="Confirmadas D-1" value={metricas.confirmadas} color="var(--primary)" />
        <KPICard icon={<AlertTriangle size={18} />} label="No-shows 30d" value={metricas.noShows} color="var(--warning)" />
        <KPICard icon={<Calendar size={18} />} label="Total citas 30d" value={metricas.total} color="var(--text-muted)" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none',
              color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="db-loading">Cargando...</div>
      ) : tab === 'config' ? (
        <ConfigTab config={config} onUpdate={cargarConfig} />
      ) : citas.length === 0 ? (
        <div className="db-widget-empty" style={{ padding: 48 }}>
          {tab === 'hoy' ? 'No hay citas para hoy' : 'No hay citas futuras'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {citas.map(cita => <CitaCard key={cita.id} cita={cita} />)}
        </div>
      )}
    </div>
  )
}

function KPICard({ icon, label, value, color }) {
  return (
    <div className="db-wshell" style={{ padding: 0 }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      </div>
    </div>
  )
}

const PASO_ORDER = ['confirmacion', 'micro_compromiso', 'prueba_social', 'video_closer', 'recurso_valor', 'd1_escasez', 'd1_email', 'd0_2h', 'd0_15m', 'noshow_5m', 'noshow_30m', 'noshow_24h', 'post_asistencia']

function CitaCard({ cita }) {
  const lead = cita.lead || {}
  const closer = cita.closer || {}
  const confs = cita.confirmaciones || []

  return (
    <div className="db-wshell" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Date/time */}
        <div style={{ minWidth: 55, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatTime(cita.fecha_hora)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateShort(cita.fecha_hora)}</div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 36, background: 'var(--border)' }} />

        {/* Lead info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{lead.nombre || 'Sin nombre'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>con {closer.nombre || '?'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
            {lead.telefono && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} /> {lead.telefono}</span>}
            {lead.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10} /> {lead.email}</span>}
          </div>
        </div>

        {/* Steps progress */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {PASO_ORDER.map(paso => {
            const conf = confs.find(c => c.paso === paso)
            return <StepDot key={paso} estado={conf?.estado} />
          })}
        </div>

        {/* Status */}
        <div style={{ minWidth: 100, textAlign: 'right' }}>
          {cita.noshow_confirmado ? (
            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <CheckCircle size={13} /> Confirmada
            </span>
          ) : cita.noshow_secuencia_activa ? (
            <RiskBadge score={cita.noshow_risk_score} />
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sin secuencia</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfigTab({ config, onUpdate }) {
  const togglePaso = async (paso, activo) => {
    await supabase.from('ventas_noshow_config').update({ activo: !activo }).eq('paso', paso)
    onUpdate()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-xs)' }}>
        Activa o desactiva pasos de la secuencia. Los cambios aplican a citas nuevas.
      </p>
      {config.map(step => (
        <div
          key={step.paso}
          className="db-wshell"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: step.activo ? 1 : 0.5,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13, minWidth: 20, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{step.orden}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{step.descripcion}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 12, marginTop: 2 }}>
              <span>{step.canal}</span>
              <span>{step.timing_tipo}: {step.timing_valor}m</span>
            </div>
          </div>
          <button
            onClick={() => togglePaso(step.paso, step.activo)}
            className={`db-toolbar-btn ${step.activo ? 'db-toolbar-btn--save' : ''}`}
            style={{ padding: '4px 12px', fontSize: 11, minWidth: 70 }}
          >
            {step.activo ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      ))}
    </div>
  )
}
