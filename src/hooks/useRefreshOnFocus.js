import { useEffect, useRef } from 'react'

/**
 * Refresca datos cuando el usuario vuelve a la pestaña (visibility change)
 * o cuando la ventana recupera el foco.
 * Incluye un mínimo de 30s entre refrescos para no bombardear la API.
 */
export function useRefreshOnFocus(refrescarFn, { enabled = true, minInterval = 30_000 } = {}) {
  const lastRefresh = useRef(Date.now())

  useEffect(() => {
    if (!enabled || !refrescarFn) return

    const handleFocus = () => {
      const now = Date.now()
      if (now - lastRefresh.current < minInterval) return
      lastRefresh.current = now
      refrescarFn()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refrescarFn, enabled, minInterval])
}
