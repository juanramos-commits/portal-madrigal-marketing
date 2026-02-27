import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useNotificacionesBadge() {
  const { user } = useAuth()
  const [contador, setContador] = useState(0)
  const channelRef = useRef(null)

  const cargarConteo = useCallback(async () => {
    if (!user?.id) return
    const { count } = await supabase
      .from('ventas_notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .eq('leida', false)
    setContador(count || 0)
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
      }, () => {
        setContador(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
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

  return { contador, refrescar: cargarConteo }
}
