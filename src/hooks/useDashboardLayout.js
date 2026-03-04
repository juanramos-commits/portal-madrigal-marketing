import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_LAYOUTS } from '../config/defaultLayouts'
import { WIDGET_CATALOG } from '../config/widgetCatalog'

function getUserRole(usuario, rolesComerciales, userId) {
  if (usuario?.tipo === 'super_admin') return 'admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === userId)
  if (misRoles.some(r => r.rol === 'director_ventas')) return 'director_ventas'
  if (misRoles.some(r => r.rol === 'closer')) return 'closer'
  if (misRoles.some(r => r.rol === 'setter')) return 'setter'
  return 'admin'
}

export function useDashboardLayout() {
  const { user, usuario, tienePermiso, rolesComerciales } = useAuth()
  const [layout, setLayout] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rol, setRol] = useState(null)
  const initialLoadDone = useRef(false)

  // Reset initialLoadDone when user changes (logout → new login)
  const prevUserId = useRef(null)
  useEffect(() => {
    if (user?.id !== prevUserId.current) {
      prevUserId.current = user?.id
      initialLoadDone.current = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    setRol(getUserRole(usuario, rolesComerciales, user.id))
  }, [usuario, rolesComerciales, user?.id])

  useEffect(() => {
    if (!user?.id || !rol) return
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const cargar = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('dashboard_layouts')
          .select('layout')
          .eq('usuario_id', user.id)
          .maybeSingle()

        if (data?.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          const puedeVerEquipo = tienePermiso('ventas.dashboard.ver_equipo')
          const filtered = data.layout.filter(item => {
            const def = WIDGET_CATALOG[item.type]
            if (!def) return false
            if (def.category === 'team' && !puedeVerEquipo) return false
            return def.roles.includes(rol)
          })
          setLayout(filtered.length > 0 ? filtered : (DEFAULT_LAYOUTS[rol] || []))
        } else {
          setLayout(DEFAULT_LAYOUTS[rol] || [])
        }
      } catch (e) {
        import.meta.env.DEV && console.error('Error loading dashboard layout:', e)
        setLayout(DEFAULT_LAYOUTS[rol] || [])
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [user?.id, rol])

  const saveLayout = useCallback(async (newLayout) => {
    if (!user?.id) return
    try {
      await supabase.from('dashboard_layouts')
        .upsert({
          usuario_id: user.id,
          layout: newLayout,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'usuario_id' })
    } catch (e) {
      import.meta.env.DEV && console.error('Error saving dashboard layout:', e)
    }
  }, [user?.id])

  const onLayoutChange = useCallback((rglLayout) => {
    setLayout(prev => {
      const map = new Map(rglLayout.map(item => [item.i, item]))
      return prev.map(item => {
        const rglItem = map.get(item.i)
        if (!rglItem) return item
        return { ...item, x: rglItem.x, y: rglItem.y, w: rglItem.w, h: rglItem.h }
      })
    })
  }, [])

  const addWidget = useCallback((widgetType) => {
    const def = WIDGET_CATALOG[widgetType]
    if (!def) return
    const id = `${widgetType}_${Date.now()}`
    const item = {
      i: id, type: widgetType,
      x: 0, y: Infinity,
      w: def.defaultSize.w, h: def.defaultSize.h,
    }
    if (def.defaultConfig) item.config = { ...def.defaultConfig }
    setLayout(prev => [...prev, item])
  }, [])

  const removeWidget = useCallback((widgetId) => {
    setLayout(prev => prev.filter(item => item.i !== widgetId))
  }, [])

  const resetLayout = useCallback(() => {
    const defaults = DEFAULT_LAYOUTS[rol] || []
    setLayout(defaults)
    saveLayout(defaults)
  }, [rol, saveLayout])

  return {
    layout, setLayout, editMode, setEditMode,
    loading, layoutLoading: loading, rol, rolesComerciales,
    onLayoutChange, addWidget, removeWidget,
    saveLayout, resetLayout,
  }
}
