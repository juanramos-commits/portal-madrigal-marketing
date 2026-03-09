import { useState, useEffect, useCallback } from 'react'
import {
  getDashboardStats, getReputationSummary, getCampaignAnalytics
} from '../lib/coldOutreach'

export function useOutreachAnalytics() {
  const [dashboardStats, setDashboardStats] = useState(null)
  const [reputationData, setReputationData] = useState(null)
  const [campaignAnalytics, setCampaignAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargarDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getDashboardStats()

    if (err) { setError(err.message); setLoading(false); return }
    setDashboardStats(data)
    setLoading(false)
  }, [])

  const cargarReputacion = useCallback(async (domainId, days = 30) => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getReputationSummary(domainId, days)

    if (err) { setError(err.message); setLoading(false); return { error: err } }
    setReputationData(data)
    setLoading(false)
    return { data }
  }, [])

  const cargarCampaignAnalytics = useCallback(async (campaignId) => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getCampaignAnalytics(campaignId)

    if (err) { setError(err.message); setLoading(false); return { error: err } }
    setCampaignAnalytics(data)
    setLoading(false)
    return { data }
  }, [])

  useEffect(() => { cargarDashboard() }, [])

  return {
    dashboardStats, reputationData, campaignAnalytics,
    loading, error,
    cargarDashboard, cargarReputacion, cargarCampaignAnalytics,
  }
}
