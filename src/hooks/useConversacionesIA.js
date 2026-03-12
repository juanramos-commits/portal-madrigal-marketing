import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Play a short beep using Web Audio API for new inbound messages
function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.3)
  } catch (e) {
    // Silently fail if audio context is not available
  }
}

// Update document title with unread count
function updateTitleBadge(count) {
  const base = 'Portal Madrigal'
  if (count > 0) {
    document.title = `(${count}) ${base}`
  } else {
    document.title = base
  }
}

const ESTADO_ORDER = {
  needs_reply: 0,
  handoff_humano: 1,
  waiting_reply: 2,
  scheduled_followup: 3,
  qualify: 4,
  meeting_pref: 5,
  agendado: 6,
  no_response: 7,
  descartado: 8,
  queued: 9,
}

export function useConversacionesIA(agenteId) {
  const [conversaciones, setConversaciones] = useState([])
  const [conversacionActiva, setConversacionActiva] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMensajes, setLoadingMensajes] = useState(false)
  const [sending, setSending] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const subscriptionRef = useRef(null)
  const msgSubscriptionRef = useRef(null)
  const conversacionActivaRef = useRef(null)
  const unreadCountRef = useRef(0)

  // Keep ref in sync
  useEffect(() => {
    conversacionActivaRef.current = conversacionActiva
  }, [conversacionActiva])

  // Load conversations for this agent
  const cargarConversaciones = useCallback(async () => {
    if (!agenteId) return
    setLoading(true)
    try {
      // If searching, first find matching lead IDs
      let leadIds = null
      if (busqueda.trim()) {
        const searchTerm = `%${busqueda.trim()}%`
        const { data: matchingLeads } = await supabase
          .from('ia_leads')
          .select('id')
          .or(`nombre.ilike.${searchTerm},telefono.ilike.${searchTerm}`)
          .limit(100)
        leadIds = (matchingLeads || []).map(l => l.id)
        if (leadIds.length === 0) {
          setConversaciones([])
          return
        }
      }

      let query = supabase
        .from('ia_conversaciones')
        .select(`
          *,
          lead:ia_leads(id, nombre, telefono, email, sentimiento_actual, lead_score, opted_out)
        `)
        .eq('agente_id', agenteId)
        .order('updated_at', { ascending: false })
        .limit(100)

      if (filtro !== 'todas') {
        if (filtro === 'sin_leer') {
          query = query.eq('leida', false)
        } else if (filtro === 'humano') {
          query = query.eq('handoff_humano', true)
        } else {
          query = query.eq('estado', filtro)
        }
      }

      if (leadIds) {
        query = query.in('lead_id', leadIds)
      }

      const { data, error } = await query
      if (error) throw error

      // Sort: unread first, then by estado priority, then by updated_at
      const sorted = (data || []).sort((a, b) => {
        if (a.leida !== b.leida) return a.leida ? 1 : -1
        const orderA = ESTADO_ORDER[a.estado] ?? 99
        const orderB = ESTADO_ORDER[b.estado] ?? 99
        if (orderA !== orderB) return orderA - orderB
        return new Date(b.updated_at) - new Date(a.updated_at)
      })

      setConversaciones(sorted)

      // Update unread count and title badge
      const unread = sorted.filter(c => !c.leida).length
      unreadCountRef.current = unread
      updateTitleBadge(unread)
    } catch (err) {
      console.error('Error cargando conversaciones:', err)
    } finally {
      setLoading(false)
    }
  }, [agenteId, filtro, busqueda])

  // Load messages for a conversation
  const cargarMensajes = useCallback(async (conversacionId) => {
    if (!conversacionId) return
    setLoadingMensajes(true)
    try {
      const { data, error } = await supabase
        .from('ia_mensajes')
        .select('*')
        .eq('conversacion_id', conversacionId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) throw error
      setMensajes(data || [])
    } catch (err) {
      console.error('Error cargando mensajes:', err)
    } finally {
      setLoadingMensajes(false)
    }
  }, [])

  // Select a conversation
  const seleccionarConversacion = useCallback(async (conv) => {
    setConversacionActiva(conv)
    if (conv) {
      await cargarMensajes(conv.id)
      // Mark as read
      if (!conv.leida) {
        const { error } = await supabase
          .from('ia_conversaciones')
          .update({ leida: true })
          .eq('id', conv.id)
        if (!error) {
          setConversaciones(prev => {
            const updated = prev.map(c => c.id === conv.id ? { ...c, leida: true } : c)
            // Recalculate unread count
            const unread = updated.filter(c => !c.leida).length
            unreadCountRef.current = unread
            updateTitleBadge(unread)
            return updated
          })
        }
      }
    } else {
      setMensajes([])
    }
  }, [cargarMensajes])

  // Send a message as human — returns { ok, error } for UI feedback
  const enviarMensaje = useCallback(async (texto) => {
    if (!conversacionActiva || !texto.trim()) return { ok: false, error: 'Sin conversación o texto' }
    const convId = conversacionActiva.id
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('ia-whatsapp-send', {
        body: {
          agente_id: agenteId,
          conversacion_id: convId,
          to: conversacionActiva.lead?.telefono,
          sender: 'humano',
          messages: [{ type: 'text', content: texto }],
        },
      })
      if (error) {
        return { ok: false, error: error.message || 'Error al enviar' }
      }
      if (data?.error) {
        return { ok: false, error: data.error }
      }
      // Reload messages after a short delay, only if still on the same conversation
      setTimeout(() => {
        if (conversacionActivaRef.current?.id === convId) {
          cargarMensajes(convId)
        }
      }, 1000)
      return { ok: true }
    } catch (err) {
      console.error('Error enviando mensaje:', err)
      return { ok: false, error: err.message || 'Error de conexión' }
    } finally {
      setSending(false)
    }
  }, [conversacionActiva, agenteId, cargarMensajes])

  // Add internal note
  const agregarNota = useCallback(async (texto) => {
    if (!conversacionActiva || !texto.trim()) return
    try {
      const { error } = await supabase
        .from('ia_mensajes')
        .insert({
          conversacion_id: conversacionActiva.id,
          direction: 'outbound',
          sender: 'humano',
          content: texto,
          message_type: 'nota_interna',
        })
      if (error) throw error
      await cargarMensajes(conversacionActiva.id)
    } catch (err) {
      console.error('Error agregando nota:', err)
      throw err
    }
  }, [conversacionActiva, cargarMensajes])

  // Toggle chatbot on/off for conversation
  const toggleChatbot = useCallback(async (conversacionId, activo) => {
    try {
      const updates = { chatbot_activo: activo }
      if (!activo) {
        updates.handoff_humano = true
      } else {
        updates.handoff_humano = false
      }
      const { error } = await supabase
        .from('ia_conversaciones')
        .update(updates)
        .eq('id', conversacionId)
      if (error) throw error
      setConversaciones(prev =>
        prev.map(c => c.id === conversacionId ? { ...c, ...updates } : c)
      )
      setConversacionActiva(prev =>
        prev?.id === conversacionId ? { ...prev, ...updates } : prev
      )
    } catch (err) {
      console.error('Error toggling chatbot:', err)
      throw err
    }
  }, [])

  // Realtime subscription for conversations
  useEffect(() => {
    if (!agenteId) return

    cargarConversaciones()

    const channelId = `ia-convos-${agenteId}-${Date.now()}`
    subscriptionRef.current = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ia_conversaciones',
          filter: `agente_id=eq.${agenteId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            cargarConversaciones()
            // New conversation = new inbound lead, play beep
            if (payload.new && !payload.new.leida) {
              playNotificationBeep()
              unreadCountRef.current += 1
              updateTitleBadge(unreadCountRef.current)
            }
          } else if (payload.eventType === 'UPDATE') {
            // Merge UPDATE without overwriting joined `lead` data
            setConversaciones(prev =>
              prev.map(c => {
                if (c.id !== payload.new.id) return c
                const { lead, ...rest } = payload.new
                return { ...c, ...rest }
              })
            )
            // Update active conversation via functional updater (avoids stale closure)
            setConversacionActiva(prev => {
              if (!prev || prev.id !== payload.new.id) return prev
              const { lead, ...rest } = payload.new
              return { ...prev, ...rest }
            })
          }
        }
      )
      .subscribe()

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [agenteId, filtro, busqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription for messages of active conversation
  useEffect(() => {
    if (!conversacionActiva?.id) return

    if (msgSubscriptionRef.current) {
      supabase.removeChannel(msgSubscriptionRef.current)
    }

    const channelId = `ia-msgs-${conversacionActiva.id}-${Date.now()}`
    msgSubscriptionRef.current = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ia_mensajes',
          filter: `conversacion_id=eq.${conversacionActiva.id}`,
        },
        (payload) => {
          setMensajes(prev => {
            // Deduplicate
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          // Play notification sound for inbound messages
          if (payload.new.direction === 'inbound') {
            playNotificationBeep()
            unreadCountRef.current += 1
            updateTitleBadge(unreadCountRef.current)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ia_mensajes',
          filter: `conversacion_id=eq.${conversacionActiva.id}`,
        },
        (payload) => {
          setMensajes(prev =>
            prev.map(m => m.id === payload.new.id ? { ...payload.new } : m)
          )
        }
      )
      .subscribe()

    return () => {
      if (msgSubscriptionRef.current) {
        supabase.removeChannel(msgSubscriptionRef.current)
      }
    }
  }, [conversacionActiva?.id])

  // Send message with optional media attachment — returns { ok, error }
  const enviarMensajeConMedia = useCallback(async (texto, mediaUrl, mediaType) => {
    if (!conversacionActiva) return { ok: false, error: 'Sin conversación' }
    if (!texto?.trim() && !mediaUrl) return { ok: false, error: 'Sin contenido' }
    const convId = conversacionActiva.id
    setSending(true)
    try {
      const payload = {
        agente_id: agenteId,
        conversacion_id: convId,
        to: conversacionActiva.lead?.telefono,
        sender: 'humano',
        messages: [{ type: mediaType || 'text', content: texto || '', media_url: mediaUrl || undefined }],
      }
      const { data, error } = await supabase.functions.invoke('ia-whatsapp-send', {
        body: payload,
      })
      if (error) {
        return { ok: false, error: error.message || 'Error al enviar' }
      }
      if (data?.error) {
        return { ok: false, error: data.error }
      }
      setTimeout(() => {
        if (conversacionActivaRef.current?.id === convId) {
          cargarMensajes(convId)
        }
      }, 1000)
      return { ok: true }
    } catch (err) {
      console.error('Error enviando mensaje con media:', err)
      return { ok: false, error: err.message || 'Error de conexión' }
    } finally {
      setSending(false)
    }
  }, [conversacionActiva, agenteId, cargarMensajes])

  return {
    conversaciones,
    conversacionActiva,
    mensajes,
    loading,
    loadingMensajes,
    sending,
    filtro,
    busqueda,
    setFiltro,
    setBusqueda,
    cargarConversaciones,
    seleccionarConversacion,
    enviarMensaje,
    enviarMensajeConMedia,
    agregarNota,
    toggleChatbot,
  }
}
