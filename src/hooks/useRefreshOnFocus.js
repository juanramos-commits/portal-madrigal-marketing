import { useEffect, useRef } from 'react'

/**
 * Refresca datos cuando el usuario vuelve a la pestaña (visibility change)
 * o cuando la ventana recupera el foco.
 * Incluye un mínimo de 10s entre refrescos para no bombardear la API.
 * Uses a ref for the callback to avoid re-registering event listeners on every render.
 */
export function useRefreshOnFocus(refrescarFn, { enabled = true, minInterval = 10_000 } = {}) {
  const lastRefresh = useRef(Date.now())
  const callbackRef = useRef(refrescarFn)

  // Keep callback ref in sync without re-registering listeners
  useEffect(() => {
    callbackRef.current = refrescarFn
  }, [refrescarFn])

  useEffect(() => {
    if (!enabled) return

    const handleFocus = () => {
      const now = Date.now()
      if (now - lastRefresh.current < minInterval) return
      lastRefresh.current = now
      callbackRef.current?.()
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
  }, [enabled, minInterval])
}
