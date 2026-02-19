import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

const PAGE_SIZE = 25

const CATEGORIAS = [
  { value: '', label: 'Todas las categorias' },
  { value: 'auth', label: 'Autenticacion' },
  { value: 'usuarios', label: 'Usuarios' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'roles', label: 'Roles' },
  { value: 'roles_permisos', label: 'Permisos de roles' },
  { value: 'usuarios_permisos', label: 'Permisos de usuarios' },
  { value: 'sistema', label: 'Sistema' },
]

const ACCIONES = [
  { value: '', label: 'Todas las acciones' },
  { value: 'INSERT', label: 'Crear' },
  { value: 'UPDATE', label: 'Actualizar' },
  { value: 'DELETE', label: 'Eliminar' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
]

const accionColor = {
  INSERT: { bg: 'rgba(46, 229, 157, 0.15)', color: '#2ee59d' },
  UPDATE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' },
  DELETE: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' },
  LOGIN: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' },
  LOGOUT: { bg: 'rgba(255, 169, 77, 0.15)', color: '#ffa94d' },
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [detalleLog, setDetalleLog] = useState(null)

  const cargarLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filtroCategoria) query = query.eq('categoria', filtroCategoria)
      if (filtroAccion) query = query.eq('accion', filtroAccion)
      if (filtroUsuario) query = query.or(`usuario_email.ilike.%${filtroUsuario}%,usuario_nombre.ilike.%${filtroUsuario}%`)
      if (filtroFechaDesde) query = query.gte('created_at', filtroFechaDesde + 'T00:00:00')
      if (filtroFechaHasta) query = query.lte('created_at', filtroFechaHasta + 'T23:59:59')

      const { data, error, count } = await query

      if (error) {
        logger.error('Error cargando audit log:', error)
        return
      }

      setLogs(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      logger.error('Error en cargarLogs:', error)
    } finally {
      setLoading(false)
    }
  }, [page, filtroCategoria, filtroAccion, filtroUsuario, filtroFechaDesde, filtroFechaHasta])

  useEffect(() => {
    cargarLogs()
  }, [cargarLogs])

  const handleFiltrar = () => {
    setPage(0)
    cargarLogs()
  }

  const limpiarFiltros = () => {
    setFiltroCategoria('')
    setFiltroAccion('')
    setFiltroUsuario('')
    setFiltroFechaDesde('')
    setFiltroFechaHasta('')
    setPage(0)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    const d = new Date(fecha)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
          Registro de Actividad
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          {totalCount} registros encontrados
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        marginBottom: '16px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={labelStyle}>Categoria</label>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={inputStyle}>
            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>Accion</label>
          <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} style={inputStyle}>
            {ACCIONES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={labelStyle}>Usuario</label>
          <input
            type="text"
            placeholder="Buscar por nombre o email"
            value={filtroUsuario}
            onChange={e => setFiltroUsuario(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>Desde</label>
          <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>Hasta</label>
          <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleFiltrar} style={btnPrimary}>Filtrar</button>
          <button onClick={limpiarFiltros} style={btnSecondary}>Limpiar</button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando registros...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No se encontraron registros
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>Fecha/Hora</th>
                  <th style={thStyle}>Usuario</th>
                  <th style={thStyle}>Accion</th>
                  <th style={thStyle}>Categoria</th>
                  <th style={thStyle}>Descripcion</th>
                  <th style={{ ...thStyle, width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{formatFecha(log.created_at)}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                        {log.usuario_nombre || '-'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {log.usuario_email || ''}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: accionColor[log.accion]?.bg || 'rgba(255,255,255,0.1)',
                        color: accionColor[log.accion]?.color || 'var(--text)',
                      }}>
                        {log.accion}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {log.categoria}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '300px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.descripcion || '-'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {(log.datos_antes || log.datos_despues) && (
                        <button
                          onClick={() => setDetalleLog(log)}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginacion */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Pagina {page + 1} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ ...btnSecondary, opacity: page === 0 ? 0.4 : 1 }}
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{ ...btnSecondary, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {detalleLog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setDetalleLog(null)}>
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
                Detalle del registro
              </h2>
              <button onClick={() => setDetalleLog(null)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '20px', padding: '4px'
              }}>
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <InfoField label="Fecha" value={formatFecha(detalleLog.created_at)} />
              <InfoField label="Usuario" value={`${detalleLog.usuario_nombre || '-'} (${detalleLog.usuario_email || '-'})`} />
              <InfoField label="Accion" value={detalleLog.accion} />
              <InfoField label="Categoria" value={detalleLog.categoria} />
              <InfoField label="Tabla" value={detalleLog.tabla_afectada || '-'} />
              <InfoField label="Registro ID" value={detalleLog.registro_id || '-'} />
            </div>

            {detalleLog.descripcion && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>Descripcion</label>
                <p style={{ fontSize: '14px', color: 'var(--text)', margin: 0 }}>{detalleLog.descripcion}</p>
              </div>
            )}

            {detalleLog.campos_modificados?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>Campos modificados</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {detalleLog.campos_modificados.map(campo => (
                    <span key={campo} style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                      background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', fontWeight: 500
                    }}>
                      {campo}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(detalleLog.datos_antes || detalleLog.datos_despues) && (
              <div style={{ display: 'grid', gridTemplateColumns: detalleLog.datos_antes && detalleLog.datos_despues ? '1fr 1fr' : '1fr', gap: '12px' }}>
                {detalleLog.datos_antes && (
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '8px', display: 'block', color: '#EF4444' }}>Datos anteriores</label>
                    <DiffView
                      data={detalleLog.datos_antes}
                      compareWith={detalleLog.datos_despues}
                      campos={detalleLog.campos_modificados}
                      type="antes"
                    />
                  </div>
                )}
                {detalleLog.datos_despues && (
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '8px', display: 'block', color: '#2ee59d' }}>Datos nuevos</label>
                    <DiffView
                      data={detalleLog.datos_despues}
                      compareWith={detalleLog.datos_antes}
                      campos={detalleLog.campos_modificados}
                      type="despues"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function DiffView({ data, campos, type }) {
  if (!data) return null

  const entries = Object.entries(data).filter(([key]) => {
    // Filtrar campos sensibles
    if (key === 'password_portal') return false
    return true
  })

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxHeight: '300px',
      overflow: 'auto'
    }}>
      {entries.map(([key, value]) => {
        const isModified = campos?.includes(key)
        const highlightColor = isModified
          ? (type === 'antes' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(46, 229, 157, 0.1)')
          : 'transparent'

        return (
          <div key={key} style={{
            padding: '2px 4px',
            background: highlightColor,
            borderRadius: '2px',
            marginBottom: '1px',
            display: 'flex',
            gap: '8px'
          }}>
            <span style={{ color: 'var(--text-muted)', minWidth: '140px' }}>{key}:</span>
            <span style={{
              color: isModified ? (type === 'antes' ? '#EF4444' : '#2ee59d') : 'var(--text)',
              fontWeight: isModified ? 600 : 400,
              wordBreak: 'break-all'
            }}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'null')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Estilos reutilizables
const labelStyle = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: '4px',
  display: 'block'
}

const inputStyle = {
  width: '100%',
  height: '36px',
  padding: '0 10px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box'
}

const thStyle = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const tdStyle = {
  padding: '10px 16px',
  fontSize: '14px',
  color: 'var(--text)',
  verticalAlign: 'top',
}

const btnPrimary = {
  height: '36px',
  padding: '0 16px',
  background: 'var(--primary)',
  color: '#000',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary = {
  height: '36px',
  padding: '0 16px',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '13px',
  cursor: 'pointer',
}
