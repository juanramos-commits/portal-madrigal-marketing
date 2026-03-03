import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const PAGE_SIZE = 30
const NOTIF_COLUMNS = 'id,tipo,titulo,mensaje,datos,leida,created_at,usuario_id'

export function useNotificaciones() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [notificaciones, setNotificaciones] = useState([])
  const [contadorNoLeidas, setContadorNoLeidas] = useState(0)
  const [filtro, setFiltro] = useState('todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hayMas, setHayMas] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState(null)
  const hasConnectedRef = useRef(false)
  const channelRef = useRef(null)
  const offsetRef = useRef(0)
  const filtroRef = useRef(filtro)
  const markingAllRef = useRef(false)
  const pendingDeletesRef = useRef({})
  const pendingMarkAllRef = useRef(null)

  const contarNoLeidas = useCallback(async () => {
    if (!user?.id) return
    try {
      const { count, error: countErr } = await supabase
        .from('ventas_notificaciones')
        .select('id', { count: 'exact', head: true })
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
        .select(NOTIF_COLUMNS)
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (filtro === 'no_leidas') {
        query = query.eq('leida', false)
      }

      const { data, error: queryErr } = await query
      if (queryErr) {
        setError('No se pudieron cargar las notificaciones')
        setHayMas(false)
        return
      }

      const items = data || []
      if (reset) {
        setNotificaciones(items)
        offsetRef.current = items.length
      } else {
        setNotificaciones(prev => {
          const existingIds = new Set(prev.map(n => n.id))
          const newItems = items.filter(n => !existingIds.has(n.id))
          return [...prev, ...newItems]
        })
        offsetRef.current += items.length
      }

      setHayMas(items.length === PAGE_SIZE)
    } catch {
      setError('Error de conexión al cargar notificaciones')
      setHayMas(false)
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
    let wasUnread = false
    setNotificaciones(prev => {
      const target = prev.find(n => n.id === notifId)
      if (!target || target.leida) return prev
      wasUnread = true
      return filtroRef.current === 'no_leidas'
        ? prev.filter(n => n.id !== notifId)
        : prev.map(n => n.id === notifId ? { ...n, leida: true } : n)
    })
    if (!wasUnread) return
    setContadorNoLeidas(prev => Math.max(0, prev - 1))
    try {
      const { error: updateErr } = await supabase
        .from('ventas_notificaciones')
        .update({ leida: true })
        .eq('id', notifId)
        .eq('usuario_id', user?.id)
      if (updateErr) {
        cargarNotificaciones(true)
        contarNoLeidas()
      }
    } catch {
      cargarNotificaciones(true)
      contarNoLeidas()
    }
  }, [user?.id, cargarNotificaciones, contarNoLeidas])

  const ejecutarMarcarTodas = useCallback(async () => {
    pendingMarkAllRef.current = null
    try {
      const { error: updateErr } = await supabase
        .from('ventas_notificaciones')
        .update({ leida: true })
        .eq('usuario_id', user?.id)
        .eq('leida', false)
      if (updateErr) {
        cargarNotificaciones(true)
        contarNoLeidas()
      }
    } catch {
      cargarNotificaciones(true)
      contarNoLeidas()
    } finally {
      markingAllRef.current = false
    }
  }, [user?.id, cargarNotificaciones, contarNoLeidas])

  const marcarTodasComoLeidas = useCallback(() => {
    if (!user?.id || markingAllRef.current) return

    markingAllRef.current = true
    const clearingList = filtroRef.current === 'no_leidas'

    let prevNotifs = null
    let prevCount = 0
    const prevOffset = offsetRef.current

    setNotificaciones(prev => {
      prevNotifs = prev
      return clearingList ? [] : prev.map(n => ({ ...n, leida: true }))
    })
    if (clearingList) offsetRef.current = 0
    setContadorNoLeidas(prev => { prevCount = prev; return 0 })

    // Delayed update — fires after toast auto-dismiss + exit animation
    const timerId = setTimeout(() => {
      ejecutarMarcarTodas()
    }, 5200)

    pendingMarkAllRef.current = { timerId, prevNotifs, prevCount, prevOffset }

    showToast('Todas marcadas como leídas', 'success', 5000, {
      label: 'Deshacer',
      onClick: () => {
        if (!pendingMarkAllRef.current) return
        clearTimeout(pendingMarkAllRef.current.timerId)
        const { prevNotifs: pn, prevCount: pc, prevOffset: po } = pendingMarkAllRef.current
        pendingMarkAllRef.current = null
        markingAllRef.current = false
        setNotificaciones(pn)
        setContadorNoLeidas(pc)
        offsetRef.current = po
      },
    })
  }, [user?.id, ejecutarMarcarTodas, showToast])

  const ejecutarDelete = useCallback(async (notifId, removedItem) => {
    delete pendingDeletesRef.current[notifId]
    try {
      const { error: delErr } = await supabase
        .from('ventas_notificaciones')
        .delete()
        .eq('id', notifId)
        .eq('usuario_id', user?.id)
      if (delErr) restaurarItem(removedItem)
    } catch {
      restaurarItem(removedItem)
    }

    function restaurarItem(item) {
      setNotificaciones(prev => {
        if (prev.some(n => n.id === item.id)) return prev
        return [...prev, item].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )
      })
      if (!item.leida) setContadorNoLeidas(c => c + 1)
    }
  }, [user?.id])

  const eliminarNotificacion = useCallback((notifId) => {
    if (!notifId || !user?.id) return

    // Optimistic remove from UI
    let removedItem = null
    setNotificaciones(prev => {
      removedItem = prev.find(n => n.id === notifId)
      return removedItem ? prev.filter(n => n.id !== notifId) : prev
    })
    if (!removedItem) return
    if (!removedItem.leida) setContadorNoLeidas(c => Math.max(0, c - 1))

    // Delayed delete — fires after toast auto-dismiss + exit animation
    const timerId = setTimeout(() => {
      ejecutarDelete(notifId, removedItem)
    }, 5200)

    pendingDeletesRef.current[notifId] = { timerId, removedItem }

    showToast('Notificación eliminada', 'info', 5000, {
      label: 'Deshacer',
      onClick: () => {
        clearTimeout(pendingDeletesRef.current[notifId]?.timerId)
        delete pendingDeletesRef.current[notifId]
        setNotificaciones(prev => {
          if (prev.some(n => n.id === notifId)) return prev
          return [...prev, removedItem].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          )
        })
        if (!removedItem.leida) setContadorNoLeidas(c => c + 1)
      },
    })
  }, [user?.id, ejecutarDelete, showToast])

  // Realtime subscription
  const suscribirseRealtime = useCallback(() => {
    if (!user?.id) return null
    // Clean up any existing subscription before creating a new one
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    const channel = supabase
      .channel(`notif-lista-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ventas_notificaciones',
        filter: `usuario_id=eq.${user.id}`,
      }, (payload) => {
        const isUnread = !payload.new.leida
        if (filtroRef.current === 'no_leidas' && !isUnread) return
        setNotificaciones(prev => {
          if (prev.some(n => n.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })
        if (isUnread) setContadorNoLeidas(prev => prev + 1)
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          hasConnectedRef.current = true
          setRealtimeStatus('connected')
        } else if (hasConnectedRef.current) {
          if (status === 'CHANNEL_ERROR') setRealtimeStatus('error')
          else if (status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeStatus('reconnecting')
        }
      })

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
  }, [user?.id, filtro, cargarNotificaciones, contarNoLeidas])

  // Realtime
  useEffect(() => {
    if (user?.id) {
      suscribirseRealtime()
    }
    return () => desuscribirseRealtime()
  }, [user?.id, suscribirseRealtime, desuscribirseRealtime])

  // Refresh stale data when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        contarNoLeidas()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user?.id, contarNoLeidas])

  // Flush pending operations on unmount
  useEffect(() => {
    return () => {
      Object.entries(pendingDeletesRef.current).forEach(([id, { timerId, removedItem }]) => {
        clearTimeout(timerId)
        ejecutarDelete(id, removedItem)
      })
      if (pendingMarkAllRef.current) {
        clearTimeout(pendingMarkAllRef.current.timerId)
        ejecutarMarcarTodas()
      }
    }
  }, [ejecutarDelete, ejecutarMarcarTodas])

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
    realtimeStatus,

    setFiltro,

    cargarMas,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,

    refrescar,
  }
}
