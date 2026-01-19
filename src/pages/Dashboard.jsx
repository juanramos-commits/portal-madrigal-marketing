import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Iconos
const Icons = {
  Users: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Clock: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Target: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

export default function Dashboard() {
  const { usuario, tienePermiso } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalClientes: 0,
    clientesActivos: 0,
    tareasPendientes: 0,
    leadsMes: 0
  })
  const [clientesBajoLeads, setClientesBajoLeads] = useState([])
  const [tareasRecientes, setTareasRecientes] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [clientesRes, tareasRes] = await Promise.all([
        supabase.from('clientes').select('id, estado', { count: 'exact' }),
        supabase
          .from('tareas')
          .select('*')
          .eq('estado', 'pendiente')
          .order('fecha_limite', { ascending: true })
          .limit(5)
      ])

      const totalClientes = clientesRes.count || 0
      const clientesActivos = clientesRes.data?.filter(c => c.estado === 'campañas_activas').length || 0

      setStats({
        totalClientes,
        clientesActivos,
        tareasPendientes: tareasRes.data?.length || 0,
        leadsMes: 0
      })

      setTareasRecientes(tareasRes.data || [])

    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '300px' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="h1">
          ¡Hola, {usuario?.nombre?.split(' ')[0] || 'Usuario'}!
        </h1>
        <p className="sub">
          Aquí tienes un resumen de tu día
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Clientes</span>
            <div className="stat-card-icon blue">
              <Icons.Users />
            </div>
          </div>
          <div className="stat-card-value">{stats.totalClientes}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Campañas Activas</span>
            <div className="stat-card-icon green">
              <Icons.TrendingUp />
            </div>
          </div>
          <div className="stat-card-value">{stats.clientesActivos}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Tareas Pendientes</span>
            <div className="stat-card-icon yellow">
              <Icons.Clock />
            </div>
          </div>
          <div className="stat-card-value">{stats.tareasPendientes}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Leads Este Mes</span>
            <div className="stat-card-icon purple">
              <Icons.Target />
            </div>
          </div>
          <div className="stat-card-value">{stats.leadsMes}</div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Clientes con pocos leads */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="card-title">⚠️ Clientes con pocos leads</h2>
              <p className="card-sub">Requieren atención inmediata</p>
            </div>
            <Link to="/clientes" className="btn btn-sm">
              Ver todos
              <Icons.ArrowRight />
            </Link>
          </div>

          {clientesBajoLeads.length === 0 ? (
            <div className="empty-state">
              <div style={{ color: 'var(--success)', marginBottom: '16px' }}>
                <Icons.CheckCircle />
              </div>
              <p className="empty-state-title">Todo en orden</p>
              <p className="empty-state-text">Todos los clientes tienen leads suficientes</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {clientesBajoLeads.map((cliente) => (
                <Link
                  key={cliente.id}
                  to={`/clientes/${cliente.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    textDecoration: 'none',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar">
                      {cliente.nombre_comercial?.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                        {cliente.nombre_comercial}
                      </p>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                        {cliente.servicio_contratado}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${cliente.leads_restantes <= 0 ? 'inactive' : cliente.leads_restantes <= 5 ? 'paused' : 'active'}`}>
                    {cliente.leads_restantes <= 0 && <Icons.AlertTriangle />}
                    {cliente.leads_restantes} restantes
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tareas pendientes */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="card-title">📋 Tareas pendientes</h2>
              <p className="card-sub">Tus próximas tareas</p>
            </div>
            <Link to="/tareas" className="btn btn-sm">
              Ver todas
              <Icons.ArrowRight />
            </Link>
          </div>

          {tareasRecientes.length === 0 ? (
            <div className="empty-state">
              <div style={{ color: 'var(--success)', marginBottom: '16px' }}>
                <Icons.CheckCircle />
              </div>
              <p className="empty-state-title">¡Genial!</p>
              <p className="empty-state-text">No tienes tareas pendientes</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tareasRecientes.map((tarea) => (
                <div
                  key={tarea.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    marginTop: '6px',
                    background: tarea.prioridad >= 4 ? 'var(--error)' : tarea.prioridad >= 3 ? 'var(--warning)' : 'var(--text-muted)'
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 500, color: 'var(--text)', margin: 0 }}>
                      {tarea.titulo}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      {tarea.categoria} • {tarea.fecha_limite
                        ? new Date(tarea.fecha_limite).toLocaleDateString('es-ES')
                        : 'Sin fecha límite'
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
