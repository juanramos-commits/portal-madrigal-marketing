import { useEffect, useRef } from 'react'

/**
 * Refresca datos cuando el usuario vuelve a la pestaña (visibility change)
 * o cuando la ventana recupera el foco.
 * - 2 min mínimo entre refrescos para no bombardear la API (free tier Supabase)
 * - 1.5s delay after focus to let realtime events flush first
 * - Deduplicates visibilitychange + focus events (fire together)
 * Uses a ref for the callback to avoid re-registering event listeners on every render.
 */
export function useRefreshOnFocus(refrescarFn, { enabled = true, minInterval = 120_000 } = {}) {
  const lastRefresh = useRef(Date.now())
  const callbackRef = useRef(refrescarFn)
  const pendingTimerRef = useRef(null)

  // Keep callback ref in sync without re-registering listeners
  useEffect(() => {
    callbackRef.current = refrescarFn
  }, [refrescarFn])

  useEffect(() => {
    if (!enabled) return

    const scheduleRefresh = () => {
      const now = Date.now()
      if (now - lastRefresh.current < minInterval) return

      // Cancel any pending refresh (deduplicates visibility + focus firing together)
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)

      // Delay 1.5s to let realtime events flush first (they debounce at 1.2s)
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null
        lastRefresh.current = Date.now()
        callbackRef.current?.()
      }, 1500)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh()
      } else {
        // Tab hidden — cancel any pending refresh
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current)
          pendingTimerRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    // Don't listen to 'focus' separately — visibilitychange is sufficient
    // and avoids double-firing on mobile browsers

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    }
  }, [enabled, minInterval])
}
