import { logger } from '../lib/logger'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const TIPOS_USUARIO = {
  super_admin: { label: 'Super Admin', color: '#EF4444' },
  admin: { label: 'Admin', color: '#F59E0B' },
  equipo: { label: 'Equipo', color: '#3B82F6' },
  cliente: { label: 'Cliente', color: '#10B981' }
}

const MODULOS = {
  dashboard: { nombre: 'Dashboard', icono: '📊' },
  clientes: { nombre: 'Clientes', icono: '👥' },
  leads: { nombre: 'Leads', icono: '📈' },
  campanas: { nombre: 'Campañas', icono: '🎯' },
  tareas: { nombre: 'Tareas', icono: '✅' },
  sugerencias: { nombre: 'Sugerencias', icono: '💬' },
  reuniones: { nombre: 'Reuniones', icono: '📅' },
  facturacion: { nombre: 'Facturación', icono: '💰' },
  usuarios: { nombre: 'Usuarios', icono: '👤' },
  roles: { nombre: 'Roles', icono: '🔐' },
  sistema: { nombre: 'Sistema', icono: '⚙️' },
  notificaciones: { nombre: 'Notificaciones', icono: '🔔' },
  archivos: { nombre: 'Archivos', icono: '📁' },
  documentacion: { nombre: 'Documentación', icono: '📄' },
  madrigalito: { nombre: 'Madrigalito', icono: '🎯' },
  paquetes: { nombre: 'Paquetes', icono: '📦' },
  notas: { nombre: 'Notas', icono: '📝' },
  historial: { nombre: 'Historial', icono: '🕐' },
}

