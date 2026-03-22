import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  CalendarCheck, Clock, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Send, ArrowRight, Phone, Mail, User, TrendingUp,
} from 'lucide-react'
import '../../styles/ventas-crm.css'

function formatDate(d) {
  const date = new Date(d)
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  return `${dias[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function RiskBadge({ score }) {
  if (score >= 70) return <span className="crm-card-cat" style={{ background: '#EF4444', color: '#fff' }}>Riesgo alto {score}%</span>
  if (score >= 50) return <span className="crm-card-cat" style={{ background: '#F59E0B', color: '#000' }}>Riesgo medio {score}%</span>
  return <span className="crm-card-cat" style={{ background: '#10B981', color: '#fff' }}>Riesgo bajo {score}%</span>
}

function StepDot({ estado }) {
  if (estado === 'enviado' || estado === 'entregado') return <span title="Enviado" style={{ color: '#3B82F6' }}>●</span>
  if (estado === 'respondido' || estado === 'confirmado') return <span title="Confirmado" style={{ color: '#10B981' }}>●</span>
  if (estado === 'reagendado') return <span title="Reagendado" style={{ color: '#F59E0B' }}>●</span>
  if (estado === 'cancelado' || estado === 'saltado') return <span title="Saltado" style={{ color: '#6B7280' }}>○</span>
  return <span title="Pendiente" style={{ color: '#374151' }}>○</span>
}

export default function Confirmaciones() {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('hoy')
  const [citas, setCitas] = useState([])
  const [metricas, setMetricas] = useState({ asistencia: 0, confirmadas: 0, reagendadas: 0, noShows: 0, total: 0 })
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

        setMetricas({
          total,
          confirmadas,
          asistencia: total > 0 ? Math.round((realizadas?.length || 0) / total * 100) : 0,
          reagendadas: 0,
          noShows: total - (realizadas?.length || 0) - data.filter(c => c.estado !== 'agendada').length,
        })
      }
    } catch (err) {
      console.error('Error loading metrics:', err)
    }
  }, [])

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_noshow_config')
      .select('*')
      .order('orden')
    setConfig(data || [])
  }, [])

  useEffect(() => { cargarCitas() }, [cargarCitas])
  useEffect(() => { cargarMetricas() }, [cargarMetricas])
  useEffect(() => { if (tab === 'config') cargarConfig() }, [tab, cargarConfig])

  return (
    <div className="crm-page" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CalendarCheck size={24} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Confirmaciones</h1>
        </div>
        <button
          className="ui-btn ui-btn--secondary ui-btn--sm"
          onClick={() => { cargarCitas(); cargarMetricas() }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} /> Refrescar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard icon={<TrendingUp size={20} />} label="Asistencia 30d" value={`${metricas.asistencia}%`} color="#10B981" />
        <KPICard icon={<CheckCircle size={20} />} label="Confirmadas D-1" value={metricas.confirmadas} color="#3B82F6" />
        <KPICard icon={<AlertTriangle size={20} />} label="No-shows 30d" value={metricas.noShows} color="#F59E0B" />
        <KPICard icon={<CalendarCheck size={20} />} label="Total citas 30d" value={metricas.total} color="#8B5CF6" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['hoy', 'pipeline', 'config'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: tab === t ? 'var(--accent)' : 'var(--bg-secondary)',
              color: tab === t ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              textTransform: 'capitalize',
            }}
          >
            {t === 'hoy' ? 'Hoy' : t === 'pipeline' ? 'Pipeline' : 'Configuración'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</div>
      ) : tab === 'config' ? (
        <ConfigTab config={config} onUpdate={cargarConfig} />
      ) : citas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          {tab === 'hoy' ? 'No hay citas para hoy' : 'No hay citas futuras'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {citas.map(cita => (
            <CitaCard key={cita.id} cita={cita} />
          ))}
        </div>
      )}
    </div>
  )
}

function KPICard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      padding: '16px 20px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color }}>
        {icon}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function CitaCard({ cita }) {
  const lead = cita.lead || {}
  const closer = cita.closer || {}
  const confs = cita.confirmaciones || []
  const citaDate = new Date(cita.fecha_hora)
  const isPast = citaDate < new Date()

  const pasoOrder = ['confirmacion', 'micro_compromiso', 'prueba_social', 'video_closer', 'recurso_valor', 'd1_escasez', 'd1_email', 'd0_2h', 'd0_15m', 'noshow_5m', 'noshow_30m', 'noshow_24h', 'post_asistencia']

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      padding: 16,
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Time */}
      <div style={{ minWidth: 70, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{formatDate(cita.fecha_hora).split(' ')[1]}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(cita.fecha_hora).split(' ')[0]}</div>
      </div>

      {/* Lead info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{lead.nombre || 'Sin nombre'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>con {closer.nombre || '?'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          {lead.telefono && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} /> {lead.telefono}</span>}
          {lead.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={11} /> {lead.email}</span>}
        </div>
      </div>

      {/* Steps progress */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', fontSize: 14 }}>
        {pasoOrder.map(paso => {
          const conf = confs.find(c => c.paso === paso)
          return <StepDot key={paso} estado={conf?.estado || 'programado'} />
        })}
      </div>

      {/* Status */}
      <div style={{ minWidth: 120, textAlign: 'right' }}>
        {cita.noshow_confirmado ? (
          <span style={{ color: '#10B981', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <CheckCircle size={14} /> Confirmada
          </span>
        ) : cita.noshow_secuencia_activa ? (
          <RiskBadge score={cita.noshow_risk_score} />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sin secuencia</span>
        )}
      </div>
    </div>
  )
}

function ConfigTab({ config, onUpdate }) {
  const togglePaso = async (paso, activo) => {
    await supabase
      .from('ventas_noshow_config')
      .update({ activo: !activo })
      .eq('paso', paso)
    onUpdate()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
        Activa o desactiva pasos de la secuencia. Los cambios aplican a citas nuevas.
      </div>
      {config.map(step => (
        <div
          key={step.paso}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 10,
            padding: '12px 16px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: step.activo ? 1 : 0.5,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 24, color: 'var(--text-muted)' }}>{step.orden}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{step.descripcion}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, marginTop: 2 }}>
              <span>{step.canal}</span>
              <span>{step.timing_tipo}: {step.timing_valor}m</span>
            </div>
          </div>
          <button
            onClick={() => togglePaso(step.paso, step.activo)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: step.activo ? '#10B981' : 'var(--bg-active)',
              color: step.activo ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {step.activo ? 'Activo' : 'Inactivo'}
          </button>
        </div>
      ))}
    </div>
  )
}
