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

  const cargarFunnel = useCallback(async (campaignId) => {
    setLoading(true)
    try {
      const { data, error: err } = await getFunnelData(campaignId)
      if (err) return { error: err }
      setFunnelData(data)
      return { data }
    } catch (e) {
      return { error: e }
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarCohort = useCallback(async (days = 90) => {
    setLoading(true)
    try {
      const { data, error: err } = await getCohortData(days)
      if (err) return { error: err }
      setCohortData(data)
      return { data }
    } catch (e) {
      return { error: e }
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarHeatmap = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: err } = await getOpenHeatmap()
      if (err) return { error: err }
      setHeatmapData(data)
      return { data }
    } catch (e) {
      return { error: e }
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarReputacion = useCallback(async (days = 30) => {
    setLoading(true)
    try {
      const { data, error: err } = await getReputationLogs(days)
      if (err) return { error: err }
      setReputationLogs(data || [])
      return { data }
    } catch (e) {
      return { error: e }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDashboard() }, [])

  return {
    dashboardStats, funnelData, cohortData, heatmapData, reputationLogs,
    loading, error,
    cargarDashboard, cargarFunnel, cargarCohort, cargarHeatmap, cargarReputacion,
  }
}
