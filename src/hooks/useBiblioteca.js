import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { useDebounce } from './useDebounce'
import { logActividad } from '../lib/logActividad'

const ROLES_VISIBLES = ['setter', 'closer', 'director_ventas', 'super_admin']

export function useBiblioteca() {
  const { user, usuario, tienePermiso, rolesComerciales } = useAuth()

  const [secciones, setSecciones] = useState([])
  const [recursos, setRecursos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 300)
  const [modoGestion, setModoGestion] = useState(false)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Roles
  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esCloser = misRoles.some(r => r.rol === 'closer')
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esDirector = misRoles.some(r => r.rol === 'director_ventas') || esAdmin
  const puedeGestionar = tienePermiso('ventas.biblioteca.gestionar_secciones')
  const puedeGestionarRecursos = tienePermiso('ventas.biblioteca.gestionar_recursos')

  // My role keys for visibility filtering (memoized to avoid breaking useMemo deps)
  const misRolesKeys = useMemo(() => {
    const keys = []
    if (esSetter) keys.push('setter')
    if (esCloser) keys.push('closer')
    if (esDirector) keys.push('director_ventas')
    if (esAdmin) keys.push('super_admin')
    return keys
  }, [esSetter, esCloser, esDirector, esAdmin])

  const rolesLoaded = rolesComerciales.length > 0 || esAdmin

  // Auto-expand sections that have matching resources when searching
  useEffect(() => {
    if (!busquedaDebounced.trim()) return
    const term = busquedaDebounced.toLowerCase()
    const matchingSecciones = new Set()
    for (const r of recursos) {
      if (
        r.nombre?.toLowerCase().includes(term) ||
        r.descripcion?.toLowerCase().includes(term) ||
        r.url?.toLowerCase().includes(term)
      ) {
        matchingSecciones.add(r.seccion_id)
      }
    }
    // Also match section names
    for (const s of secciones) {
      if (s.nombre?.toLowerCase().includes(term) || s.descripcion?.toLowerCase().includes(term)) {
        matchingSecciones.add(s.id)
      }
    }
    if (matchingSecciones.size > 0) {
      setSeccionesAbiertas(matchingSecciones)
    }
  }, [busquedaDebounced, recursos, secciones])

  // Load secciones
  const cargarSecciones = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('ventas_biblioteca_secciones')
      .select('id, nombre, descripcion, orden, activo')
      .eq('activo', true)
      .order('orden', { ascending: true })
    if (err) { setError('Error al cargar secciones'); return }
    setSecciones(data || [])
  }, [])

  // Load recursos
  const cargarRecursos = useCallback(async () => {
    let query = supabase
      .from('ventas_biblioteca_recursos')
      .select('id, seccion_id, nombre, descripcion, url, tipo, visible_para, orden, activo')
      .eq('activo', true)
      .order('orden', { ascending: true })

    const { data, error: err } = await query
    if (err) { setError('Error al cargar recursos'); return }
    setRecursos(data || [])
  }, [])

  // Initial load
  useEffect(() => {
    if (user?.id && rolesLoaded) {
      const cargar = async () => {
        setLoading(true)
        setError(null)
        try {
          await Promise.all([cargarSecciones(), cargarRecursos()])
        } catch {
          setError('Error al cargar la biblioteca')
        } finally {
          setLoading(false)
        }
      }
      cargar()
    }
  }, [user?.id, rolesLoaded, cargarSecciones, cargarRecursos])

  // Filter recursos by visibility (unless admin/director or in management mode)
  const recursosFiltrados = useMemo(() => {
    let filtered = recursos

    // Visibility filter: non-admins only see resources where their role is in visible_para
    if (!puedeGestionar) {
      filtered = filtered.filter(r => {
        if (!r.visible_para || r.visible_para.length === 0) return false
        return r.visible_para.some(vp => misRolesKeys.includes(vp))
      })
    }

    // Search filter
    if (busquedaDebounced.trim()) {
      const term = busquedaDebounced.toLowerCase()
      filtered = filtered.filter(r =>
        r.nombre?.toLowerCase().includes(term) ||
        r.descripcion?.toLowerCase().includes(term) ||
        r.url?.toLowerCase().includes(term)
      )
    }

    return filtered
  }, [recursos, puedeGestionar, misRolesKeys, busquedaDebounced])

  // Filtered secciones (hide empty secciones when searching, unless admin)
  const seccionesFiltradas = useMemo(() => {
    if (!busquedaDebounced.trim() && !modoGestion) return secciones

    const term = busquedaDebounced.toLowerCase()
    return secciones.filter(s => {
      // Section matches by name/description
      const seccionMatch = term && (
        s.nombre?.toLowerCase().includes(term) ||
        s.descripcion?.toLowerCase().includes(term)
      )
      // Section has matching recursos
      const tieneRecursos = recursosFiltrados.some(r => r.seccion_id === s.id)
      // In management mode, show all
      if (modoGestion) return true
      if (!term) return true
      return seccionMatch || tieneRecursos
    })
  }, [secciones, recursosFiltrados, busquedaDebounced, modoGestion])

  // Toggle section open/closed
  const toggleSeccion = useCallback((seccionId) => {
    setSeccionesAbiertas(prev => {
      const next = new Set(prev)
      if (next.has(seccionId)) {
        next.delete(seccionId)
      } else {
        next.add(seccionId)
      }
      return next
    })
  }, [])

  // Expand all
  const expandirTodas = useCallback(() => {
    setSeccionesAbiertas(new Set(secciones.map(s => s.id)))
  }, [secciones])

  // Collapse all
  const colapsarTodas = useCallback(() => {
    setSeccionesAbiertas(new Set())
  }, [])

  // CRUD: Create sección
  const crearSeccion = useCallback(async (datos) => {
    if (!puedeGestionar) throw new Error('No tienes permiso para gestionar secciones')
    const maxOrden = secciones.reduce((max, s) => Math.max(max, s.orden || 0), 0)
    const { data, error: err } = await supabase
      .from('ventas_biblioteca_secciones')
      .insert({
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        orden: maxOrden + 1,
        activo: true,
      })
      .select()
      .single()
    if (err) throw err
    setSecciones(prev => [...prev, data])
    logActividad('biblioteca', 'crear', `Sección creada: ${datos.nombre}`, { entidad: 'seccion', entidad_id: data.id })
    return data
  }, [secciones])

  // CRUD: Update sección
  const actualizarSeccion = useCallback(async (seccionId, datos) => {
    if (!puedeGestionar) throw new Error('No tienes permiso para gestionar secciones')
    const { data, error: err } = await supabase
      .from('ventas_biblioteca_secciones')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', seccionId)
      .select()
      .single()
    if (err) throw err
    setSecciones(prev => prev.map(s => s.id === seccionId ? data : s))
    logActividad('biblioteca', 'editar', `Sección actualizada: ${datos.nombre || ''}`, { entidad: 'seccion', entidad_id: seccionId })
    return data
  }, [])

  // CRUD: Delete sección (soft delete)
  const eliminarSeccion = useCallback(async (seccionId) => {
    if (!puedeGestionar) throw new Error('No tienes permiso para gestionar secciones')
    const { error: err } = await supabase
      .from('ventas_biblioteca_secciones')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', seccionId)
    if (err) throw err
    setSecciones(prev => prev.filter(s => s.id !== seccionId))
    logActividad('biblioteca', 'eliminar', 'Sección eliminada', { entidad: 'seccion', entidad_id: seccionId })
    // Also soft delete recursos in this section
    await supabase
      .from('ventas_biblioteca_recursos')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('seccion_id', seccionId)
    setRecursos(prev => prev.filter(r => r.seccion_id !== seccionId))
  }, [])

  // CRUD: Create recurso
  const crearRecurso = useCallback(async (datos) => {
    if (!puedeGestionarRecursos) throw new Error('No tienes permiso para gestionar recursos')
    const recursosEnSeccion = recursos.filter(r => r.seccion_id === datos.seccion_id)
    const maxOrden = recursosEnSeccion.reduce((max, r) => Math.max(max, r.orden || 0), 0)
    const { data, error: err } = await supabase
      .from('ventas_biblioteca_recursos')
      .insert({
        seccion_id: datos.seccion_id,
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        url: datos.url || null,
        tipo: datos.tipo || 'otro',
        visible_para: datos.visible_para || ROLES_VISIBLES,
        orden: maxOrden + 1,
        activo: true,
      })
      .select()
      .single()
    if (err) throw err
    setRecursos(prev => [...prev, data])
    logActividad('biblioteca', 'crear', `Recurso creado: ${datos.nombre}`, { entidad: 'recurso', entidad_id: data.id })
    return data
  }, [recursos])

  // CRUD: Update recurso
  const actualizarRecurso = useCallback(async (recursoId, datos) => {
    if (!puedeGestionarRecursos) throw new Error('No tienes permiso para gestionar recursos')
    const { data, error: err } = await supabase
      .from('ventas_biblioteca_recursos')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', recursoId)
      .select()
      .single()
    if (err) throw err
    setRecursos(prev => prev.map(r => r.id === recursoId ? data : r))
    logActividad('biblioteca', 'editar', `Recurso actualizado: ${datos.nombre || ''}`, { entidad: 'recurso', entidad_id: recursoId })
    return data
  }, [])

  // CRUD: Delete recurso (soft delete)
  const eliminarRecurso = useCallback(async (recursoId) => {
    if (!puedeGestionarRecursos) throw new Error('No tienes permiso para gestionar recursos')
    const { error: err } = await supabase
      .from('ventas_biblioteca_recursos')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', recursoId)
    if (err) throw err
    setRecursos(prev => prev.filter(r => r.id !== recursoId))
    logActividad('biblioteca', 'eliminar', 'Recurso eliminado', { entidad: 'recurso', entidad_id: recursoId })
  }, [])

  // Reorder secciones
  const reordenarSecciones = useCallback(async (nuevasIds) => {
    if (!puedeGestionar) throw new Error('No tienes permiso para gestionar secciones')
    // Optimistic update
    const nuevasSecciones = nuevasIds.map((id, i) => {
      const s = secciones.find(x => x.id === id)
      return { ...s, orden: i + 1 }
    })
    setSecciones(nuevasSecciones)

    // Persist
    const updates = nuevasIds.map((id, i) =>
      supabase
        .from('ventas_biblioteca_secciones')
        .update({ orden: i + 1, updated_at: new Date().toISOString() })
        .eq('id', id)
    )
    try {
      await Promise.all(updates)
    } catch (err) {
      console.warn('Error al reordenar secciones:', err)
      await cargarSecciones()
    }
  }, [secciones, cargarSecciones])

  // Reorder recursos within a section
  const reordenarRecursos = useCallback(async (seccionId, nuevasIds) => {
    if (!puedeGestionarRecursos) throw new Error('No tienes permiso para gestionar recursos')
    // Optimistic update
    const otrosRecursos = recursos.filter(r => r.seccion_id !== seccionId)
    const nuevosRecursos = nuevasIds.map((id, i) => {
      const r = recursos.find(x => x.id === id)
      return { ...r, orden: i + 1 }
    })
    setRecursos([...otrosRecursos, ...nuevosRecursos].sort((a, b) => (a.orden || 0) - (b.orden || 0)))

    // Persist
    const updates = nuevasIds.map((id, i) =>
      supabase
        .from('ventas_biblioteca_recursos')
        .update({ orden: i + 1, updated_at: new Date().toISOString() })
        .eq('id', id)
    )
    try {
      await Promise.all(updates)
    } catch (err) {
      console.warn('Error al reordenar recursos:', err)
      await cargarRecursos()
    }
  }, [recursos, cargarRecursos])

  // Refresh all data
  const refrescar = useCallback(async () => {
    await Promise.all([cargarSecciones(), cargarRecursos()])
  }, [cargarSecciones, cargarRecursos])

  // Refresh on tab focus
  useRefreshOnFocus(refrescar, { enabled: !!user?.id })

  // Copy URL to clipboard
  const copiarAlPortapapeles = useCallback(async (texto) => {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch (err) {
      console.warn('Error al copiar al portapapeles:', err)
      return false
    }
  }, [])

  return {
    secciones, recursos, loading, error,
    busqueda, setBusqueda, busquedaDebounced,
    modoGestion, setModoGestion,
    seccionesAbiertas, toggleSeccion, expandirTodas, colapsarTodas,
    puedeGestionar, puedeGestionarRecursos, esAdmin, esDirector, esCloser, esSetter,
    misRolesKeys,

    recursosFiltrados,
    seccionesFiltradas,

    crearSeccion, actualizarSeccion, eliminarSeccion,
    crearRecurso, actualizarRecurso, eliminarRecurso,
    reordenarSecciones, reordenarRecursos,
    copiarAlPortapapeles,

    rolesVisibles: ROLES_VISIBLES,
  }
}
