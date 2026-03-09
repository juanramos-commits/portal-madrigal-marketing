import { useState, useEffect, useCallback } from 'react'
import { getEmailSettings, updateEmailSetting } from '../lib/emailMarketing'

export function useEmailSettings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getEmailSettings()
      if (err) { setError(err.message); return }
      // Convert array of { key, value } rows to a key-value map
      const map = {}
      ;(data || []).forEach(row => { map[row.key] = row.value })
      setSettings(map)
    } catch (e) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  const actualizar = useCallback(async (key, value) => {
    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: value }))

    const { error: err } = await updateEmailSetting(key, value)
    if (err) {
      // Revert on error
      await cargar()
      return { error: err }
    }
    return {}
  }, [cargar])

  useEffect(() => { cargar() }, [])

  return {
    settings, loading, error,
    cargar, actualizar,
  }
}
