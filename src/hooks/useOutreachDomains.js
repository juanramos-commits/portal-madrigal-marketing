import { useState, useEffect, useCallback } from 'react'
import {
  getOutreachDomains, createOutreachDomain, updateOutreachDomain, deleteOutreachDomain
} from '../lib/coldOutreach'

export function useOutreachDomains() {
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getOutreachDomains()

    if (err) { setError(err.message); setLoading(false); return }
    setDomains(data || [])
    setLoading(false)
  }, [])

  const crear = useCallback(async (domain) => {
    const { data, error: err } = await createOutreachDomain(domain)
    if (err) return { error: err }
    setDomains(prev => [data, ...prev])
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateOutreachDomain(id, updates)
    if (err) return { error: err }
    setDomains(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteOutreachDomain(id)
    if (err) return { error: err }
    setDomains(prev => prev.filter(d => d.id !== id))
    return {}
  }, [])

  useEffect(() => { cargar() }, [])

  return {
    domains, loading, error,
    cargar, crear, actualizar, eliminar,
  }
}
