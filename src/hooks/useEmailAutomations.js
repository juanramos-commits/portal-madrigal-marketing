import { useState, useEffect, useCallback } from 'react'
import {
  getEmailAutomations, createEmailAutomation, updateEmailAutomation,
  deleteEmailAutomation, activateAutomation, deactivateAutomation
} from '../lib/emailMarketing'

export function useEmailAutomations() {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getEmailAutomations()
      if (err) { setError(err.message); return }
      setAutomations(data || [])
    } catch (e) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  const crear = useCallback(async (datos) => {
    const { data, error: err } = await createEmailAutomation(datos)
    if (err) return { error: err }
    setAutomations(prev => [data, ...prev])
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateEmailAutomation(id, updates)
    if (err) return { error: err }
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteEmailAutomation(id)
    if (err) return { error: err }
    setAutomations(prev => prev.filter(a => a.id !== id))
    return {}
  }, [])

  const activar = useCallback(async (id) => {
    const { data, error: err } = await activateAutomation(id)
    if (err) return { error: err }
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
    return { data }
  }, [])

  const desactivar = useCallback(async (id) => {
    const { data, error: err } = await deactivateAutomation(id)
    if (err) return { error: err }
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
    return { data }
  }, [])

  useEffect(() => { cargar() }, [])

  return {
    automations, loading, error,
    cargar, crear, actualizar, eliminar, activar, desactivar,
  }
}