export default function Usuarios() {
  const { usuario: currentUser, tienePermiso } = useAuth()
  const { showToast } = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [permisos, setPermisos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  
  const [modalInvitar, setModalInvitar] = useState(false)
  const [modalPermisos, setModalPermisos] = useState(null)
  const [modalConfirmar, setModalConfirmar] = useState(null)
  
  const [inviteForm, setInviteForm] = useState({ email: '', nombre: '', tipo: 'equipo', rol_id: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const [permisosUsuario, setPermisosUsuario] = useState([])
  const [permisosRol, setPermisosRol] = useState([])
  const [modulosExpandidos, setModulosExpandidos] = useState({})
  const [permisosLoading, setPermisosLoading] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [usuariosRes, rolesRes, permisosRes] = await Promise.all([
        supabase.from('usuarios').select('*, rol:roles(id, nombre, color, nivel)').order('created_at', { ascending: false }),
        supabase.from('roles').select('*').order('nivel', { ascending: false }),
        supabase.from('permisos').select('*').order('orden', { ascending: true })
      ])
      setUsuarios(usuariosRes.data || [])
      setRoles(rolesRes.data || [])
      setPermisos(permisosRes.data || [])
    } catch (error) {
      logger.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const matchSearch = !search || u.nombre?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchTipo = !filtroTipo || u.tipo === filtroTipo
    const matchRol = !filtroRol || u.rol_id === filtroRol
    const matchEstado = filtroEstado === '' || (filtroEstado === 'activo' && u.activo) || (filtroEstado === 'inactivo' && !u.activo)
    return matchSearch && matchTipo && matchRol && matchEstado
  })

  const permisosPorModulo = permisos.reduce((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = []
    acc[p.modulo].push(p)
    return acc
  }, {})

  // Invitar usuario
  const handleInvitar = async (e) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(`${supabaseUrl}/functions/v1/super-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          email: inviteForm.email,
          nombre: inviteForm.nombre,
          tipo: inviteForm.tipo,
          rol_id: inviteForm.rol_id || null,
          invitado_por: currentUser?.id
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al invitar usuario')
      }

      setInviteSuccess('¡Invitación enviada!')
      setTimeout(() => {
        setModalInvitar(false)
        setInviteForm({ email: '', nombre: '', tipo: 'equipo', rol_id: '' })
        setInviteSuccess('')
        cargarDatos()
      }, 1500)

    } catch (error) {
      logger.error('Error:', error)
      if (error.name === 'AbortError') {
        setInviteError('La petición tardó demasiado. Verifica tu conexión.')
      } else {
        setInviteError(error.message || 'Error al invitar usuario')
      }
    } finally {
      setInviteLoading(false)
    }
  }

  const abrirModalPermisos = async (usuario) => {
    setModalPermisos(usuario)
    setPermisosLoading(true)
    setPermisosUsuario([])
    setPermisosRol([])

    const expanded = {}
    Object.keys(permisosPorModulo).forEach(m => expanded[m] = true)
    setModulosExpandidos(expanded)

    try {
      const [rolRes, userRes] = await Promise.all([
        usuario.rol_id ? supabase.from('roles_permisos').select('permiso_id').eq('rol_id', usuario.rol_id) : { data: [] },
        supabase.from('usuarios_permisos').select('permiso_id, permitido').eq('usuario_id', usuario.id)
      ])
      setPermisosRol(rolRes.data?.map(p => p.permiso_id) || [])
      setPermisosUsuario(userRes.data || [])
    } catch (error) {
      logger.error('Error cargando permisos:', error)
    } finally {
      setPermisosLoading(false)
    }
  }

  const getPermisoEstado = (permisoId) => {
    const override = permisosUsuario.find(p => p.permiso_id === permisoId)
    if (override) return override.permitido ? 'permitido' : 'denegado'
    if (permisosRol.includes(permisoId)) return 'heredado'
    return 'sin_acceso'
  }

  const togglePermisoUsuario = async (permisoId) => {
    const estado = getPermisoEstado(permisoId)
    const tieneDelRol = permisosRol.includes(permisoId)

    try {
      if (estado === 'heredado' || estado === 'sin_acceso') {
        const nuevoValor = !tieneDelRol
        await supabase.from('usuarios_permisos').upsert({
          usuario_id: modalPermisos.id,
          permiso_id: permisoId,
          permitido: nuevoValor,
          asignado_por: currentUser?.id
        })
        setPermisosUsuario(prev => [...prev.filter(p => p.permiso_id !== permisoId), { permiso_id: permisoId, permitido: nuevoValor }])
      } else if (estado === 'permitido') {
        if (tieneDelRol) {
          await supabase.from('usuarios_permisos').delete().eq('usuario_id', modalPermisos.id).eq('permiso_id', permisoId)
          setPermisosUsuario(prev => prev.filter(p => p.permiso_id !== permisoId))
        } else {
          await supabase.from('usuarios_permisos').upsert({ usuario_id: modalPermisos.id, permiso_id: permisoId, permitido: false, asignado_por: currentUser?.id })
          setPermisosUsuario(prev => [...prev.filter(p => p.permiso_id !== permisoId), { permiso_id: permisoId, permitido: false }])
        }
      } else if (estado === 'denegado') {
        await supabase.from('usuarios_permisos').delete().eq('usuario_id', modalPermisos.id).eq('permiso_id', permisoId)
        setPermisosUsuario(prev => prev.filter(p => p.permiso_id !== permisoId))
      }
    } catch (error) {
      logger.error('Error:', error)
    }
  }

  const toggleActivo = async (id, activo) => {
    await supabase.from('usuarios').update({ activo: !activo }).eq('id', id)
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: !activo } : u))
    setModalConfirmar(null)
  }

  const eliminarUsuario = async (id) => {
    try {
      const { data, error } = await supabase.functions.invoke('eliminar-usuario', {
        body: { usuario_id: id }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      // Soft delete: marcar como inactivo en la UI
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: false } : u))
    } catch (error) {
      logger.error('Error eliminando usuario:', error)
      showToast(error.message || 'Error al eliminar usuario', 'error')
    }
    setModalConfirmar(null)
  }

  const cambiarRol = async (id, rolId) => {
    try {
      const { data, error } = await supabase.functions.invoke('cambiar-rol-usuario', {
        body: { usuario_id: id, nuevo_rol_id: rolId || null }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const rol = roles.find(r => r.id === rolId)
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, rol_id: rolId, rol } : u))
    } catch (error) {
      logger.error('Error cambiando rol:', error)
      showToast(error.message || 'Error al cambiar rol', 'error')
      cargarDatos() // Recargar para reflejar estado real
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="h1">Usuarios</h1>
            <p className="sub">Gestiona los usuarios y permisos</p>
          </div>
          {tienePermiso('usuarios.crear') && (
            <button onClick={() => { setModalInvitar(true); setInviteError(''); setInviteSuccess('') }} className="btn primary">
              + Invitar Usuario
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ flex: 1, minWidth: '200px' }} />
          <Select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="select" style={{ width: '150px' }}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS_USUARIO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={filtroRol} onChange={e => setFiltroRol(e.target.value)} className="select" style={{ width: '180px' }}>
            <option value="">Todos los roles</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </Select>
          <Select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="select" style={{ width: '130px' }}>
            <option value="">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card"><div className="stat-card-label">Total</div><div className="stat-card-value">{usuarios.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Activos</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{usuarios.filter(u => u.activo).length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Equipo</div><div className="stat-card-value">{usuarios.filter(u => ['equipo','admin','super_admin'].includes(u.tipo)).length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Clientes</div><div className="stat-card-value">{usuarios.filter(u => u.tipo === 'cliente').length}</div></div>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th style={{ width: '120px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No hay usuarios</td></tr>
              ) : usuariosFiltrados.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar" style={{ background: u.rol?.color || 'rgba(255,255,255,0.1)' }}>{u.nombre?.charAt(0) || '?'}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.nombre || 'Sin nombre'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge" style={{ background: `${TIPOS_USUARIO[u.tipo]?.color}20`, color: TIPOS_USUARIO[u.tipo]?.color }}>{TIPOS_USUARIO[u.tipo]?.label}</span></td>
                  <td>
                    {u.tipo !== 'cliente' && u.tipo !== 'super_admin' ? (
                      <Select value={u.rol_id || ''} onChange={e => cambiarRol(u.id, e.target.value)} className="select" style={{ height: '32px', fontSize: '13px', background: 'transparent' }} disabled={!tienePermiso('usuarios.editar') || u.id === currentUser?.id}>
                        <option value="">Sin rol</option>
                        {roles.filter(r => {
                          if (r.nombre === 'Super Admin') return false
                          if (currentUser?.tipo !== 'super_admin') {
                            const nivelActual = currentUser?.rol?.nivel ?? 0
                            if (r.nivel >= nivelActual) return false
                          }
                          return true
                        }).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </Select>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{u.tipo === 'super_admin' ? 'Super Admin' : 'N/A'}</span>}
                  </td>
                  <td><span className={`badge ${u.activo ? 'active' : 'inactive'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Nunca'}</td>
                  <td>
                    {u.id !== currentUser?.id && u.tipo !== 'super_admin' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {tienePermiso('usuarios.editar') && <button onClick={() => abrirModalPermisos(u)} className="btn btn-icon btn-sm" title="Permisos">🛡️</button>}
                        {tienePermiso('usuarios.activar_desactivar') && <button onClick={() => setModalConfirmar({ tipo: 'toggle', usuario: u })} className="btn btn-icon btn-sm">{u.activo ? '🚫' : '✅'}</button>}
                        {tienePermiso('usuarios.eliminar') && <button onClick={() => setModalConfirmar({ tipo: 'eliminar', usuario: u })} className="btn btn-icon btn-sm" style={{ color: 'var(--error)' }}>🗑️</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Invitar */}
      <Modal
        open={modalInvitar}
        onClose={() => !inviteLoading && setModalInvitar(false)}
        title="Invitar Usuario"
        footer={
          <>
            <button type="button" onClick={() => setModalInvitar(false)} className="btn" disabled={inviteLoading}>Cancelar</button>
            <button type="submit" form="usuarios-invite-form" className="btn primary" disabled={inviteLoading}>{inviteLoading ? 'Enviando...' : 'Enviar Invitación'}</button>
          </>
        }
      >
        <form id="usuarios-invite-form" onSubmit={handleInvitar}>
          {inviteError && <div className="alert error" style={{ marginBottom: '16px' }}>{inviteError}</div>}
          {inviteSuccess && <div className="alert success" style={{ marginBottom: '16px' }}>{inviteSuccess}</div>}
          <div className="field" style={{ marginBottom: '16px' }}>
            <label className="field-label">Nombre</label>
            <input type="text" value={inviteForm.nombre} onChange={e => setInviteForm({...inviteForm, nombre: e.target.value})} className="input" required disabled={inviteLoading} />
          </div>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label className="field-label">Email</label>
            <input type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} className="input" required disabled={inviteLoading} />
          </div>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label className="field-label">Tipo</label>
            <Select value={inviteForm.tipo} onChange={e => setInviteForm({...inviteForm, tipo: e.target.value})} className="select" disabled={inviteLoading}>
              <option value="equipo">Equipo</option>
              <option value="admin">Admin</option>
              <option value="cliente">Cliente</option>
            </Select>
          </div>
          {inviteForm.tipo !== 'cliente' && (
            <div className="field" style={{ marginBottom: '24px' }}>
              <label className="field-label">Rol</label>
              <Select value={inviteForm.rol_id} onChange={e => setInviteForm({...inviteForm, rol_id: e.target.value})} className="select" disabled={inviteLoading}>
                <option value="">Seleccionar...</option>
                {roles.filter(r => r.nombre !== 'Super Admin').map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </Select>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal Permisos */}
      <Modal
        open={!!modalPermisos}
        onClose={() => setModalPermisos(null)}
        title={`Permisos de ${modalPermisos?.nombre || ''}`}
        size="lg"
      >
        {modalPermisos && (
          <p style={{ margin: '-8px 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Rol: {modalPermisos.rol?.nombre || 'Sin rol'}</p>
        )}

        {permisosLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner"></div></div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            {Object.entries(permisosPorModulo).map(([modulo, perms]) => (
              <div key={modulo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setModulosExpandidos(prev => ({...prev, [modulo]: !prev[modulo]}))}>
                  <span>{modulosExpandidos[modulo] ? '▼' : '▶'}</span>
                  <span>{MODULOS[modulo]?.icono || '📁'}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{MODULOS[modulo]?.nombre || modulo}</span>
                </div>
                {modulosExpandidos[modulo] && (
                  <div style={{ padding: '8px 16px 8px 48px' }}>
                    {perms.map(p => {
                      const estado = getPermisoEstado(p.id)
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                          <button onClick={() => togglePermisoUsuario(p.id)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: estado === 'permitido' ? 'var(--success)' : estado === 'heredado' ? 'var(--primary)' : estado === 'denegado' ? 'var(--error)' : 'rgba(255,255,255,0.1)', color: estado === 'sin_acceso' ? 'var(--text-muted)' : '#000', fontWeight: 600 }}>
                            {estado === 'permitido' ? '✓' : estado === 'heredado' ? 'R' : estado === 'denegado' ? '✕' : '−'}
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px' }}>{p.nombre}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {estado === 'heredado' ? 'Del rol' : estado === 'permitido' ? 'Permitido' : estado === 'denegado' ? 'Denegado' : 'Sin acceso'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal Confirmar */}
      <ConfirmDialog
        open={!!modalConfirmar}
        title={modalConfirmar?.tipo === 'eliminar' ? 'Eliminar usuario' : modalConfirmar?.usuario?.activo ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          modalConfirmar?.tipo === 'eliminar'
            ? `¿Eliminar a ${modalConfirmar?.usuario?.nombre}? No se puede deshacer.`
            : `¿${modalConfirmar?.usuario?.activo ? 'Desactivar' : 'Activar'} a ${modalConfirmar?.usuario?.nombre}?`
        }
        variant={modalConfirmar?.tipo === 'eliminar' ? 'danger' : 'default'}
        confirmText="Confirmar"
        onConfirm={() => modalConfirmar?.tipo === 'eliminar' ? eliminarUsuario(modalConfirmar.usuario.id) : toggleActivo(modalConfirmar.usuario.id, modalConfirmar.usuario.activo)}
        onCancel={() => setModalConfirmar(null)}
      />

      <style>{`
        .alert.success { background: rgba(46,229,157,0.1); border: 1px solid rgba(46,229,157,0.3); color: var(--success); padding: 12px; border-radius: 8px; }
        .alert.error { background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); color: var(--error); padding: 12px; border-radius: 8px; }
      `}</style>
    </div>
  )
}
