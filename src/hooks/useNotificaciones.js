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
  const [error, setError] = useState(null)
  const [hayMas, setHayMas] = useState(true)
  const channelRef = useRef(null)
  const offsetRef = useRef(0)
  const filtroRef = useRef(filtro)

  const contarNoLeidas = useCallback(async () => {
    if (!user?.id) return
    try {
      const { count, error: countErr } = await supabase
        .from('ventas_notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('leida', false)
      if (!countErr) setContadorNoLeidas(count || 0)
    } catch {
      // Non-critical — badge will show stale count
    }
  }, [user?.id])

  const cargarNotificaciones = useCallback(async (reset = true) => {
    if (!user?.id) return
    setLoading(true)
    setError(null)

    try {
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

      const { data, error: queryErr } = await query
      if (queryErr) {
        setError('No se pudieron cargar las notificaciones')
        setLoading(false)
        return
      }

      const items = data || []
      if (reset) {
        setNotificaciones(items)
        offsetRef.current = items.length
      } else {
        setNotificaciones(prev => [...prev, ...items])
        offsetRef.current += items.length
      }

      setHayMas(items.length === PAGE_SIZE)
    } catch {
      setError('Error de conexión al cargar notificaciones')
    } finally {
      setLoading(false)
    }
  }, [user?.id, filtro])

  const cargarMas = useCallback(() => {
    if (!hayMas || loading) return
    cargarNotificaciones(false)
  }, [hayMas, loading, cargarNotificaciones])

  const marcarComoLeida = useCallback(async (notifId) => {
    if (!notifId) return
    // Optimistic update — remove from list when filtering unread
    setNotificaciones(prev =>
      filtro === 'no_leidas'
        ? prev.filter(n => n.id !== notifId)
        : prev.map(n => n.id === notifId ? { ...n, leida: true } : n)
    )
    setContadorNoLeidas(prev => Math.max(0, prev - 1))
    try {
      const { error: updateErr } = await supabase
        .from('ventas_notificaciones')
        .update({ leida: true })
        .eq('id', notifId)
        .eq('usuario_id', user?.id)
      if (updateErr) {
        // Rollback — reload to restore correct state
        cargarNotificaciones(true)
        contarNoLeidas()
      }
    } catch {
      cargarNotificaciones(true)
      contarNoLeidas()
    }
  }, [user?.id, filtro, cargarNotificaciones, contarNoLeidas])

  const marcarTodasComoLeidas = useCallback(async () => {
    if (!user?.id) return
    // Capture snapshot for rollback inside updaters
    let snapshotNotifs = null
    let snapshotCount = 0
    setNotificaciones(prev => {
      snapshotNotifs = prev
      return filtroRef.current === 'no_leidas' ? [] : prev.map(n => ({ ...n, leida: true }))
    })
    setContadorNoLeidas(prev => { snapshotCount = prev; return 0 })
    try {
      const { error: updateErr } = await supabase
        .from('ventas_notificaciones')
        .update({ leida: true })
        .eq('usuario_id', user.id)
        .eq('leida', false)
      if (updateErr) {
        setNotificaciones(snapshotNotifs)
        setContadorNoLeidas(snapshotCount)
      }
    } catch {
      setNotificaciones(snapshotNotifs)
      setContadorNoLeidas(snapshotCount)
    }
  }, [user?.id])

  const eliminarNotificacion = useCallback(async (notifId) => {
    if (!notifId || !user?.id) return
    // Capture current state for rollback before optimistic update
    let removedItem = null
    setNotificaciones(prev => {
      removedItem = prev.find(n => n.id === notifId)
      return prev.filter(n => n.id !== notifId)
    })
    if (removedItem && !removedItem.leida) setContadorNoLeidas(c => Math.max(0, c - 1))
    try {
      const { error: delErr } = await supabase
        .from('ventas_notificaciones')
        .delete()
        .eq('id', notifId)
        .eq('usuario_id', user.id)
      if (delErr) {
        // Rollback — re-insert at correct position
        setNotificaciones(prev => {
          const restored = [...prev, removedItem].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          )
          return restored
        })
        if (removedItem && !removedItem.leida) setContadorNoLeidas(c => c + 1)
      }
    } catch {
      setNotificaciones(prev => {
        const restored = [...prev, removedItem].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )
        return restored
      })
      if (removedItem && !removedItem.leida) setContadorNoLeidas(c => c + 1)
    }
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
        if (filtroRef.current === 'no_leidas' && payload.new.leida) {
          // Remove read notification from unread-only list
          setNotificaciones(prev => prev.filter(n => n.id !== payload.new.id))
        } else {
          setNotificaciones(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new : n)
          )
        }
        contarNoLeidas()
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'ventas_notificaciones',
        filter: `usuario_id=eq.${user.id}`,
      }, (payload) => {
        setNotificaciones(prev => prev.filter(n => n.id !== payload.old.id))
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

  // Keep filtroRef in sync
  useEffect(() => { filtroRef.current = filtro }, [filtro])

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
    error,
    hayMas,

    setFiltro,

    cargarNotificaciones,
    cargarMas,
    contarNoLeidas,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
    suscribirseRealtime,
    desuscribirseRealtime,

    refrescar,
  }
}
