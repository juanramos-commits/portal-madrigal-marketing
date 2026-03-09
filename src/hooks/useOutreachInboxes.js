import { useState, useEffect, useCallback } from 'react'
import {
  getOutreachInboxes, createOutreachInbox, updateOutreachInbox, deleteOutreachInbox
} from '../lib/coldOutreach'

export function useOutreachInboxes() {
  const [inboxes, setInboxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async (domainId) => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getOutreachInboxes({ domainId })

    if (err) { setError(err.message); setLoading(false); return }
    setInboxes(data || [])
    setLoading(false)
  }, [])

  const crear = useCallback(async (inbox) => {
    const { data, error: err } = await createOutreachInbox(inbox)
    if (err) return { error: err }
    setInboxes(prev => [data, ...prev])
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateOutreachInbox(id, updates)
    if (err) return { error: err }
    setInboxes(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteOutreachInbox(id)
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
