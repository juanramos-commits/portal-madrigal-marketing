import { useState, useEffect, useCallback } from 'react'
import {
  getEmailSegments, createEmailSegment, updateEmailSegment,
  deleteEmailSegment, previewSegment
} from '../lib/emailMarketing'

export function useEmailSegments() {
  const [segments, setSegments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getEmailSegments()

    if (err) { setError(err.message); setLoading(false); return }
    setSegments(data || [])
    setLoading(false)
  }, [])

  const crear = useCallback(async (datos) => {
    const { data, error: err } = await createEmailSegment(datos)
    if (err) return { error: err }
    setSegments(prev => [...prev, data])
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateEmailSegment(id, updates)
    if (err) return { error: err }
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteEmailSegment(id)
    if (err) return { error: err }
    setSegments(prev => prev.filter(s => s.id !== id))
    return {}
  }, [])

  const preview = useCallback(async (segmentId) => {
    const { data, error: err } = await previewSegment(segmentId)
    if (err) return { error: err }
    return { data }
  }, [])

  useEffect(() => { cargar() }, [])

  return {
    segments, loading, error,
    cargar, crear, actualizar, eliminar, preview,
  }
}
