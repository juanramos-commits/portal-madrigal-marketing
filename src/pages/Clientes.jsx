import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const ESTADOS = {
  'campañas_activas': { label: 'Campañas Activas', class: 'active' },
  'pausado': { label: 'Pausado', class: 'paused' },
  'baja': { label: 'Baja', class: 'error' },
  'onboarding': { label: 'Onboarding', class: 'info' }
}

// Normalizar texto para búsqueda (quita acentos y convierte a minúsculas)
const normalizar = (texto) => {
  if (!texto) return ''
  return texto.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export default function Clientes() {
  const { tienePermiso } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [vistaActual, setVistaActual] = useState('tabla') // tabla, tarjetas, compacta
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre_comercial: '',
    telefono: '',
    email_portal: '',
    password_portal: '',
    tiene_whatsapp: true
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarClientes()
  }, [filtroEstado])

  const cargarClientes = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error } = await query
      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Error cargando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrado en tiempo real con normalización
  const clientesFiltrados = clientes.filter(cliente => {
    if (!busqueda) return true
    const busquedaNorm = normalizar(busqueda)
    return (
      normalizar(cliente.nombre_comercial).includes(busquedaNorm) ||
      normalizar(cliente.email_portal).includes(busquedaNorm) ||
      normalizar(cliente.telefono).includes(busquedaNorm) ||
      normalizar(cliente.nombre_pila).includes(busquedaNorm)
    )
  })

  const crearCliente = async () => {
    if (!nuevoCliente.nombre_comercial.trim()) return
    setGuardando(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nombre_comercial: nuevoCliente.nombre_comercial.trim(),
          telefono: nuevoCliente.telefono.trim(),
          email_portal: nuevoCliente.email_portal.trim(),
          password_portal: nuevoCliente.password_portal,
          tiene_whatsapp: nuevoCliente.tiene_whatsapp,
          estado: 'onboarding'
        })
        .select()
        .single()

      if (error) throw error

      setModalNuevoCliente(false)
      setNuevoCliente({ nombre_comercial: '', telefono: '', email_portal: '', password_portal: '', tiene_whatsapp: true })
      navigate(`/clientes/${data.id}`)
    } catch (error) {
      console.error('Error creando cliente:', error)
      alert('Error al crear el cliente')
    } finally {
      setGuardando(false)
    }
  }

  // Vista de tabla
  const VistaTabla = () => (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th style={{ width: '100px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: cliente.avatar_url ? `url(${cliente.avatar_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: '600', fontSize: '14px'
                    }}>
                      {!cliente.avatar_url && cliente.nombre_comercial?.charAt(0)}
                    </div>
                    <div>
                      <span style={{ fontWeight: 500 }}>{cliente.nombre_comercial}</span>
                      {cliente.numero_cliente && (
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#667eea' }}>#{cliente.numero_cliente}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{cliente.email_portal || '-'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{cliente.telefono || '-'}</td>
                <td>
                  <span className={`badge ${ESTADOS[cliente.estado]?.class || ''}`}>
                    {ESTADOS[cliente.estado]?.label || cliente.estado}
                  </span>
                </td>
                <td>
                  <Link to={`/clientes/${cliente.id}`} className="btn btn-icon btn-sm" title="Ver detalle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // Vista de tarjetas
  const VistaTarjetas = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
      {clientesFiltrados.map((cliente) => (
        <Link key={cliente.id} to={`/clientes/${cliente.id}`} style={{ textDecoration: 'none' }}>
          <div className="card" style={{
            padding: '20px', cursor: 'pointer', transition: 'all 0.2s ease',
            border: '1px solid var(--border)'
          }}
          onMouseOver={(e) => { e.currentTarget.style.borderColor = '#667eea'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0,
                background: cliente.avatar_url ? `url(${cliente.avatar_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '700', fontSize: '20px'
              }}>
                {!cliente.avatar_url && cliente.nombre_comercial?.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cliente.nombre_comercial}
                  </h3>
                  {cliente.numero_cliente && (
                    <span style={{ fontSize: '12px', color: '#667eea', fontWeight: '600' }}>#{cliente.numero_cliente}</span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {cliente.email_portal || 'Sin email'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={`badge ${ESTADOS[cliente.estado]?.class || ''}`} style={{ fontSize: '11px' }}>
                    {ESTADOS[cliente.estado]?.label || cliente.estado}
                  </span>
                  {cliente.telefono && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cliente.telefono}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )

  // Vista compacta/innovadora
  const VistaCompacta = () => (
    <div className="card" style={{ padding: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {clientesFiltrados.map((cliente) => (
          <Link key={cliente.id} to={`/clientes/${cliente.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
              background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
              transition: 'all 0.15s ease', cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: cliente.avatar_url ? `url(${cliente.avatar_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '600', fontSize: '14px', flexShrink: 0
              }}>
                {!cliente.avatar_url && cliente.nombre_comercial?.charAt(0)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '14px' }}>{cliente.nombre_comercial}</span>
                  {cliente.numero_cliente && (
                    <span style={{ fontSize: '11px', color: '#667eea', fontWeight: '600' }}>#{cliente.numero_cliente}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '120px' }}>{cliente.email_portal || '-'}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '100px' }}>{cliente.telefono || '-'}</span>
                <span className={`badge ${ESTADOS[cliente.estado]?.class || ''}`} style={{ minWidth: '110px', textAlign: 'center' }}>
                  {ESTADOS[cliente.estado]?.label || cliente.estado}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="h1">Clientes v2</h1>
            <p className="sub">Gestiona todos tus clientes desde aquí</p>
          </div>
          {tienePermiso('clientes.crear') && (
            <button onClick={() => setModalNuevoCliente(true)} className="btn primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nuevo Cliente
            </button>
          )}
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, email, teléfono..."
              className="input"
              style={{ paddingLeft: '44px' }}
            />
          </div>

          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="select" style={{ width: '180px' }}>
            <option value="todos">Todos los estados</option>
            <option value="campañas_activas">Campañas Activas</option>
            <option value="pausado">Pausado</option>
            <option value="onboarding">Onboarding</option>
            <option value="baja">Baja</option>
          </select>

          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setVistaActual('tabla')}
              className="btn btn-icon"
              style={{
                background: vistaActual === 'tabla' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                border: vistaActual === 'tabla' ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                color: vistaActual === 'tabla' ? '#667eea' : 'var(--text-muted)'
              }}
              title="Vista tabla"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </button>
            <button
              onClick={() => setVistaActual('tarjetas')}
              className="btn btn-icon"
              style={{
                background: vistaActual === 'tarjetas' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                border: vistaActual === 'tarjetas' ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                color: vistaActual === 'tarjetas' ? '#667eea' : 'var(--text-muted)'
              }}
              title="Vista tarjetas"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <button
              onClick={() => setVistaActual('compacta')}
              className="btn btn-icon"
              style={{
                background: vistaActual === 'compacta' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                border: vistaActual === 'compacta' ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                color: vistaActual === 'compacta' ? '#667eea' : 'var(--text-muted)'
              }}
              title="Vista compacta"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <div className="spinner"></div>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <p className="empty-state-title">No hay clientes</p>
            <p className="empty-state-text">
              {busqueda ? 'No se encontraron clientes con esos criterios' : 'Comienza añadiendo tu primer cliente'}
            </p>
            {tienePermiso('clientes.crear') && !busqueda && (
              <button onClick={() => setModalNuevoCliente(true)} className="btn primary" style={{ marginTop: '16px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nuevo Cliente
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {vistaActual === 'tabla' && <VistaTabla />}
          {vistaActual === 'tarjetas' && <VistaTarjetas />}
          {vistaActual === 'compacta' && <VistaCompacta />}
        </>
      )}

      {/* Count */}
      {clientesFiltrados.length > 0 && (
        <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Mostrando {clientesFiltrados.length} de {clientes.length} clientes
        </p>
      )}

      {/* Modal Nuevo Cliente */}
      {modalNuevoCliente && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
        }} onClick={() => setModalNuevoCliente(false)}>
          <div style={{
            background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '24px' }}>
              Nuevo Cliente
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Nombre comercial *
                </label>
                <input
                  type="text"
                  value={nuevoCliente.nombre_comercial}
                  onChange={(e) => setNuevoCliente(prev => ({ ...prev, nombre_comercial: e.target.value }))}
                  className="input"
                  placeholder="Nombre del negocio"
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={nuevoCliente.telefono}
                  onChange={(e) => setNuevoCliente(prev => ({ ...prev, telefono: e.target.value }))}
                  className="input"
                  placeholder="+34 600 000 000"
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Email del Portal
                </label>
                <input
                  type="email"
                  value={nuevoCliente.email_portal}
                  onChange={(e) => setNuevoCliente(prev => ({ ...prev, email_portal: e.target.value }))}
                  className="input"
                  placeholder="email@ejemplo.com"
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                  Contraseña del Portal
                </label>
                <input
                  type="text"
                  value={nuevoCliente.password_portal}
                  onChange={(e) => setNuevoCliente(prev => ({ ...prev, password_portal: e.target.value }))}
                  className="input"
                  placeholder="Contraseña inicial"
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <input
                  type="checkbox"
                  checked={nuevoCliente.tiene_whatsapp}
                  onChange={(e) => setNuevoCliente(prev => ({ ...prev, tiene_whatsapp: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#25d366' }}
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span style={{ fontSize: '14px', color: 'var(--text)' }}>Tiene WhatsApp</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setModalNuevoCliente(false)} className="btn">Cancelar</button>
              <button
                onClick={crearCliente}
                disabled={guardando || !nuevoCliente.nombre_comercial.trim()}
                className="btn primary"
              >
                {guardando ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : 'Crear Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// Build timestamp: 2026011917
// rebuild lunes, 19 de enero de 2026, 19:05:32 CET
