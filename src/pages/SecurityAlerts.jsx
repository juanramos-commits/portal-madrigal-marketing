import { logger } from '../lib/logger'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

const SEVERIDAD_CONFIG = {
  critica: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Crítica' },
  alta: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Alta' },
  media: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Media' },
  baja: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Baja' }
}

const TIPO_LABELS = {
  login_fallido_multiple: 'Logins fallidos',
  escalacion_privilegios: 'Escalación privilegios',
  acceso_denegado_rls: 'Acceso denegado',
  mfa_desactivado_admin: 'MFA desactivado',
  usuario_desactivado: 'Usuario desactivado',
  cambio_rol_critico: 'Cambio de rol',
  cambio_tipo_usuario: 'Cambio de tipo'
}

export default function SecurityAlerts() {
  const { usuario } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [filtroSeveridad, setFiltroSeveridad] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('pendientes')
  const [resolviendo, setResolviendo] = useState(null)
  const [notasResolucion, setNotasResolucion] = useState('')
  const [contadores, setContadores] = useState({ critica: 0, alta: 0, media: 0, baja: 0 })

  useEffect(() => {
    loadAlerts()
    loadContadores()
  }, [page, filtroSeveridad, filtroTipo, filtroEstado])

  const loadContadores = async () => {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('severidad')
        .eq('resuelta', false)
      if (error) throw error
      const counts = { critica: 0, alta: 0, media: 0, baja: 0 }
      data?.forEach(a => { if (counts[a.severidad] !== undefined) counts[a.severidad]++ })
      setContadores(counts)
    } catch (e) {
      logger.error('Error loading alert counts:', e)
    }
  }

  const loadAlerts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('security_alerts')
        .select('*, afectado:usuario_afectado_id(nombre, email), origen:usuario_origen_id(nombre, email), resolutor:resuelta_por(nombre)', { count: 'exact' })

      if (filtroSeveridad) query = query.eq('severidad', filtroSeveridad)
      if (filtroTipo) query = query.eq('tipo', filtroTipo)
      if (filtroEstado === 'pendientes') query = query.eq('resuelta', false)
      else if (filtroEstado === 'resueltas') query = query.eq('resuelta', true)

      query = query.order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error
      setAlerts(data || [])
      setTotalCount(count || 0)
    } catch (e) {
      logger.error('Error loading alerts:', e)
    } finally {
      setLoading(false)
    }
  }

  const resolverAlerta = async (alertId) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          resuelta: true,
          resuelta_por: usuario.id,
          resuelta_at: new Date().toISOString(),
          notas_resolucion: notasResolucion || null
        })
        .eq('id', alertId)

      if (error) throw error

      try {
        await supabase.rpc('registrar_auditoria', {
          p_usuario_id: usuario.id,
          p_accion: 'UPDATE',
          p_categoria: 'seguridad',
          p_descripcion: `Alerta de seguridad resuelta: ${alertId}`
        })
      } catch (_) {}

      setResolviendo(null)
      setNotasResolucion('')
      loadAlerts()
      loadContadores()
    } catch (e) {
      logger.error('Error resolving alert:', e)
    }
  }

  const totalPendientes = contadores.critica + contadores.alta + contadores.media + contadores.baja
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <h1 className="h1" style={{ marginBottom: '8px' }}>Alertas de Seguridad</h1>
      <p className="sub" style={{ marginBottom: '24px' }}>
        {totalPendientes} alerta{totalPendientes !== 1 ? 's' : ''} pendiente{totalPendientes !== 1 ? 's' : ''}
      </p>

      {/* Tarjetas de conteo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(SEVERIDAD_CONFIG).map(([key, config]) => (
          <div key={key} style={{
            background: contadores[key] > 0 ? config.bg : 'var(--bg-card)',
            border: `1px solid ${contadores[key] > 0 ? config.color + '33' : 'var(--border)'}`,
            borderRadius: '10px',
            padding: '16px',
            textAlign: 'center',
            cursor: 'pointer',
            opacity: filtroSeveridad && filtroSeveridad !== key ? 0.5 : 1
          }} onClick={() => setFiltroSeveridad(filtroSeveridad === key ? '' : key)}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: config.color }}>{contadores[key]}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{config.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '10px'
      }}>
        <select
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); setPage(0) }}
          style={{
            padding: '6px 12px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '13px'
          }}
        >
          <option value="pendientes">Pendientes</option>
          <option value="resueltas">Resueltas</option>
          <option value="todas">Todas</option>
        </select>

        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); setPage(0) }}
          style={{
            padding: '6px 12px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '13px'
          }}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filtroSeveridad}
          onChange={(e) => { setFiltroSeveridad(e.target.value); setPage(0) }}
          style={{
            padding: '6px 12px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '13px'
          }}
        >
          <option value="">Todas las severidades</option>
          {Object.entries(SEVERIDAD_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Lista de alertas */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner" />
        </div>
      ) : alerts.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>No hay alertas que mostrar</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map(alert => {
            const sevConfig = SEVERIDAD_CONFIG[alert.severidad] || SEVERIDAD_CONFIG.baja
            return (
              <div key={alert.id} style={{
                background: 'var(--bg-card)',
                border: `1px solid ${alert.resuelta ? 'var(--border)' : sevConfig.color + '33'}`,
                borderRadius: '10px',
                padding: '16px',
                opacity: alert.resuelta ? 0.7 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: sevConfig.bg, color: sevConfig.color, textTransform: 'uppercase'
                      }}>
                        {sevConfig.label}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                        background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)'
                      }}>
                        {TIPO_LABELS[alert.tipo] || alert.tipo}
                      </span>
                      {alert.resuelta && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                          background: 'rgba(16,185,129,0.1)', color: '#10b981'
                        }}>
                          Resuelta
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>{alert.titulo}</div>
                    {alert.descripcion && (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>{alert.descripcion}</div>
                    )}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>{new Date(alert.created_at).toLocaleString('es-ES')}</span>
                      {alert.afectado && <span>Afectado: {alert.afectado.nombre || alert.afectado.email}</span>}
                      {alert.origen && <span>Origen: {alert.origen.nombre || alert.origen.email}</span>}
                    </div>
                    {alert.resuelta && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#10b981' }}>
                        Resuelta por {alert.resolutor?.nombre || 'N/A'} el {new Date(alert.resuelta_at).toLocaleString('es-ES')}
                        {alert.notas_resolucion && <span> — {alert.notas_resolucion}</span>}
                      </div>
                    )}
                  </div>

                  {!alert.resuelta && (
                    <button
                      onClick={() => setResolviendo(resolviendo === alert.id ? null : alert.id)}
                      className="btn"
                      style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      Resolver
                    </button>
                  )}
                </div>

                {resolviendo === alert.id && (
                  <div style={{
                    marginTop: '12px', paddingTop: '12px',
                    borderTop: '1px solid var(--border)'
                  }}>
                    <textarea
                      value={notasResolucion}
                      onChange={(e) => setNotasResolucion(e.target.value)}
                      placeholder="Notas de resolución (opcional)..."
                      style={{
                        width: '100%', padding: '8px 12px', minHeight: '60px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px', color: 'var(--text)', fontSize: '13px',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setResolviendo(null); setNotasResolucion('') }} className="btn" style={{ fontSize: '12px', padding: '6px 12px' }}>
                        Cancelar
                      </button>
                      <button
                        onClick={() => resolverAlerta(alert.id)}
                        className="btn primary"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        Marcar como resuelta
                      </button>
                    </div>
                  </div>
                )}

                {alert.datos && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      Datos adicionales
                    </summary>
                    <pre style={{
                      marginTop: '4px', padding: '8px', fontSize: '11px',
                      background: 'rgba(0,0,0,0.2)', borderRadius: '4px',
                      overflow: 'auto', color: 'var(--text-muted)'
                    }}>
                      {JSON.stringify(alert.datos, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn"
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Anterior
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn"
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
