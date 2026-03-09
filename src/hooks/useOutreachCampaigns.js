import { useState, useEffect, useCallback } from 'react'
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  activateCampaign, pauseCampaign, archiveCampaign
} from '../lib/coldOutreach'

const PAGE_SIZE = 20

export function useOutreachCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const cargar = useCallback(async (resetPage = true) => {
    setLoading(true)
    setError(null)
    const p = resetPage ? 0 : page
    if (resetPage) setPage(0)

    const { data, count, error: err } = await getCampaigns({
      page: p, pageSize: PAGE_SIZE, search, status: statusFilter
    })

    if (err) { setError(err.message); setLoading(false); return }
    setCampaigns(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, search, statusFilter])

  const crear = useCallback(async (datos) => {
    const { data, error: err } = await createCampaign(datos)
    if (err) return { error: err }
    setCampaigns(prev => [data, ...prev])
    setTotal(prev => prev + 1)
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateCampaign(id, updates)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteCampaign(id)
    if (err) return { error: err }
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setTotal(prev => prev - 1)
    return {}
  }, [])

  const activar = useCallback(async (id) => {
    const { data, error: err } = await activateCampaign(id)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { data }
  }, [])

  const pausar = useCallback(async (id) => {
    const { data, error: err } = await pauseCampaign(id)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { data }
  }, [])

  const archivar = useCallback(async (id) => {
    const { data, error: err } = await archiveCampaign(id)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { data }
  }, [])

  useEffect(() => { cargar(true) }, [search, statusFilter])
  useEffect(() => { cargar(false) }, [page])

  return {
    campaigns, loading, error, page, total, search, statusFilter,
    hayMas: (page + 1) * PAGE_SIZE < total,
    setSearch, setStatusFilter, setPage,
    cargar, crear, actualizar, eliminar,
    activar, pausar, archivar,
    paginaSiguiente: () => { setPage(p => p + 1) },
    paginaAnterior: () => { setPage(p => Math.max(0, p - 1)) },
  }
}
