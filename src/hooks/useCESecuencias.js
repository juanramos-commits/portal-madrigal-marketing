import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

export function useCESecuencias() {
  const [secuencias, setSecuencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const loadRef = useRef(0)

  const cargar = useCallback(async () => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    try {
      const cacheKey = `ce-secuencias:${filtroEstado}`
      const cached = getCached(cacheKey)
      if (cached && requestId === loadRef.current) {
        setSecuencias(cached)
        setLoading(false)
        return
      }

      let query = supabase
        .from('ce_secuencias')
        .select('*')
        .order('created_at', { ascending: false })

      if (filtroEstado) {
        query = query.eq('estado', filtroEstado)
      }

      const { data, error: err } = await query

      if (requestId !== loadRef.current) return
      if (err) throw err

      setSecuencias(data || [])
      setCache(cacheKey, data || [])
    } catch (err) {
      if (requestId === loadRef.current) {
        setError(err.message)
      }
    } finally {
      if (requestId === loadRef.current) {
        setLoading(false)
      }
    }
  }, [filtroEstado])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crear = useCallback(async (data) => {
    setError(null)
    try {
      const { data: nueva, error: err } = await supabase
        .from('ce_secuencias')
        .insert(data)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-secuencias')
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
        .from('ce_secuencias')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-secuencias')
      setSecuencias(prev => prev.map(s => s.id === id ? updated : s))
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
        .from('ce_secuencias')
        .delete()
        .eq('id', id)
      if (err) throw err
      invalidateCache('ce-secuencias')
      setSecuencias(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const cargarDetalle = useCallback(async (id) => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('ce_secuencias')
        .select(`
          *,
          ce_pasos(*),
          ce_enrollments(*, ce_contactos(nombre, email, estado)),
          ce_secuencias_cuentas(cuenta_id, ce_cuentas(nombre, email, estado))
        `)
        .eq('id', id)
        .single()
      if (err) throw err

      // Sort pasos by orden client-side
      if (data.ce_pasos) {
        data.ce_pasos.sort((a, b) => (a.orden || 0) - (b.orden || 0))
      }

      // Load stats via RPC
      const { data: stats, error: statsErr } = await supabase
        .rpc('ce_secuencia_stats', { p_secuencia_id: id })
      if (statsErr) console.error('Error loading sequence stats:', statsErr)

      return { ...data, stats: stats || null }
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  // ── Pasos (steps) management ──────────────────────────────────────

  const crearPaso = useCallback(async (secuenciaId, data) => {
    setError(null)
    try {
      const { data: paso, error: err } = await supabase
        .from('ce_pasos')
        .insert({ ...data, secuencia_id: secuenciaId })
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-secuencias')
      return paso
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const actualizarPaso = useCallback(async (pasoId, data) => {
    setError(null)
    try {
      const { data: updated, error: err } = await supabase
        .from('ce_pasos')
        .update(data)
        .eq('id', pasoId)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-secuencias')
      return updated
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const eliminarPaso = useCallback(async (pasoId) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_pasos')
        .delete()
        .eq('id', pasoId)
      if (err) throw err
      invalidateCache('ce-secuencias')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const reordenarPasos = useCallback(async (secuenciaId, pasoIds) => {
    setError(null)
    try {
      const updates = pasoIds.map((id, index) =>
        supabase
          .from('ce_pasos')
          .update({ orden: index + 1 })
          .eq('id', id)
          .eq('secuencia_id', secuenciaId)
      )
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed) throw failed.error
      invalidateCache('ce-secuencias')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  // ── Enrollments ───────────────────────────────────────────────────

  const enrollar = useCallback(async (secuenciaId, contactoIds) => {
    setError(null)
    try {
      // Get first step to calculate proximo_envio_at
      const { data: pasos, error: pasosErr } = await supabase
        .from('ce_pasos')
        .select('delay_dias')
        .eq('secuencia_id', secuenciaId)
        .order('orden', { ascending: true })
        .limit(1)
      if (pasosErr) throw pasosErr

      let proximoEnvio = null
      if (pasos?.length > 0) {
        const delayMs = (pasos[0].delay_dias || 0) * 24 * 60 * 60 * 1000
        proximoEnvio = new Date(Date.now() + delayMs).toISOString()
      }

      const rows = contactoIds.map(contactoId => ({
        secuencia_id: secuenciaId,
        contacto_id: contactoId,
        estado: 'activo',
        proximo_envio_at: proximoEnvio,
      }))
      const { data, error: err } = await supabase
        .from('ce_enrollments')
        .insert(rows)
        .select()
      if (err) throw err
      invalidateCache('ce-secuencias')
      invalidateCache('ce-contactos')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const desenrollar = useCallback(async (enrollmentId) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_enrollments')
        .update({ estado: 'cancelado' })
        .eq('id', enrollmentId)
      if (err) throw err
      invalidateCache('ce-secuencias')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const pausarEnrollment = useCallback(async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_enrollments')
        .update({ estado: 'pausado' })
        .eq('id', id)
      if (err) throw err
      invalidateCache('ce-secuencias')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const reanudarEnrollment = useCallback(async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_enrollments')
        .update({ estado: 'activo' })
        .eq('id', id)
      if (err) throw err
      invalidateCache('ce-secuencias')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  // ── Account assignment ────────────────────────────────────────────

  const asignarCuentas = useCallback(async (secuenciaId, cuentaIds) => {
    setError(null)
    try {
      // Remove existing assignments
      const { error: delErr } = await supabase
        .from('ce_secuencias_cuentas')
        .delete()
        .eq('secuencia_id', secuenciaId)
      if (delErr) throw delErr

      // Insert new assignments
      if (cuentaIds.length > 0) {
        const rows = cuentaIds.map(cuentaId => ({
          secuencia_id: secuenciaId,
          cuenta_id: cuentaId,
        }))
        const { error: insErr } = await supabase
          .from('ce_secuencias_cuentas')
          .insert(rows)
        if (insErr) throw insErr
      }

      invalidateCache('ce-secuencias')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    secuencias,
    loading,
    error,
    filtroEstado,
    setFiltroEstado,
    cargar,
    crear,
    actualizar,
    eliminar,
    cargarDetalle,
    crearPaso,
    actualizarPaso,
    eliminarPaso,
    reordenarPasos,
    enrollar,
    desenrollar,
    pausarEnrollment,
    reanudarEnrollment,
    asignarCuentas,
  }
}
