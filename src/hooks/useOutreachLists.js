import { useState, useEffect, useCallback } from 'react'
import {
  getOutreachLists, createOutreachList, updateOutreachList, deleteOutreachList,
  getOutreachListStats
} from '../lib/coldOutreach'

export function useOutreachLists() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getOutreachLists()

    if (err) { setError(err.message); setLoading(false); return }
    setLists(data || [])
    setLoading(false)
  }, [])

  const crear = useCallback(async (list) => {
    const { data, error: err } = await createOutreachList(list)
    if (err) return { error: err }
    setLists(prev => [data, ...prev])
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateOutreachList(id, updates)
    if (err) return { error: err }
    setLists(prev => prev.map(l => l.id === id ? { ...l, ...data } : l))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteOutreachList(id)
    if (err) return { error: err }
    setLists(prev => prev.filter(l => l.id !== id))
    return {}
  }, [])

  const cargarStats = useCallback(async (listId) => {
    const { data, error: err } = await getOutreachListStats(listId)
    if (err) return { error: err }
    return { data }
  }, [])

  useEffect(() => { cargar() }, [])

  return {
    lists, loading, error,
    cargar, crear, actualizar, eliminar, cargarStats,
  }
}
