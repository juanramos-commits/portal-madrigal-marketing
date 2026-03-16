import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

export function useCEPlantillas() {
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadRef = useRef(0)

  const cargar = useCallback(async () => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    try {
      const cached = getCached('ce-plantillas')
      if (cached && requestId === loadRef.current) {
        setPlantillas(cached)
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('ce_plantillas')
        .select('*')
        .order('created_at', { ascending: false })

      if (requestId !== loadRef.current) return
      if (err) throw err

      setPlantillas(data || [])
      setCache('ce-plantillas', data || [])
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

  useEffect(() => {
    cargar()
  }, [cargar])

  const crear = useCallback(async (data) => {
    setError(null)
    try {
      const { data: nueva, error: err } = await supabase
        .from('ce_plantillas')
        .insert(data)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-plantillas')
      setPlantillas(prev => [nueva, ...prev])
      return nueva
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const actualizar = useCallback(async (id, data) => {
    setError(null)
    try {
      const { data: updated, error: err } = await supabase
        .from('ce_plantillas')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-plantillas')
      setPlantillas(prev => prev.map(p => p.id === id ? updated : p))
      return updated
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const eliminar = useCallback(async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_plantillas')
        .delete()
        .eq('id', id)
      if (err) throw err
      invalidateCache('ce-plantillas')
      setPlantillas(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    plantillas,
    loading,
    error,
    cargar,
    crear,
    actualizar,
    eliminar,
  }
}
