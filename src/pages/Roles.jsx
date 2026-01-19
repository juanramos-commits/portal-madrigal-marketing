import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Iconos
const Icons = {
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Edit: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  X: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Users: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

// Nombres de módulos legibles
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
  sistema: { nombre: 'Sistema', icono: '⚙️' }
}

export default function Roles() {
  const { tienePermiso } = useAuth()
  const [roles, setRoles] = useState([])
  const [permisos, setPermisos] = useState([])
  const [usuariosPorRol, setUsuariosPorRol] = useState({})
  const [loading, setLoading] = useState(true)
  
  const [modalEditar, setModalEditar] = useState(null)
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', color: '#6B7280', nivel: 50 })
  const [permisosSeleccionados, setPermisosSeleccionados] = useState([])
  const [editLoading, setEditLoading] = useState(false)
  const [modulosExpandidos, setModulosExpandidos] = useState({})

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .order('nivel', { ascending: false })
      setRoles(rolesData || [])

      const { data: permisosData } = await supabase
        .from('permisos')
        .select('*')
        .order('orden', { ascending: true })
      setPermisos(permisosData || [])

      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('rol_id')

      const conteo = {}
      usuariosData?.forEach(u => {
        if (u.rol_id) conteo[u.rol_id] = (conteo[u.rol_id] || 0) + 1
      })
      setUsuariosPorRol(conteo)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const permisosPorModulo = permisos.reduce((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = []
    acc[p.modulo].push(p)
    return acc
  }, {})

  const abrirModalEditar = async (rol = null) => {
    if (rol) {
      setEditForm({
        nombre: rol.nombre,
        descripcion: rol.descripcion || '',
        color: rol.color || '#6B7280',
        nivel: rol.nivel || 50
      })
      const { data } = await supabase
        .from('roles_permisos')
        .select('permiso_id')
        .eq('rol_id', rol.id)
      setPermisosSeleccionados(data?.map(p => p.permiso_id) || [])
    } else {
      setEditForm({ nombre: '', descripcion: '', color: '#6B7280', nivel: 50 })
      setPermisosSeleccionados([])
    }
    const expanded = {}
    Object.keys(permisosPorModulo).forEach(m => expanded[m] = true)
    setModulosExpandidos(expanded)
    setModalEditar(rol || 'nuevo')
  }

  const guardarRol = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    try {
      let rolId = modalEditar === 'nuevo' ? null : modalEditar.id

      if (modalEditar === 'nuevo') {
        const { data, error } = await supabase
          .from('roles')
          .insert({
            nombre: editForm.nombre,
            descripcion: editForm.descripcion,
            color: editForm.color,
            nivel: editForm.nivel,
            es_sistema: false
          })
          .select()
          .single()
        if (error) throw error
        rolId = data.id
      } else {
        const { error } = await supabase
          .from('roles')
          .update({
            nombre: editForm.nombre,
            descripcion: editForm.descripcion,
            color: editForm.color,
            nivel: editForm.nivel
          })
          .eq('id', rolId)
        if (error) throw error
      }

      await supabase.from('roles_permisos').delete().eq('rol_id', rolId)

      if (permisosSeleccionados.length > 0) {
        await supabase.from('roles_permisos').insert(
          permisosSeleccionados.map(permisoId => ({ rol_id: rolId, permiso_id: permisoId }))
        )
      }

      setModalEditar(null)
      cargarDatos()
    } catch (error) {
      console.error('Error guardando rol:', error)
    } finally {
      setEditLoading(false)
    }
  }

  const eliminarRol = async (rolId) => {
    if (!confirm('¿Eliminar este rol?')) return
    try {
      await supabase.from('roles').delete().eq('id', rolId)
      cargarDatos()
    } catch (error) {
      console.error('Error eliminando rol:', error)
    }
  }

  const togglePermiso = (permisoId) => {
    setPermisosSeleccionados(prev =>
      prev.includes(permisoId) ? prev.filter(id => id !== permisoId) : [...prev, permisoId]
    )
  }

  const toggleModulo = (modulo) => {
    const ids = permisosPorModulo[modulo]?.map(p => p.id) || []
    const todos = ids.every(id => permisosSeleccionados.includes(id))
    setPermisosSeleccionados(prev =>
      todos ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    )
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
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="h1">Roles</h1>
            <p className="sub">Gestiona los roles y sus permisos</p>
          </div>
          {tienePermiso('roles.crear') && (
            <button onClick={() => abrirModalEditar()} className="btn primary">
              <Icons.Plus /> Crear Rol
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {roles.map(rol => (
          <div key={rol.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${rol.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '18px' }}>🔐</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {rol.nombre}
                    {rol.es_sistema && <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-muted)' }}>SISTEMA</span>}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{rol.descripcion || 'Sin descripción'}</p>
                </div>
              </div>
              {!rol.es_sistema && rol.nombre !== 'Super Admin' && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {tienePermiso('roles.editar') && <button onClick={() => abrirModalEditar(rol)} className="btn btn-icon btn-sm"><Icons.Edit /></button>}
                  {tienePermiso('roles.eliminar') && <button onClick={() => eliminarRol(rol.id)} className="btn btn-icon btn-sm" style={{ color: 'var(--error)' }}><Icons.Trash /></button>}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icons.Users />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{usuariosPorRol[rol.id] || 0} usuarios</span>
              </div>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: rol.color }} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nivel {rol.nivel}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalEditar && (
        <div className="modal-overlay" onClick={() => setModalEditar(null)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="h3">{modalEditar === 'nuevo' ? 'Crear Rol' : `Editar ${modalEditar.nombre}`}</h2>
              <button onClick={() => setModalEditar(null)} className="btn btn-icon"><Icons.X /></button>
            </div>
            <form onSubmit={guardarRol}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="field">
                  <label className="field-label">Nombre</label>
                  <input type="text" value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className="input" required />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field-label">Color</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="color" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} style={{ width: '40px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }} />
                      <input type="text" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="input" style={{ flex: 1 }} />
                    </div>
                  </div>
                  <div className="field" style={{ width: '100px' }}>
                    <label className="field-label">Nivel</label>
                    <input type="number" value={editForm.nivel} onChange={(e) => setEditForm({ ...editForm, nivel: parseInt(e.target.value) || 0 })} className="input" min="0" max="99" />
                  </div>
                </div>
              </div>
              <div className="field" style={{ marginBottom: '24px' }}>
                <label className="field-label">Descripción</label>
                <input type="text" value={editForm.descripcion} onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })} className="input" />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className="field-label" style={{ marginBottom: '12px', display: 'block' }}>Permisos ({permisosSeleccionados.length})</label>
                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  {Object.entries(permisosPorModulo).map(([modulo, perms]) => {
                    const expandido = modulosExpandidos[modulo]
                    const todos = perms.every(p => permisosSeleccionados.includes(p.id))
                    const algunos = perms.some(p => permisosSeleccionados.includes(p.id))
                    return (
                      <div key={modulo}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setModulosExpandidos(prev => ({ ...prev, [modulo]: !prev[modulo] }))}>
                          <span style={{ color: 'var(--text-muted)' }}>{expandido ? <Icons.ChevronDown /> : <Icons.ChevronRight />}</span>
                          <span style={{ fontSize: '16px' }}>{MODULOS[modulo]?.icono || '📁'}</span>
                          <span style={{ flex: 1, fontWeight: 500 }}>{MODULOS[modulo]?.nombre || modulo}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleModulo(modulo) }} style={{ padding: '4px 8px', fontSize: '12px', background: todos ? 'var(--success)' : algunos ? 'var(--warning)' : 'rgba(255,255,255,0.1)', color: todos || algunos ? '#000' : 'var(--text)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            {todos ? 'Todos' : algunos ? 'Algunos' : 'Ninguno'}
                          </button>
                        </div>
                        {expandido && (
                          <div style={{ padding: '8px 16px 8px 48px' }}>
                            {perms.map(p => (
                              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', cursor: 'pointer' }}>
                                <input type="checkbox" checked={permisosSeleccionados.includes(p.id)} onChange={() => togglePermiso(p.id)} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                                <div>
                                  <div style={{ fontSize: '14px', color: 'var(--text)' }}>{p.nombre}</div>
                                  {p.descripcion && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.descripcion}</div>}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalEditar(null)} className="btn">Cancelar</button>
                <button type="submit" disabled={editLoading} className="btn primary">{editLoading ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px; }
        .modal-content { background: var(--bg); border: 1px solid var(--border); border-radius: 16px; padding: 24px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
        .modal-content.modal-lg { max-width: 700px; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .modal-header h2 { margin: 0; }
      `}</style>
    </div>
  )
}
