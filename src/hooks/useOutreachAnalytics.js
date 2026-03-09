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
    try {
      const { data, error: err } = await getDashboardStats()
      if (err) { setError(err.message); return }
      setDashboardStats(data)
    } catch (e) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarReputacion = useCallback(async (domainId, days = 30) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getReputationSummary(domainId, days)
      if (err) { setError(err.message); return { error: err } }
      setReputationData(data)
      return { data }
    } catch (e) {
      setError(e.message || 'Error de conexión')
      return { error: e }
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarCampaignAnalytics = useCallback(async (campaignId) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getCampaignAnalytics(campaignId)
      if (err) { setError(err.message); return { error: err } }
      setCampaignAnalytics(data)
      return { data }
    } catch (e) {
      setError(e.message || 'Error de conexión')
      return { error: e }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDashboard() }, [])

  return {
    dashboardStats, reputationData, campaignAnalytics,
    loading, error,
    cargarDashboard, cargarReputacion, cargarCampaignAnalytics,
  }
}
