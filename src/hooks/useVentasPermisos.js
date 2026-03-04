import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLES_COMERCIALES = ['setter', 'closer', 'director_ventas']
const ROL_LABELS = { setter: 'Setter', closer: 'Closer', director_ventas: 'Director' }

export { ROLES_COMERCIALES, ROL_LABELS }

export function useVentasPermisos() {
  const { rolesComerciales } = useAuth()
  const [permisos, setPermisos] = useState([])
  const [matrizRoles, setMatrizRoles] = useState({}) // { setter: [permisoId, ...], closer: [...], director_ventas: [...] }
  const [overrides, setOverrides] = useState([]) // [{ permiso_id, permitido }]
  const [equipo, setEquipo] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Cargar todos los permisos ventas.*
  const cargarPermisos = useCallback(async () => {
    const { data } = await supabase
      .from('permisos')
      .select('id, codigo, modulo, nombre, descripcion, orden')
      .like('codigo', 'ventas.%')
      .order('orden')
    setPermisos(data || [])
    return data || []
  }, [])

  // Cargar matriz: permisos asignados a cada rol comercial
  const cargarMatrizRoles = useCallback(async () => {
    setLoading(true)
    try {
      const [, matrizData] = await Promise.all([
        cargarPermisos(),
        supabase.from('ventas_roles_permisos').select('rol_comercial, permiso_id'),
      ])

      const matriz = {}
      for (const rol of ROLES_COMERCIALES) {
        matriz[rol] = []
      }
      for (const row of (matrizData.data || [])) {
        if (matriz[row.rol_comercial]) {
          matriz[row.rol_comercial].push(row.permiso_id)
        }
      }
      setMatrizRoles(matriz)

      // Derivar equipo de rolesComerciales del contexto
      const map = {}
      for (const r of rolesComerciales) {
        if (!map[r.usuario_id]) {
          map[r.usuario_id] = { usuario_id: r.usuario_id, usuario: r.usuario, roles: [] }
        }
        map[r.usuario_id].roles.push(r.rol)
      }
      setEquipo(Object.values(map))
    } catch (err) {
      console.error('Error cargando permisos:', err)
    } finally {
      setLoading(false)
    }
  }, [cargarPermisos, rolesComerciales])

  // Guardar permisos de un rol completo (reemplaza todos)
  const guardarPermisosRol = useCallback(async (rol, permisoIds) => {
    setSaving(true)
    try {
      // Eliminar existentes
      const { error: delError } = await supabase.from('ventas_roles_permisos').delete().eq('rol_comercial', rol)
      if (delError) throw delError
      // Insertar nuevos
      if (permisoIds.length > 0) {
        const inserts = permisoIds.map(pid => ({ rol_comercial: rol, permiso_id: pid }))
        const { error } = await supabase.from('ventas_roles_permisos').insert(inserts)
        if (error) throw error
      }
    } finally {
      setSaving(false)
    }
  }, [])

  // Guardar toda la matriz de roles de una vez
  const guardarMatrizCompleta = useCallback(async (nuevaMatriz) => {
    setSaving(true)
    try {
      // Eliminar todos los permisos de rol
      const { error: delError } = await supabase.from('ventas_roles_permisos').delete().in('rol_comercial', ROLES_COMERCIALES)
      if (delError) throw delError
      // Insertar todos los nuevos
      const inserts = []
      for (const rol of ROLES_COMERCIALES) {
        for (const pid of (nuevaMatriz[rol] || [])) {
          inserts.push({ rol_comercial: rol, permiso_id: pid })
        }
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('ventas_roles_permisos').insert(inserts)
        if (error) throw error
      }
      setMatrizRoles(nuevaMatriz)
    } finally {
      setSaving(false)
    }
  }, [])

  // Cargar overrides de un usuario
  const cargarOverridesUsuario = useCallback(async (usuarioId) => {
    const { data } = await supabase
      .from('ventas_usuarios_permisos')
      .select('permiso_id, permitido')
      .eq('usuario_id', usuarioId)
    setOverrides(data || [])
    return data || []
  }, [])

  // Guardar overrides de un usuario (reemplaza todos)
  const guardarOverridesUsuario = useCallback(async (usuarioId, nuevosOverrides) => {
    setSaving(true)
    try {
      // Eliminar existentes
      const { error: delError } = await supabase.from('ventas_usuarios_permisos').delete().eq('usuario_id', usuarioId)
      if (delError) throw delError
      // Insertar nuevos
      if (nuevosOverrides.length > 0) {
        const inserts = nuevosOverrides.map(o => ({
          usuario_id: usuarioId,
          permiso_id: o.permiso_id,
          permitido: o.permitido,
        }))
        const { error } = await supabase.from('ventas_usuarios_permisos').insert(inserts)
        if (error) throw error
      }
      setOverrides(nuevosOverrides)
    } finally {
      setSaving(false)
    }
  }, [])

  // Resetear todos los overrides de un usuario
  const resetearOverrides = useCallback(async (usuarioId) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('ventas_usuarios_permisos').delete().eq('usuario_id', usuarioId)
      if (error) throw error
      setOverrides([])
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    permisos,
    matrizRoles,
    overrides,
    equipo,
    loading,
    saving,
    cargarPermisos,
    cargarMatrizRoles,
    guardarPermisosRol,
    guardarMatrizCompleta,
    cargarOverridesUsuario,
    guardarOverridesUsuario,
    resetearOverrides,
  }
}
