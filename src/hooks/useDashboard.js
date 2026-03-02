import { useDashboardLayout } from './useDashboardLayout'
import { useDashboardData } from './useDashboardData'
import { useRefreshOnFocus } from './useRefreshOnFocus'

export function useDashboard() {
  const layoutHook = useDashboardLayout()
  const dataHook = useDashboardData(layoutHook.layout)

  useRefreshOnFocus(dataHook.refrescar, { enabled: !layoutHook.loading })

  const handleSave = () => {
    layoutHook.saveLayout(layoutHook.layout)
    layoutHook.setEditMode(false)
  }

  const handleReset = () => {
    layoutHook.resetLayout()
    layoutHook.setEditMode(false)
  }

  return {
    ...layoutHook,
    ...dataHook,
    handleSave,
    handleReset,
  }
}
