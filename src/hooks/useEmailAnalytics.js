import { useState, useEffect, useCallback } from 'react'
import {
  getDashboardStats, getFunnelData, getCohortData,
  getOpenHeatmap, getReputationLogs
} from '../lib/emailMarketing'

export function useEmailAnalytics() {
  const [dashboardStats, setDashboardStats] = useState(null)
  const [funnelData, setFunnelData] = useState(null)
  const [cohortData, setCohortData] = useState(null)
  const [heatmapData, setHeatmapData] = useState(null)
  const [reputationLogs, setReputationLogs] = useState([])
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

  const cargarFunnel = useCallback(async (campaignId) => {
    const { data, error: err } = await getFunnelData(campaignId)
    if (err) return { error: err }
    setFunnelData(data)
    return { data }
  }, [])

  const cargarCohort = useCallback(async (days = 90) => {
    const { data, error: err } = await getCohortData(days)
    if (err) return { error: err }
    setCohortData(data)
    return { data }
  }, [])

  const cargarHeatmap = useCallback(async () => {
    const { data, error: err } = await getOpenHeatmap()
    if (err) return { error: err }
    setHeatmapData(data)
    return { data }
  }, [])

  const cargarReputacion = useCallback(async (days = 30) => {
    const { data, error: err } = await getReputationLogs(days)
    if (err) return { error: err }
    setReputationLogs(data || [])
    return { data }
  }, [])

  useEffect(() => { cargarDashboard() }, [])

  return {
    dashboardStats, funnelData, cohortData, heatmapData, reputationLogs,
    loading, error,
    cargarDashboard, cargarFunnel, cargarCohort, cargarHeatmap, cargarReputacion,
  }
}
