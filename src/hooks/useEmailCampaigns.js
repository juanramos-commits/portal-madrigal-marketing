import { useState, useEffect, useCallback } from 'react'
import {
  getEmailCampaigns, createEmailCampaign, updateEmailCampaign, deleteEmailCampaign,
  prepareCampaign, startCampaign, pauseCampaign, resumeCampaign, cancelCampaign, getABResults
} from '../lib/emailMarketing'

const PAGE_SIZE = 20

export function useEmailCampaigns() {
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

    const { data, count, error: err } = await getEmailCampaigns({
      page: p, pageSize: PAGE_SIZE, search, status: statusFilter
    })

    if (err) { setError(err.message); setLoading(false); return }
    setCampaigns(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, search, statusFilter])

  const crear = useCallback(async (datos) => {
    const { data, error: err } = await createEmailCampaign(datos)
    if (err) return { error: err }
    setCampaigns(prev => [data, ...prev])
    setTotal(prev => prev + 1)
    return { data }
  }, [])

  const actualizar = useCallback(async (id, updates) => {
    const { data, error: err } = await updateEmailCampaign(id, updates)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    return { data }
  }, [])

  const eliminar = useCallback(async (id) => {
    const { error: err } = await deleteEmailCampaign(id)
    if (err) return { error: err }
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setTotal(prev => prev - 1)
    return {}
  }, [])

  const preparar = useCallback(async (campaignId) => {
    const { data, error: err } = await prepareCampaign(campaignId)
    if (err) return { error: err }
    return { data }
  }, [])

  const iniciar = useCallback(async (campaignId) => {
    const { data, error: err } = await startCampaign(campaignId)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, ...data } : c))
    return { data }
  }, [])

  const pausar = useCallback(async (campaignId) => {
    const { data, error: err } = await pauseCampaign(campaignId)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, ...data } : c))
    return { data }
  }, [])

  const reanudar = useCallback(async (campaignId) => {
    const { data, error: err } = await resumeCampaign(campaignId)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, ...data } : c))
    return { data }
  }, [])

  const cancelar = useCallback(async (campaignId) => {
    const { data, error: err } = await cancelCampaign(campaignId)
    if (err) return { error: err }
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, ...data } : c))
    return { data }
  }, [])

  const obtenerResultadosAB = useCallback(async (campaignId) => {
    const { data, error: err } = await getABResults(campaignId)
    if (err) return { error: err }
    return { data }
  }, [])

  useEffect(() => { cargar(true) }, [search, statusFilter])

  return {
    campaigns, loading, error, page, total, search, statusFilter,
    hayMas: (page + 1) * PAGE_SIZE < total,
    setSearch, setStatusFilter, setPage,
    cargar, crear, actualizar, eliminar,
    preparar, iniciar, pausar, reanudar, cancelar,
    obtenerResultadosAB,
    paginaSiguiente: () => { setPage(p => p + 1); cargar(false) },
    paginaAnterior: () => { setPage(p => Math.max(0, p - 1)); cargar(false) },
  }
}
