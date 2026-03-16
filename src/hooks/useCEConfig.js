import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

export function useCEConfig() {
  const [config, setConfig] = useState({})
  const [blacklist, setBlacklist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadRef = useRef(0)

  const cargarConfig = useCallback(async () => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    try {
      const cached = getCached('ce-config')
      if (cached && requestId === loadRef.current) {
        setConfig(cached)
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('ce_config')
        .select('*')
      if (err) throw err

      if (requestId !== loadRef.current) return

      // Transform rows to {clave: valor} object
      const configObj = (data || []).reduce((acc, row) => {
        acc[row.clave] = row.valor
        return acc
      }, {})

      setConfig(configObj)
      setCache('ce-config', configObj)
    } catch (err) {
      if (requestId === loadRef.current) {
        setError(err.message)
      }
    } finally {
      if (requestId === loadRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const guardarConfig = useCallback(async (clave, valor) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_config')
        .upsert({ clave, valor }, { onConflict: 'clave' })
      if (err) throw err
      invalidateCache('ce-config')
      setConfig(prev => ({ ...prev, [clave]: valor }))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const cargarBlacklist = useCallback(async () => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('ce_blacklist')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      setBlacklist(data || [])
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const añadirBlacklist = useCallback(async (tipo, valor, motivo) => {
    setError(null)
    try {
      const { data: nuevo, error: err } = await supabase
        .from('ce_blacklist')
        .insert({ tipo, valor, motivo })
        .select()
        .single()
      if (err) throw err
      setBlacklist(prev => [nuevo, ...prev])
      return nuevo
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const eliminarBlacklist = useCallback(async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_blacklist')
        .delete()
        .eq('id', id)
      if (err) throw err
      setBlacklist(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const togglePausaGlobal = useCallback(async () => {
    setError(null)
    try {
      const currentValue = config.pausa_global === 'true' || config.pausa_global === true
      const newValue = !currentValue
      await guardarConfig('pausa_global', String(newValue))
      return newValue
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [config.pausa_global, guardarConfig])

  useEffect(() => {
    cargarConfig()
    cargarBlacklist()
  }, [cargarConfig, cargarBlacklist])

  return {
    config,
    blacklist,
    loading,
    error,
    cargarConfig,
    guardarConfig,
    cargarBlacklist,
    añadirBlacklist,
    eliminarBlacklist,
    togglePausaGlobal,
  }
}
