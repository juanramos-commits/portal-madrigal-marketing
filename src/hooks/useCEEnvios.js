import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

const PAGE_SIZE = 100

export function useCEEnvios() {
  const [envios, setEnvios] = useState([])
  const [cola, setCola] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState({ desde: '', hasta: '' })
  const [estadoFilter, setEstadoFilter] = useState('')
  const loadRef = useRef(0)

  const cargarLog = useCallback(async (filters = {}) => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    const currentSearch = filters.search ?? search
    const currentDateRange = filters.dateRange ?? dateRange
    const currentEstado = filters.estadoFilter ?? estadoFilter
    const currentPage = filters.page ?? page

    try {
      let query = supabase
        .from('ce_envios')
        .select(`
          *,
          contacto:ce_contactos(nombre, email),
          cuenta:ce_cuentas(email),
          paso:ce_pasos(asunto_a)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

      if (currentSearch) {
        query = query.or(`contacto.email.ilike.%${currentSearch}%,contacto.nombre.ilike.%${currentSearch}%`)
      }
      if (currentEstado) {
        query = query.eq('estado', currentEstado)
      }
      if (currentDateRange.desde) {
        query = query.gte('created_at', currentDateRange.desde)
      }
      if (currentDateRange.hasta) {
        query = query.lte('created_at', currentDateRange.hasta + 'T23:59:59')
      }

      const { data, error: err, count } = await query

      if (requestId !== loadRef.current) return
      if (err) throw err

      setEnvios(data || [])
      setTotal(count || 0)
    } catch (err) {
      if (requestId === loadRef.current) {
        setError(err.message)
      }
    } finally {
      if (requestId === loadRef.current) {
        setLoading(false)
      }
    }
  }, [search, dateRange, estadoFilter, page])

  const cargarCola = useCallback(async () => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('ce_enrollments')
        .select(`
          *,
          contacto:ce_contactos(nombre, email),
          secuencia:ce_secuencias(nombre)
        `)
        .eq('estado', 'activo')
        .not('proximo_envio_at', 'is', null)
        .order('proximo_envio_at', { ascending: true })

      if (err) throw err
      setCola(data || [])
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const cancelarEnvio = useCallback(async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_envios')
        .update({ estado: 'cancelado' })
        .eq('id', id)
      if (err) throw err
      setEnvios(prev => prev.map(e => e.id === id ? { ...e, estado: 'cancelado' } : e))
      invalidateCache('ce-dashboard')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  useEffect(() => {
    cargarLog()
  }, [cargarLog])

  return {
    envios,
    cola,
    loading,
    error,
    total,
    page,
    setPage,
    search,
    setSearch,
    dateRange,
    setDateRange,
    estadoFilter,
    setEstadoFilter,
    cargarLog,
    cargarCola,
    cancelarEnvio,
    pageSize: PAGE_SIZE,
  }
}
