import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

export function useCECuentas() {
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadRef = useRef(0)

  const cargar = useCallback(async () => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    try {
      const cached = getCached('ce-cuentas')
      if (cached && requestId === loadRef.current) {
        setCuentas(cached)
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('ce_cuentas')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err

      // Enrich each account with enviados_hoy and limite_efectivo
      const enriched = await Promise.all(
        (data || []).map(async (cuenta) => {
          const [hoyRes, limiteRes] = await Promise.all([
            supabase.rpc('ce_enviados_hoy', { p_cuenta_id: cuenta.id }),
            supabase.rpc('ce_limite_efectivo', { p_cuenta_id: cuenta.id }),
          ])
          return {
            ...cuenta,
            enviados_hoy: hoyRes.data ?? 0,
            limite_efectivo: limiteRes.data ?? 0,
          }
        })
      )

      if (requestId !== loadRef.current) return

      setCuentas(enriched)
      setCache('ce-cuentas', enriched)
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
        .from('ce_cuentas')
        .insert(data)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-cuentas')
      await cargar()
      return nueva
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [cargar])

  const actualizar = useCallback(async (id, data) => {
    setError(null)
    try {
      const { data: updated, error: err } = await supabase
        .from('ce_cuentas')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-cuentas')
      setCuentas(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c))
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
        .from('ce_cuentas')
        .delete()
        .eq('id', id)
      if (err) throw err
      invalidateCache('ce-cuentas')
      setCuentas(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const pausar = useCallback(async (id) => {
    setError(null)
    try {
      const { data: updated, error: err } = await supabase
        .from('ce_cuentas')
        .update({ estado: 'pausada' })
        .eq('id', id)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-cuentas')
      setCuentas(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c))
      return updated
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const activar = useCallback(async (id) => {
    setError(null)
    try {
      // Get current account to check warmup status
      const cuenta = cuentas.find(c => c.id === id)
      const nuevoEstado = cuenta && cuenta.warmup_dia_actual < cuenta.days_to_max
        ? 'ramping'
        : 'resting'

      const { data: updated, error: err } = await supabase
        .from('ce_cuentas')
        .update({ estado: nuevoEstado })
        .eq('id', id)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-cuentas')
      setCuentas(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c))
      return updated
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [cuentas])

  const obtenerHealth = useCallback(async (id) => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .rpc('ce_health_score', { p_cuenta_id: id })
      if (err) throw err
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    cuentas,
    loading,
    error,
    cargar,
    crear,
    actualizar,
    eliminar,
    pausar,
    activar,
    obtenerHealth,
  }
}
