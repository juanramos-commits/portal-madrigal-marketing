import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

export function useCEDashboard() {
  const [stats, setStats] = useState({})
  const [chartData, setChartData] = useState([])
  const [secuenciasActivas, setSecuenciasActivas] = useState([])
  const [respuestasPendientes, setRespuestasPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadRef = useRef(0)

  const cargar = useCallback(async () => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    try {
      const cached = getCached('ce-dashboard')
      if (cached && requestId === loadRef.current) {
        setStats(cached.stats)
        setChartData(cached.chartData)
        setSecuenciasActivas(cached.secuenciasActivas)
        setRespuestasPendientes(cached.respuestasPendientes)
        setLoading(false)
        return
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayISO = todayStart.toISOString()

      // Run all queries in parallel
      const [
        enviadosHoyRes,
        envios30dRes,
        contactosActivosRes,
        enrollmentsActivosRes,
        secuenciasRes,
        respPendientesRes,
      ] = await Promise.all([
        // Enviados hoy
        supabase
          .from('ce_envios')
          .select('id', { count: 'exact', head: true })
          .gte('enviado_at', todayISO)
          .not('enviado_at', 'is', null),

        // Last 30 days envios for rates + chart
        supabase
          .from('ce_envios')
          .select('id, enviado_at, abierto_at, respondido_at')
          .gte('created_at', thirtyDaysAgoISO)
          .not('enviado_at', 'is', null),

        // Contactos activos
        supabase
          .from('ce_contactos')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activo'),

        // Enrollments activos
        supabase
          .from('ce_enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activo'),

        // Secuencias activas with stats
        supabase
          .from('ce_secuencias')
          .select('*')
          .eq('estado', 'activa'),

        // Respuestas pendientes
        supabase
          .from('ce_respuestas')
          .select(`
            *,
            contacto:ce_contactos(nombre, email, empresa)
          `)
          .eq('clasificacion', 'pendiente')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (requestId !== loadRef.current) return

      // Calculate rates from 30-day envios
      const envios30d = envios30dRes.data || []
      const totalEnviados = envios30d.length
      const totalAbiertos = envios30d.filter(e => e.abierto_at).length
      const totalRespondidos = envios30d.filter(e => e.respondido_at).length

      const calculatedStats = {
        enviadosHoy: enviadosHoyRes.count || 0,
        tasaApertura: totalEnviados > 0 ? (totalAbiertos / totalEnviados) * 100 : 0,
        tasaRespuesta: totalEnviados > 0 ? (totalRespondidos / totalEnviados) * 100 : 0,
        contactosActivos: contactosActivosRes.count || 0,
        enrollmentsActivos: enrollmentsActivosRes.count || 0,
      }

      // Build chart data: last 30 days, count enviados per day
      const chartMap = {}
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        chartMap[key] = { fecha: key, enviados: 0 }
      }
      for (const envio of envios30d) {
        if (envio.enviado_at) {
          const key = envio.enviado_at.slice(0, 10)
          if (chartMap[key]) {
            chartMap[key].enviados++
          }
        }
      }
      const chartDataResult = Object.values(chartMap)

      // Enrich secuencias with stats
      const secuenciasData = secuenciasRes.data || []
      const secuenciasConStats = await Promise.all(
        secuenciasData.map(async (sec) => {
          const { data: secStats } = await supabase
            .rpc('ce_secuencia_stats', { p_secuencia_id: sec.id })
          return { ...sec, stats: secStats || null }
        })
      )

      if (requestId !== loadRef.current) return

      setStats(calculatedStats)
      setChartData(chartDataResult)
      setSecuenciasActivas(secuenciasConStats)
      setRespuestasPendientes(respPendientesRes.data || [])

      setCache('ce-dashboard', {
        stats: calculatedStats,
        chartData: chartDataResult,
        secuenciasActivas: secuenciasConStats,
        respuestasPendientes: respPendientesRes.data || [],
      }, CACHE_TTL)
    } catch (err) {
      if (requestId === loadRef.current) {
        setError(err.message)
      }
    } finally {
      if (requestId === loadRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return {
    stats,
    chartData,
    secuenciasActivas,
    respuestasPendientes,
    loading,
    error,
    cargar,
  }
}
