import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Iconos
const Icons = {
  Search: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Mail: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  Phone: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  Users: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    </svg>
  )
}

const ESTADOS = {
  'campañas_activas': { label: 'Activo', class: 'active' },
  'pausado': { label: 'Pausado', class: 'paused' },
  'baja': { label: 'Baja', class: 'error' },
  'onboarding': { label: 'Onboarding', class: 'info' }
}

export default function Clientes() {
  const { tienePermiso } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => {
    cargarClientes()
  }, [filtroEstado])

  const cargarClientes = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          usuario_asignado:usuarios(nombre),
          clientes_urls(pagina_web, instagram)
        `)
        .order('nombre_comercial', { ascending: true })

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

  const clientesFiltrados = clientes.filter(cliente => {
    if (!busqueda) return true
    const busquedaLower = busqueda.toLowerCase()
    return (
      cliente.nombre_comercial?.toLowerCase().includes(busquedaLower) ||
      cliente.email_portal?.toLowerCase().includes(busquedaLower) ||
      cliente.telefono?.includes(busqueda)
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="h1">Clientes</h1>
            <p className="sub">Gestiona todos tus clientes desde aquí</p>
          </div>
          {tienePermiso('clientes.crear') && (
            <Link to="/clientes/nuevo" className="btn primary">
              <Icons.Plus /> Nuevo Cliente
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Icons.Search />
            </div>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en todos los clientes..."
              className="input"
              style={{ paddingLeft: '44px' }}
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="select"
            style={{ width: '180px' }}
          >
            <option value="todos">Todos los estados</option>
            <option value="campañas_activas">Campañas Activas</option>
            <option value="pausado">Pausado</option>
            <option value="onboarding">Onboarding</option>
            <option value="baja">Baja</option>
          </select>
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
              <Icons.Users />
            </div>
            <p className="empty-state-title">No hay clientes</p>
            <p className="empty-state-text">
              {busqueda
                ? 'No se encontraron clientes con esos criterios'
                : 'Comienza añadiendo tu primer cliente'}
            </p>
            {tienePermiso('clientes.crear') && !busqueda && (
              <Link to="/clientes/nuevo" className="btn primary" style={{ marginTop: '16px' }}>
                <Icons.Plus /> Nuevo Cliente
              </Link>
            )}
          </div>
        </div>
      ) : (
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
                        <div className="avatar">
                          {cliente.nombre_comercial?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{cliente.nombre_comercial}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        {cliente.email_portal || '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        {cliente.telefono || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${ESTADOS[cliente.estado]?.class || ''}`}>
                        {ESTADOS[cliente.estado]?.label || cliente.estado}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="btn btn-icon btn-sm"
                        title="Ver detalle"
                      >
                        <Icons.Eye />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Count */}
      {clientesFiltrados.length > 0 && (
        <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Mostrando {clientesFiltrados.length} de {clientes.length} clientes
        </p>
      )}
    </div>
  )
}
