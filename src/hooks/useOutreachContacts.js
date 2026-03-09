import { useState, useEffect, useCallback } from 'react'
import {
  getContacts, getContactStats, importContacts
} from '../lib/coldOutreach'

const PAGE_SIZE = 50

export function useOutreachContacts() {
  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const cargar = useCallback(async (resetPage = true) => {
    setLoading(true)
    setError(null)
    const p = resetPage ? 0 : page
    if (resetPage) setPage(0)

    const { data, count, error: err } = await getContacts({
      page: p, pageSize: PAGE_SIZE, search, status: statusFilter
    })

    if (err) { setError(err.message); setLoading(false); return }
    setContacts(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, search, statusFilter])

  const cargarStats = useCallback(async () => {
    const { data, error: err } = await getContactStats()
    if (!err && data) setStats(data)
  }, [])

  const importar = useCallback(async (listId, contactsData) => {
    const { data, error: err } = await importContacts(listId, contactsData)
    if (err) return { error: err }
    return { data }
  }, [])

  useEffect(() => { cargar(true) }, [search, statusFilter])
  useEffect(() => { cargar(false) }, [page])
  useEffect(() => { cargarStats() }, [])

  return {
    contacts, total, stats, loading, error, page, search, statusFilter,
    hayMas: (page + 1) * PAGE_SIZE < total,
    setSearch, setStatusFilter,
    cargar, cargarStats, importar,
    paginaSiguiente: () => { setPage(p => p + 1) },
    paginaAnterior: () => { setPage(p => Math.max(0, p - 1)) },
  }
}
