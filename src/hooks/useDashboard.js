import { useMemo } from 'react'
import { useDashboardLayout } from './useDashboardLayout'
import { useDashboardData } from './useDashboardData'
import { useRefreshOnFocus } from './useRefreshOnFocus'

export function useDashboard() {
  const layoutHook = useDashboardLayout()
  const dataHook = useDashboardData(layoutHook.layout)

  useRefreshOnFocus(dataHook.refrescar, { enabled: !layoutHook.loading })

  const handleSave = async () => {
    await layoutHook.saveLayout(layoutHook.layout)
    layoutHook.setEditMode(false)
  }

  const handleReset = async () => {
    await layoutHook.resetLayout()
    layoutHook.setEditMode(false)
  }

  const miembrosEquipo = useMemo(() => {
    const seen = new Map()
    for (const r of layoutHook.rolesComerciales || []) {
      if (!r.activo || seen.has(r.usuario_id)) continue
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
  }
}
