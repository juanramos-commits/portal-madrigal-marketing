import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useNotificacionesBadge() {
  const { user } = useAuth()
  const [contador, setContador] = useState(0)
  const channelRef = useRef(null)

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

    const channel = supabase
      .channel(`notif-badge-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ventas_notificaciones',
        filter: `usuario_id=eq.${user.id}`,
      }, (payload) => {
        if (!payload.new.leida) setContador(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ventas_notificaciones',
        filter: `usuario_id=eq.${user.id}`,
      }, () => {
        cargarConteo()
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'ventas_notificaciones',
        filter: `usuario_id=eq.${user.id}`,
      }, () => {
        cargarConteo()
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
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
