import { useState, useEffect, useCallback } from 'react'
import {
  getInboxes, createInbox, updateInbox, deleteInbox
} from '../lib/coldOutreach'

export function useOutreachInboxes() {
  const [inboxes, setInboxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async (domainId) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getInboxes(domainId)
      if (err) { setError(err.message); return }
      setInboxes(data || [])
    } catch (e) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  const crear = useCallback(async (inbox) => {
    const { data, error: err } = await createInbox(inbox)
    if (err) return { error: err }
    setInboxes(prev => [data, ...prev])
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateInbox(id, updates)
    if (err) return { error: err }
    setInboxes(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteInbox(id)
    if (err) return { error: err }
    setInboxes(prev => prev.filter(i => i.id !== id))
    return {}
  }, [])

  useEffect(() => { cargar() }, [])

  return {
    inboxes, loading, error,
    cargar, crear, actualizar, eliminar,
  }
}
