import { useState, useEffect, useCallback } from 'react'
import { getEmailContacts, getContactStats, updateEmailContact, deleteEmailContact } from '../lib/emailMarketing'
import { getCached, setCache } from '../lib/cache'

const PAGE_SIZE = 50

export function useEmailContacts() {
  const [contacts, setContacts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState(null)

  const cargar = useCallback(async (resetPage = true) => {
    setLoading(true)
    setError(null)
    const p = resetPage ? 0 : page
    if (resetPage) setPage(0)

    try {
      const { data, count, error: err } = await getEmailContacts({
        page: p, pageSize: PAGE_SIZE, search, status: statusFilter
      })

      if (err) { setError(err.message); return }
      setContacts(data || [])
      setTotal(count || 0)
    } catch (e) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  const cargarStats = useCallback(async () => {
    const cached = getCached('em-contact-stats')
    if (cached) { setStats(cached); return }
    const { data, error: err } = await getContactStats()
    if (!err && data) { setStats(data); setCache('em-contact-stats', data) }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateEmailContact(id, updates)
    if (err) return { error: err }
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteEmailContact(id)
    if (err) return { error: err }
    setContacts(prev => prev.filter(c => c.id !== id))
    setTotal(prev => prev - 1)
    return {}
  }, [])

  useEffect(() => { cargar(true) }, [search, statusFilter])
  useEffect(() => { cargar(false) }, [page])
  useEffect(() => { cargarStats() }, [])

  return {
    contacts, stats, loading, error, page, total, search, statusFilter,
    hayMas: (page + 1) * PAGE_SIZE < total,
    setSearch, setStatusFilter,
    setPage, cargar, cargarStats, actualizar, eliminar,
    paginaSiguiente: () => { setPage(p => p + 1) },
    paginaAnterior: () => { setPage(p => Math.max(0, p - 1)) },
  }
}
