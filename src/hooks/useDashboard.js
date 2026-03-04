import { useMemo, useCallback, useState } from 'react'
import { useDashboardLayout } from './useDashboardLayout'
import { useDashboardData } from './useDashboardData'
import { useRefreshOnFocus } from './useRefreshOnFocus'

export function useDashboard() {
  const layoutHook = useDashboardLayout()
  const dataHook = useDashboardData(layoutHook.layout)
  const [isSaving, setIsSaving] = useState(false)

  useRefreshOnFocus(dataHook.refrescar, { enabled: !layoutHook.loading })

  const handleSave = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await layoutHook.saveLayout(layoutHook.layout)
      layoutHook.setEditMode(false)
    } catch (e) {
      import.meta.env.DEV && console.error('Error guardando layout:', e)
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, layoutHook.saveLayout, layoutHook.layout, layoutHook.setEditMode])

  const handleReset = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await layoutHook.resetLayout()
      layoutHook.setEditMode(false)
    } catch (e) {
      import.meta.env.DEV && console.error('Error reseteando layout:', e)
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, layoutHook.resetLayout, layoutHook.setEditMode])

  const miembrosEquipo = useMemo(() => {
    const seen = new Map()
    for (const r of layoutHook.rolesComerciales || []) {
      if (!r.activo || seen.has(r.usuario_id) || !['closer', 'setter'].includes(r.rol)) continue
      seen.set(r.usuario_id, {
        id: r.usuario_id,
        nombre: r.usuario?.nombre || r.usuario?.email || r.usuario_id,
        rol: r.rol,
      })
    }
    return [...seen.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [layoutHook.rolesComerciales])

  return {
    ...layoutHook,
    ...dataHook,
    loading: layoutHook.loading || dataHook.loading,
    layoutLoading: layoutHook.loading,
    dataLoading: dataHook.loading,
    miembrosEquipo,
    handleSave,
    handleReset,
    isSaving,
  }
}
