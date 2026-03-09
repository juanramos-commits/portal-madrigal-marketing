import { useState, useCallback } from 'react'
import {
  getReplies, classifyReply, markReplyActioned
} from '../lib/coldOutreach'

export function useOutreachReplies() {
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const cargar = useCallback(async ({ campaignId, classification, requiresAction, page, limit } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getReplies({
        campaignId, classification, requiresAction, page, limit
      })
      if (err) { setError(err.message); return }
      setReplies(data || [])
    } catch (e) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  const clasificar = useCallback(async (id, { classification, sentiment }) => {
    const { data, error: err } = await classifyReply(id, { classification, sentiment })
    if (err) return { error: err }
    setReplies(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
    return { data }
  }, [])

  const marcarGestionada = useCallback(async (id, userId) => {
    const { data, error: err } = await markReplyActioned(id, userId)
    if (err) return { error: err }
    setReplies(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
    return { data }
  }, [])

  return {
    replies, loading, error,
    cargar, clasificar, marcarGestionada,
  }
}
