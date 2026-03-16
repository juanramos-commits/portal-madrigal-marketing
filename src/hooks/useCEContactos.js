import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

const PAGE_SIZE = 50

export function useCEContactos() {
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const loadRef = useRef(0)

  const cargar = useCallback(async (resetPage = false) => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    if (resetPage) setPage(0)
    const currentPage = resetPage ? 0 : page

    try {
      const cacheKey = `ce-contactos:${currentPage}:${search}:${statusFilter}:${tagFilter}`
      const cached = getCached(cacheKey)
      if (cached && requestId === loadRef.current) {
        setContactos(cached.data)
        setTotal(cached.total)
        setLoading(false)
        return
      }

      let query = supabase
        .from('ce_contactos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

      if (search) {
        query = query.or(`email.ilike.%${search}%,nombre.ilike.%${search}%,empresa.ilike.%${search}%`)
      }
      if (statusFilter) {
        query = query.eq('estado', statusFilter)
      }
      if (tagFilter) {
        query = query.cs('etiquetas', [tagFilter])
      }

      const { data, error: err, count } = await query

      if (requestId !== loadRef.current) return
      if (err) throw err

      setContactos(data || [])
      setTotal(count || 0)
      setCache(cacheKey, { data: data || [], total: count || 0 })
    } catch (err) {
      if (requestId === loadRef.current) {
        setError(err.message)
      }
    } finally {
      if (requestId === loadRef.current) {
        setLoading(false)
      }
    }
  }, [page, search, statusFilter, tagFilter])

  useEffect(() => {
    cargar()
  }, [cargar])

  const buscar = useCallback((term) => {
    setSearch(term)
    setPage(0)
  }, [])

  const filtrarEstado = useCallback((estado) => {
    setStatusFilter(estado)
    setPage(0)
  }, [])

  const filtrarTag = useCallback((tag) => {
    setTagFilter(tag)
    setPage(0)
  }, [])

  const crear = useCallback(async (data) => {
    setError(null)
    try {
      const { data: nuevo, error: err } = await supabase
        .from('ce_contactos')
        .insert(data)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-contactos')
      await cargar(true)
      return nuevo
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [cargar])

  const actualizar = useCallback(async (id, data) => {
    setError(null)
    try {
      const { data: updated, error: err } = await supabase
        .from('ce_contactos')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (err) throw err
      invalidateCache('ce-contactos')
      setContactos(prev => prev.map(c => c.id === id ? updated : c))
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
        .from('ce_contactos')
        .delete()
        .eq('id', id)
      if (err) throw err
      invalidateCache('ce-contactos')
      setContactos(prev => prev.filter(c => c.id !== id))
      setTotal(prev => prev - 1)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const importarCSV = useCallback(async (rows) => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('ce_contactos')
        .upsert(rows, { onConflict: 'email' })
        .select()
      if (err) throw err
      invalidateCache('ce-contactos')
      await cargar(true)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [cargar])

  const cargarDetalle = useCallback(async (id) => {
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('ce_contactos')
        .select(`
          *,
          ce_enrollments(*, ce_secuencias(nombre)),
          ce_envios(*, ce_pasos(asunto_a, asunto_b))
        `)
        .eq('id', id)
        .single()
      if (err) throw err
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    contactos,
    loading,
    error,
    total,
    page,
    setPage,
    search,
    statusFilter,
    tagFilter,
    cargar,
    buscar,
    filtrarEstado,
    filtrarTag,
    crear,
    actualizar,
    eliminar,
    importarCSV,
    cargarDetalle,
    pageSize: PAGE_SIZE,
  }
}
