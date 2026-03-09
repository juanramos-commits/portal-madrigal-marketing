import { useState, useEffect, useCallback } from 'react'
import {
  getEmailTemplates, createEmailTemplate, updateEmailTemplate,
  deleteEmailTemplate, duplicateEmailTemplate
} from '../lib/emailMarketing'

export function useEmailTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getEmailTemplates({ search })
      if (err) { setError(err.message); return }
      setTemplates(data || [])
    } catch (e) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [search])

  const crear = useCallback(async (datos) => {
    const { data, error: err } = await createEmailTemplate(datos)
    if (err) return { error: err }
    setTemplates(prev => [data, ...prev])
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateEmailTemplate(id, updates)
    if (err) return { error: err }
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteEmailTemplate(id)
    if (err) return { error: err }
    setTemplates(prev => prev.filter(t => t.id !== id))
    return {}
  }, [])

  const duplicar = useCallback(async (id) => {
    const { data, error: err } = await duplicateEmailTemplate(id)
    if (err) return { error: err }
    setTemplates(prev => [data, ...prev])
    return { data }
  }, [])

  useEffect(() => { cargar() }, [search])

  return {
    templates, loading, error, search,
    setSearch,
    cargar, crear, actualizar, eliminar, duplicar,
  }
}
