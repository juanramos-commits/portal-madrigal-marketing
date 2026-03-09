import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useNotificacionesBadge() {
  const { user } = useAuth()
  const [contador, setContador] = useState(0)
  const intervalRef = useRef(null)

  const cargarConteo = useCallback(async () => {
    if (!user?.id) return
    try {
      const { count, error } = await supabase
        .from('ventas_notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('leida', false)
      if (!error) setContador(count || 0)
    } catch (err) {
      console.warn('Error cargando conteo de notificaciones:', err)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    cargarConteo()

    // Poll every 30s instead of maintaining a separate realtime channel
    // (the useNotificaciones hook already has a realtime subscription for the same table)
    intervalRef.current = setInterval(cargarConteo, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [user?.id, cargarConteo])

  // Refresh stale badge when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        cargarConteo()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user?.id, cargarConteo])

  return { contador, refrescar: cargarConteo }
}
