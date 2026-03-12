import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Eye, MessageSquare, AlertTriangle, DollarSign, Bell, CheckCircle, ExternalLink } from 'lucide-react'
import '../../styles/agentes-ia.css'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="ia-stat-card">
      <div className="ia-stat-icon" style={{ color }}>
        <Icon size={20} />
      </div>
      <div className="ia-stat-info">
        <span className="ia-stat-value">{value}</span>
        <span className="ia-stat-label">{label}</span>
      </div>
    </div>
  )
}

function AlertaBadge({ tipo }) {
  const config = {
    error: { bg: '#ef444420', color: '#ef4444', border: '#ef444430' },
    warning: { bg: '#f59e0b20', color: '#f59e0b', border: '#f59e0b30' },
    info: { bg: '#3b82f620', color: '#3b82f6', border: '#3b82f630' },
  }
  const c = config[tipo] || config.info
  return (
    <span
      className="ia-alerta-badge"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {tipo}
    </span>
  )
}

export default function SupervisorIA() {
  const { tienePermiso } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState([])
  const [conversaciones, setConversaciones] = useState([])
  const [stats, setStats] = useState({
    conversaciones_activas: 0,
    alertas_pendientes: 0,
    mensajes_hoy: 0,
    gasto_hoy: 0,
  })
  const subscriptionRef = useRef(null)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const hoy = new Date().toISOString().split('T')[0]

      const [alertasRes, convsRes, metricasRes, costesRes] = await Promise.all([
        supabase
          .from('ia_alertas_supervisor')
          .select('*')
          .eq('leida', false)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('ia_conversaciones')
          .select(`
            *,
            lead:ia_leads(id, nombre, telefono, email, sentimiento_actual, lead_score),
            agente:ia_agentes(id, nombre)
          `)
          .in('estado', ['needs_reply', 'waiting_reply', 'qualify', 'meeting_pref', 'handoff_humano', 'scheduled_followup'])
          .order('updated_at', { ascending: false })
          .limit(100),
        supabase
          .from('ia_metricas_diarias')
          .select('mensajes_enviados, mensajes_recibidos')
          .eq('fecha', hoy),
        supabase
          .from('ia_costes')
          .select('coste_total')
          .eq('fecha', hoy),
      ])

      setAlertas(alertasRes.data || [])
      setConversaciones(convsRes.data || [])

      const mensajesHoy = (metricasRes.data || []).reduce(
        (sum, m) => sum + (m.mensajes_enviados || 0) + (m.mensajes_recibidos || 0), 0
      )
      const gastoHoy = (costesRes.data || []).reduce(
        (sum, c) => sum + parseFloat(c.coste_total || 0), 0
      )

      setStats({
        conversaciones_activas: convsRes.data?.length || 0,
        alertas_pendientes: alertasRes.data?.length || 0,
        mensajes_hoy: mensajesHoy,
        gasto_hoy: gastoHoy,
      })
    } catch (err) {
      console.error('Error cargando datos supervisor:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Realtime subscription for alerts
  useEffect(() => {
    cargarDatos()

    const channelId = `ia-supervisor-alertas-${Date.now()}`
    subscriptionRef.current = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ia_alertas_supervisor',
        },
        (payload) => {
          setAlertas(prev => [payload.new, ...prev])
          setStats(prev => ({
            ...prev,
            alertas_pendientes: prev.alertas_pendientes + 1,
          }))
        }
      )
      .subscribe()

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [cargarDatos])

  const marcarLeida = async (alertaId) => {
    try {
      const { error } = await supabase
        .from('ia_alertas_supervisor')
        .update({ leida: true })
        .eq('id', alertaId)
      if (error) throw error
      setAlertas(prev => prev.filter(a => a.id !== alertaId))
      setStats(prev => ({
        ...prev,
        alertas_pendientes: Math.max(0, prev.alertas_pendientes - 1),
      }))
    } catch (err) {
      console.error('Error marcando alerta como leida:', err)
    }
  }

  const formatTime = (ts) => {
    if (!ts) return '--'
    return new Date(ts).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  if (!tienePermiso('ventas.agentes_ia.ver')) {
    return (
      <div className="ia-page">
        <div className="ia-error">No tienes permiso para ver esta seccion.</div>
      </div>
    )
  }

  return (
    <div className="ia-page">
      <div className="ia-header">
        <div className="ia-header-left">
          <Eye size={28} />
          <h1>Supervisor IA</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="ia-stats-grid">
        <StatCard icon={MessageSquare} label="Conversaciones activas" value={stats.conversaciones_activas} color="#3b82f6" />
        <StatCard icon={AlertTriangle} label="Alertas pendientes" value={stats.alertas_pendientes} color={stats.alertas_pendientes > 0 ? '#ef4444' : '#6b7280'} />
        <StatCard icon={Bell} label="Mensajes hoy" value={stats.mensajes_hoy} color="#10b981" />
        <StatCard icon={DollarSign} label="Gasto hoy" value={`$${stats.gasto_hoy.toFixed(2)}`} color="#f59e0b" />
      </div>

      {loading ? (
        <div className="ia-loading">
          <div className="ia-spinner" />
          <span>Cargando supervisor...</span>
        </div>
      ) : (
        <>
          {/* Alertas */}
          {alertas.length > 0 && (
            <div className="ia-supervisor-section">
              <h2 className="ia-supervisor-section-title">
                <AlertTriangle size={18} />
                Alertas pendientes ({alertas.length})
              </h2>
              <div className="ia-table-wrapper">
                <table className="ia-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Agente</th>
                      <th>Tipo</th>
                      <th>Mensaje</th>
                      <th>Conversacion</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map(alerta => (
                      <tr key={alerta.id} className="ia-table-row">
                        <td className="ia-fecha">{formatTime(alerta.created_at)}</td>
                        <td>{alerta.agente_nombre || alerta.agente_id?.slice(0, 8) || '--'}</td>
                        <td><AlertaBadge tipo={alerta.tipo || 'info'} /></td>
                        <td style={{ maxWidth: 300 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {alerta.mensaje || '--'}
                          </span>
                        </td>
                        <td>
                          {alerta.conversacion_id && alerta.agente_id ? (
                            <button
                              className="ia-btn ia-btn-sm ia-btn-secondary"
                              onClick={() => navigate(`/ventas/agentes-ia/${alerta.agente_id}`)}
                            >
                              <ExternalLink size={12} />
                              Ver
                            </button>
                          ) : '--'}
                        </td>
                        <td>
                          <button
                            className="ia-btn ia-btn-sm ia-btn-secondary"
                            onClick={() => marcarLeida(alerta.id)}
                            title="Marcar como leida"
                          >
                            <CheckCircle size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Conversaciones activas */}
          <div className="ia-supervisor-section">
            <h2 className="ia-supervisor-section-title">
              <MessageSquare size={18} />
              Conversaciones activas ({conversaciones.length})
            </h2>
            {conversaciones.length === 0 ? (
              <div className="ia-empty">
                <MessageSquare size={48} strokeWidth={1.5} />
                <h2>Sin conversaciones activas</h2>
                <p>No hay conversaciones en curso en este momento.</p>
              </div>
            ) : (
              <div className="ia-table-wrapper">
                <table className="ia-table">
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Lead</th>
                      <th>Telefono</th>
                      <th>Estado</th>
                      <th>Step</th>
                      <th>Ultima actividad</th>
                      <th>Score</th>
                      <th>Sentimiento</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversaciones.map(conv => (
                      <tr key={conv.id} className="ia-table-row">
                        <td>
                          <span style={{ fontWeight: 600 }}>{conv.agente?.nombre || '--'}</span>
                        </td>
                        <td>{conv.lead?.nombre || 'Sin nombre'}</td>
                        <td className="ia-fecha">{conv.lead?.telefono || '--'}</td>
                        <td>
                          <span
                            className="ia-tipo-badge"
                            style={{
                              background: conv.estado === 'needs_reply' ? '#ef444420' :
                                conv.estado === 'handoff_humano' ? '#f59e0b20' : '#3b82f620',
                              color: conv.estado === 'needs_reply' ? '#ef4444' :
                                conv.estado === 'handoff_humano' ? '#f59e0b' : '#3b82f6',
                            }}
                          >
                            {conv.estado}
                          </span>
                        </td>
                        <td>{conv.step_actual || '--'}</td>
                        <td className="ia-fecha">{formatTime(conv.updated_at)}</td>
                        <td>
                          <span style={{
                            fontWeight: 600,
                            color: (conv.lead?.lead_score || 0) >= 60 ? '#10b981' :
                              (conv.lead?.lead_score || 0) >= 30 ? '#f59e0b' : '#ef4444'
                          }}>
                            {conv.lead?.lead_score ?? '--'}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{conv.lead?.sentimiento_actual || '--'}</td>
                        <td>
                          <button
                            className="ia-btn ia-btn-sm ia-btn-secondary"
                            onClick={() => navigate(`/ventas/agentes-ia/${conv.agente_id}`)}
                          >
                            <ExternalLink size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
