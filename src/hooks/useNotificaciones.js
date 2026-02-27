import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PAGE_SIZE = 30

export function useNotificaciones() {
  const { user } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [contadorNoLeidas, setContadorNoLeidas] = useState(0)
  const [filtro, setFiltro] = useState('todas')
  const [loading, setLoading] = useState(true)
  const [hayMas, setHayMas] = useState(true)
  const channelRef = useRef(null)
  const offsetRef = useRef(0)

  const contarNoLeidas = useCallback(async () => {
    if (!user?.id) return
    const { count } = await supabase
      .from('ventas_notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .eq('leida', false)
    setContadorNoLeidas(count || 0)
  }, [user?.id])

  const cargarNotificaciones = useCallback(async (reset = true) => {
    if (!user?.id) return
    setLoading(true)

    const offset = reset ? 0 : offsetRef.current

    let query = supabase
      .from('ventas_notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filtro === 'no_leidas') {
      query = query.eq('leida', false)
    }

    const { data, error } = await query
    if (error) { setLoading(false); return }

    const items = data || []
    if (reset) {
      setNotificaciones(items)
      offsetRef.current = items.length
    } else {
      setNotificaciones(prev => [...prev, ...items])
      offsetRef.current += items.length
    }

    setHayMas(items.length === PAGE_SIZE)
    setLoading(false)
  }, [user?.id, filtro])

  const cargarMas = useCallback(() => {
    if (!hayMas || loading) return
    cargarNotificaciones(false)
  }, [hayMas, loading, cargarNotificaciones])

  const marcarComoLeida = useCallback(async (notifId) => {
    const { error } = await supabase
      .from('ventas_notificaciones')
      .update({ leida: true })
      .eq('id', notifId)
    if (error) return
    setNotificaciones(prev => prev.map(n => n.id === notifId ? { ...n, leida: true } : n))
    setContadorNoLeidas(prev => Math.max(0, prev - 1))
  }, [])

  const marcarTodasComoLeidas = useCallback(async () => {
    if (!user?.id) return
    const { error } = await supabase
      .from('ventas_notificaciones')
      .update({ leida: true })
      .eq('usuario_id', user.id)
      .eq('leida', false)
    if (error) return
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
    setContadorNoLeidas(0)
  }, [user?.id])

  // Realtime subscription
  const suscribirseRealtime = useCallback(() => {
    if (!user?.id) return null

    const channel = supabase
      .channel(`notif-lista-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ventas_notificaciones',
        filter: `usuario_id=eq.${user.id}`,
      }, (payload) => {
        setNotificaciones(prev => [payload.new, ...prev])
        setContadorNoLeidas(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ventas_notificaciones',
        filter: `usuario_id=eq.${user.id}`,
      }, (payload) => {
        setNotificaciones(prev =>
          prev.map(n => n.id === payload.new.id ? payload.new : n)
        )
        contarNoLeidas()
      })
      .subscribe()

    channelRef.current = channel
    return channel
  }, [user?.id, contarNoLeidas])

  const desuscribirseRealtime = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  // Load on mount and filter change
  useEffect(() => {
    if (user?.id) {
      cargarNotificaciones(true)
      contarNoLeidas()
    }
  }, [user?.id, filtro])

  // Realtime
  useEffect(() => {
    if (user?.id) {
      suscribirseRealtime()
    }
    return () => desuscribirseRealtime()
  }, [user?.id])

  const refrescar = useCallback(() => {
    cargarNotificaciones(true)
    contarNoLeidas()
  }, [cargarNotificaciones, contarNoLeidas])

  return {
    notificaciones,
    contadorNoLeidas,
    filtro,
    loading,
    hayMas,

    setFiltro,

    cargarNotificaciones,
    cargarMas,
    contarNoLeidas,
    marcarComoLeida,
    marcarTodasComoLeidas,
    suscribirseRealtime,
    desuscribirseRealtime,

    refrescar,
  }
}
