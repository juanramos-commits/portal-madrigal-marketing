import { useState, useEffect, useMemo } from 'react'
import { useVentasPermisos, ROLES_COMERCIALES, ROL_LABELS } from '../../hooks/useVentasPermisos'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmDialog from '../ui/ConfirmDialog'

// Agrupar permisos por submódulo para la UI
const MODULO_LABELS = {
  ventas_crm: 'CRM',
  ventas_ventas: 'Ventas',
  ventas_wallet: 'Wallet',
  ventas_dashboard: 'Dashboard',
  ventas_biblioteca: 'Biblioteca',
  ventas_calendario: 'Calendario',
  ventas_enlaces: 'Enlaces de agenda',
  ventas_notificaciones: 'Notificaciones',
  ventas_email: 'Email Marketing',
  ventas_outreach: 'Cold Outreach',
  ventas_ajustes: 'Ajustes',
}

const MODULO_ORDER = Object.keys(MODULO_LABELS)

function ChevronIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

// ========================================
// Vista 1: Matriz Por Rol
// ========================================
function VistaRoles({ permisos, matrizRoles, saving, onGuardar }) {
  const [matriz, setMatriz] = useState({})
  const [expandidos, setExpandidos] = useState({})
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    setMatriz(JSON.parse(JSON.stringify(matrizRoles)))
    setDirty(false)
  }, [matrizRoles])

  const grupos = useMemo(() => {
    const map = {}
    for (const p of permisos) {
      if (!map[p.modulo]) map[p.modulo] = []
      map[p.modulo].push(p)
    }
    return MODULO_ORDER
      .filter(m => map[m])
      .map(m => ({ modulo: m, label: MODULO_LABELS[m] || m, permisos: map[m] }))
  }, [permisos])

  // Inicializar todos expandidos
  useEffect(() => {
    const exp = {}
    for (const g of grupos) exp[g.modulo] = true
    setExpandidos(exp)
  }, [grupos])

  const togglePermiso = (rol, permisoId) => {
    setMatriz(prev => {
      const next = { ...prev }
      const arr = [...(next[rol] || [])]
      const idx = arr.indexOf(permisoId)
      if (idx >= 0) arr.splice(idx, 1)
      else arr.push(permisoId)
      next[rol] = arr
      return next
    })
    setDirty(true)
    setGuardado(false)
  }

  const toggleModuloRol = (rol, modulo) => {
    const permsModulo = permisos.filter(p => p.modulo === modulo).map(p => p.id)
    const current = matriz[rol] || []
    const allChecked = permsModulo.every(id => current.includes(id))
    setMatriz(prev => {
      const next = { ...prev }
      const arr = [...(next[rol] || [])]
      if (allChecked) {
        next[rol] = arr.filter(id => !permsModulo.includes(id))
      } else {
        const set = new Set(arr)
        permsModulo.forEach(id => set.add(id))
        next[rol] = [...set]
      }
      return next
    })
    setDirty(true)
    setGuardado(false)
  }

  const handleGuardar = async () => {
    setError(null)
    try {
      await onGuardar(matriz)
      setDirty(false)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al guardar permisos')
    }
  }

  return (
    <div>
      {/* Header de la tabla */}
      <div className="aj-perm-matrix-header">
        <div className="aj-perm-label-col">Permiso</div>
        {ROLES_COMERCIALES.map(rol => (
          <div key={rol} className="aj-perm-role-col">
            <span className={`aj-role-badge aj-role-${rol}`}>{ROL_LABELS[rol]}</span>
          </div>
        ))}
      </div>

      {/* Grupos de permisos */}
      {grupos.map(grupo => {
        const isOpen = expandidos[grupo.modulo]
        return (
          <div key={grupo.modulo} className="aj-perm-group">
            <div
              className="aj-perm-group-header"
              onClick={() => setExpandidos(prev => ({ ...prev, [grupo.modulo]: !prev[grupo.modulo] }))}
            >
              <div className="aj-perm-label-col" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChevronIcon open={isOpen} />
                <strong>{grupo.label}</strong>
                <span className="aj-perm-count">
                  {grupo.permisos.length}
                </span>
              </div>
              {ROLES_COMERCIALES.map(rol => {
                const permsModulo = grupo.permisos.map(p => p.id)
                const current = matriz[rol] || []
                const checked = permsModulo.filter(id => current.includes(id)).length
                const all = permsModulo.length
                return (
                  <div key={rol} className="aj-perm-role-col">
                    <button
                      className={`aj-perm-toggle-all ${checked === all ? 'all' : checked > 0 ? 'some' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleModuloRol(rol, grupo.modulo) }}
                      title={checked === all ? 'Quitar todos' : 'Marcar todos'}
                    >
                      {checked === all ? '✓' : checked > 0 ? '−' : ''}
                    </button>
                  </div>
                )
              })}
            </div>

            {isOpen && grupo.permisos.map(p => (
              <div key={p.id} className="aj-perm-row">
                <div className="aj-perm-label-col">
                  <span className="aj-perm-name">{p.nombre}</span>
                  <span className="aj-perm-desc">{p.descripcion}</span>
                </div>
                {ROLES_COMERCIALES.map(rol => {
                  const checked = (matriz[rol] || []).includes(p.id)
                  return (
                    <div key={rol} className="aj-perm-role-col">
                      <label className="aj-perm-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermiso(rol, p.id)}
                        />
                        <span className="aj-perm-checkmark" />
                      </label>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}

      {/* Botón guardar */}
      {error && <div className="aj-error">{error}</div>}
      <div className="aj-perm-actions">
        <button
          className="aj-btn-primary"
          onClick={handleGuardar}
          disabled={saving || !dirty}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {dirty && <span className="aj-perm-dirty">Hay cambios sin guardar</span>}
        {guardado && <span className="aj-perm-saved">Permisos guardados</span>}
      </div>
    </div>
  )
}

// ========================================
// Vista 2: Overrides Por Usuario
// ========================================
function VistaUsuarios({ permisos, matrizRoles, equipo, saving, onCargarOverrides, onGuardarOverrides, onResetearOverrides }) {
  const [usuarioId, setUsuarioId] = useState('')
  const [overridesLocal, setOverridesLocal] = useState([]) // [{ permiso_id, permitido }]
  const [expandidos, setExpandidos] = useState({})
  const [dirty, setDirty] = useState(false)
  const [loadingUser, setLoadingUser] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const usuarioSeleccionado = equipo.find(m => m.usuario_id === usuarioId)

  const grupos = useMemo(() => {
    const map = {}
    for (const p of permisos) {
      if (!map[p.modulo]) map[p.modulo] = []
      map[p.modulo].push(p)
    }
    return MODULO_ORDER
      .filter(m => map[m])
      .map(m => ({ modulo: m, label: MODULO_LABELS[m] || m, permisos: map[m] }))
  }, [permisos])

  useEffect(() => {
    const exp = {}
    for (const g of grupos) exp[g.modulo] = true
    setExpandidos(exp)
  }, [grupos])

  const handleSelectUser = async (uid) => {
    setUsuarioId(uid)
    setError(null)
    setGuardado(false)
    if (!uid) { setOverridesLocal([]); setDirty(false); return }
    setLoadingUser(true)
    try {
      const data = await onCargarOverrides(uid)
      setOverridesLocal(data || [])
      setDirty(false)
    } catch (e) {
      setError(e.message || 'Error al cargar permisos del usuario')
      setOverridesLocal([])
    } finally {
      setLoadingUser(false)
    }
  }

  // Calcular permisos heredados del rol
  const permisosHeredados = useMemo(() => {
    if (!usuarioSeleccionado) return new Set()
    const set = new Set()
    for (const rol of usuarioSeleccionado.roles) {
      for (const pid of (matrizRoles[rol] || [])) {
        set.add(pid)
      }
    }
    return set
  }, [usuarioSeleccionado, matrizRoles])

  const getOverride = (permisoId) => {
    return overridesLocal.find(o => o.permiso_id === permisoId)
  }

  const setOverride = (permisoId, valor) => {
    // valor: null (heredar), true (conceder), false (denegar)
    setOverridesLocal(prev => {
      if (valor === null) {
        return prev.filter(o => o.permiso_id !== permisoId)
      }
      const idx = prev.findIndex(o => o.permiso_id === permisoId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { permiso_id: permisoId, permitido: valor }
        return next
      }
      return [...prev, { permiso_id: permisoId, permitido: valor }]
    })
    setDirty(true)
    setGuardado(false)
  }

  const handleGuardar = async () => {
    setError(null)
    try {
      await onGuardarOverrides(usuarioId, overridesLocal)
      setDirty(false)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al guardar overrides')
    }
  }

  const handleResetear = async () => {
    setError(null)
    setConfirmReset(false)
    try {
      await onResetearOverrides(usuarioId)
      setOverridesLocal([])
      setDirty(false)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al resetear overrides')
    }
  }

  // Contar permisos efectivos
  const permisosEfectivos = useMemo(() => {
    let count = 0
    for (const p of permisos) {
      const override = getOverride(p.id)
      if (override) {
        if (override.permitido) count++
      } else if (permisosHeredados.has(p.id)) {
        count++
      }
    }
    return count
  }, [permisos, overridesLocal, permisosHeredados])

  return (
    <div>
      {/* Selector de usuario */}
      <div className="aj-perm-user-select">
        <label>Miembro del equipo</label>
        <select
          className="aj-select"
          value={usuarioId}
          onChange={(e) => handleSelectUser(e.target.value)}
        >
          <option value="">Seleccionar miembro...</option>
          {equipo.map(m => (
            <option key={m.usuario_id} value={m.usuario_id}>
              {m.usuario?.nombre || m.usuario?.email} — {m.roles.map(r => ROL_LABELS[r]).join(', ')}
            </option>
          ))}
        </select>
      </div>

      {loadingUser && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner" />
        </div>
      )}

      {error && <div className="aj-error">{error}</div>}

      {usuarioSeleccionado && !loadingUser && (
        <>
          {/* Info del usuario */}
          <div className="aj-perm-user-info">
            <div>
              <strong>{usuarioSeleccionado.usuario?.nombre}</strong>
              <span className="aj-perm-user-email">{usuarioSeleccionado.usuario?.email}</span>
            </div>
            <div className="aj-perm-user-meta">
              <div className="aj-card-roles">
                {usuarioSeleccionado.roles.map(r => (
                  <span key={r} className={`aj-role-badge aj-role-${r}`}>{ROL_LABELS[r]}</span>
                ))}
              </div>
              <span className="aj-perm-count-effective">
                {permisosEfectivos}/{permisos.length} permisos
              </span>
              {overridesLocal.length > 0 && (
                <span className="aj-perm-override-count">
                  {overridesLocal.length} override{overridesLocal.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Tabla de permisos con overrides */}
          <div className="aj-perm-matrix-header aj-perm-override-header">
            <div className="aj-perm-label-col">Permiso</div>
            <div className="aj-perm-role-col">Rol</div>
            <div className="aj-perm-override-col">Override</div>
          </div>

          {grupos.map(grupo => {
            const isOpen = expandidos[grupo.modulo]
            return (
              <div key={grupo.modulo} className="aj-perm-group">
                <div
                  className="aj-perm-group-header"
                  onClick={() => setExpandidos(prev => ({ ...prev, [grupo.modulo]: !prev[grupo.modulo] }))}
                >
                  <div className="aj-perm-label-col" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ChevronIcon open={isOpen} />
                    <strong>{grupo.label}</strong>
                  </div>
                  <div className="aj-perm-role-col" />
                  <div className="aj-perm-override-col" />
                </div>

                {isOpen && grupo.permisos.map(p => {
                  const heredado = permisosHeredados.has(p.id)
                  const override = getOverride(p.id)

                  return (
                    <div key={p.id} className={`aj-perm-row ${override ? 'aj-perm-row-override' : ''}`}>
                      <div className="aj-perm-label-col">
                        <span className="aj-perm-name">{p.nombre}</span>
                        <span className="aj-perm-desc">{p.descripcion}</span>
                      </div>
                      <div className="aj-perm-role-col">
                        <span className={`aj-perm-inherited ${heredado ? 'granted' : 'denied'}`}>
                          {heredado ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="aj-perm-override-col">
                        <div className="aj-perm-override-btns">
                          <button
                            className={`aj-perm-obtn ${override?.permitido === true ? 'active grant' : ''}`}
                            onClick={() => setOverride(p.id, override?.permitido === true ? null : true)}
                            title="Conceder"
                          >
                            ✓
                          </button>
                          <button
                            className={`aj-perm-obtn ${override?.permitido === false ? 'active deny' : ''}`}
                            onClick={() => setOverride(p.id, override?.permitido === false ? null : false)}
                            title="Denegar"
                          >
                            ✗
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Acciones */}
          <div className="aj-perm-actions">
            <button
              className="aj-btn-primary"
              onClick={handleGuardar}
              disabled={saving || !dirty}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {overridesLocal.length > 0 && (
              <button
                className="aj-btn-ghost aj-btn-danger"
                onClick={() => setConfirmReset(true)}
                disabled={saving}
              >
                Resetear overrides
              </button>
            )}
            {dirty && <span className="aj-perm-dirty">Hay cambios sin guardar</span>}
            {guardado && <span className="aj-perm-saved">Guardado</span>}
          </div>

          <ConfirmDialog
            open={confirmReset}
            title="Resetear overrides"
            message={<>¿Eliminar todos los overrides de <strong>{usuarioSeleccionado.usuario?.nombre}</strong>? El usuario volverá a heredar los permisos de sus roles.</>}
            variant="danger"
            confirmText="Resetear"
            onConfirm={handleResetear}
            onCancel={() => setConfirmReset(false)}
          />
        </>
      )}
    </div>
  )
}

// ========================================
// Componente principal
// ========================================
export default function AjustesPermisos() {
  const hook = useVentasPermisos()
  const { user, rolesComerciales, refrescarPermisos } = useAuth()
  const [vista, setVista] = useState('roles') // 'roles' | 'usuarios'

  useEffect(() => {
    if (user?.id && rolesComerciales.length > 0) {
      hook.cargarMatrizRoles()
    }
  }, [user?.id, rolesComerciales.length])

  const handleGuardarRoles = async (matriz) => {
    await hook.guardarMatrizCompleta(matriz)
    refrescarPermisos?.()
  }

  const handleGuardarOverrides = async (usuarioId, overrides) => {
    await hook.guardarOverridesUsuario(usuarioId, overrides)
    refrescarPermisos?.()
  }

  const handleResetearOverrides = async (usuarioId) => {
    await hook.resetearOverrides(usuarioId)
    refrescarPermisos?.()
  }

  if (hook.loading) {
    return (
      <div className="aj-seccion">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="aj-seccion aj-seccion-wide">
      <div className="aj-seccion-header">
        <h3>Permisos del equipo comercial</h3>
      </div>

      {/* Tabs de vista */}
      <div className="aj-perm-tabs">
        <button
          className={`aj-perm-tab ${vista === 'roles' ? 'active' : ''}`}
          onClick={() => setVista('roles')}
        >
          Por Rol
        </button>
        <button
          className={`aj-perm-tab ${vista === 'usuarios' ? 'active' : ''}`}
          onClick={() => setVista('usuarios')}
        >
          Por Usuario
        </button>
      </div>

      {vista === 'roles' ? (
        <VistaRoles
          permisos={hook.permisos}
          matrizRoles={hook.matrizRoles}
          saving={hook.saving}
          onGuardar={handleGuardarRoles}
        />
      ) : (
        <VistaUsuarios
          permisos={hook.permisos}
          matrizRoles={hook.matrizRoles}
          equipo={hook.equipo}
          saving={hook.saving}
          onCargarOverrides={hook.cargarOverridesUsuario}
          onGuardarOverrides={handleGuardarOverrides}
          onResetearOverrides={handleResetearOverrides}
        />
      )}
    </div>
  )
}
