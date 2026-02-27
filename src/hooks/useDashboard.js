import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'

function calcularPeriodo(tipo) {
  const hoy = new Date()
  const yyyy = hoy.getFullYear()
  const mm = hoy.getMonth()
  const dd = hoy.getDate()

  switch (tipo) {
    case 'este_mes':
      return { inicio: new Date(yyyy, mm, 1), fin: hoy }
    case 'mes_pasado': {
      const primero = new Date(yyyy, mm - 1, 1)
      const ultimo = new Date(yyyy, mm, 0)
      return { inicio: primero, fin: ultimo }
    }
    case 'ultimos_7':
      return { inicio: new Date(yyyy, mm, dd - 7), fin: hoy }
    case 'ultimos_30':
      return { inicio: new Date(yyyy, mm, dd - 30), fin: hoy }
    case 'ultimos_90':
      return { inicio: new Date(yyyy, mm, dd - 90), fin: hoy }
    case 'este_ano':
      return { inicio: new Date(yyyy, 0, 1), fin: hoy }
    default:
      return { inicio: new Date(yyyy, mm, 1), fin: hoy }
  }
}

function calcularPeriodoAnterior(inicio, fin) {
  const diff = fin.getTime() - inicio.getTime()
  const prevFin = new Date(inicio.getTime() - 1)
  const prevInicio = new Date(prevFin.getTime() - diff)
  return { inicio: prevInicio, fin: prevFin }
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

export function useDashboard() {
  const { user, usuario } = useAuth()

  const [rolesComerciales, setRolesComerciales] = useState([])
  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esCloser = misRoles.some(r => r.rol === 'closer')
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esDirector = misRoles.some(r => r.rol === 'director_ventas') || esAdmin

  const [periodo, setPeriodo] = useState('este_mes')
  const [fechaInicio, setFechaInicio] = useState(null)
  const [fechaFin, setFechaFin] = useState(null)

  const [kpis, setKpis] = useState(null)
  const [kpisPrevios, setKpisPrevios] = useState(null)
  const [graficoVentas, setGraficoVentas] = useState([])
  const [funnel, setFunnel] = useState(null)
  const [rankingSetters, setRankingSetters] = useState([])
  const [rankingClosers, setRankingClosers] = useState([])
  const [actividad, setActividad] = useState([])
  const [citasHoy, setCitasHoy] = useState([])
  const [pendientes, setPendientes] = useState({ ventas: 0, retiros: 0 })
  const [loading, setLoading] = useState(true)
  const [errores, setErrores] = useState({})

  useEffect(() => {
    if (!user?.id) return
    const cargar = async () => {
      const { data } = await supabase
        .from('ventas_roles_comerciales')
        .select('*')
        .eq('activo', true)
      setRolesComerciales(data || [])
    }
    cargar()
  }, [user?.id])

  useEffect(() => {
    if (periodo === 'personalizado') return
    const { inicio, fin } = calcularPeriodo(periodo)
    setFechaInicio(inicio)
    setFechaFin(fin)
  }, [periodo])

  const setFechaPersonalizada = useCallback((inicio, fin) => {
    setPeriodo('personalizado')
    setFechaInicio(inicio)
    setFechaFin(fin)
  }, [])

  const cargarKPIs = useCallback(async (inicio, fin) => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase.rpc('ventas_dashboard_kpis', {
        p_usuario_id: user.id,
        p_fecha_inicio: formatDate(inicio),
        p_fecha_fin: formatDate(fin),
      })
      if (error) throw error
      return data
    } catch (e) {
      setErrores(prev => ({ ...prev, kpis: e.message }))
      return null
    }
  }, [user?.id])

  const cargarGraficoVentas = useCallback(async (inicio, fin) => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase.rpc('ventas_dashboard_grafico_ventas', {
        p_usuario_id: user.id,
        p_fecha_inicio: formatDate(inicio),
        p_fecha_fin: formatDate(fin),
      })
      if (error) throw error
      setGraficoVentas(data || [])
    } catch (e) {
      setErrores(prev => ({ ...prev, grafico: e.message }))
    }
  }, [user?.id])

  const cargarFunnel = useCallback(async (inicio, fin) => {
    try {
      const { data, error } = await supabase.rpc('ventas_dashboard_funnel', {
        p_fecha_inicio: formatDate(inicio),
        p_fecha_fin: formatDate(fin),
      })
      if (error) throw error
      setFunnel(data)
    } catch (e) {
      setErrores(prev => ({ ...prev, funnel: e.message }))
    }
  }, [])

  const cargarRanking = useCallback(async (inicio, fin) => {
    try {
      const { data, error } = await supabase.rpc('ventas_dashboard_ranking', {
        p_fecha_inicio: formatDate(inicio),
        p_fecha_fin: formatDate(fin),
      })
      if (error) throw error
      setRankingSetters(data?.setters || [])
      setRankingClosers(data?.closers || [])
    } catch (e) {
      setErrores(prev => ({ ...prev, ranking: e.message }))
    }
  }, [])

  const cargarActividad = useCallback(async () => {
    if (!user?.id) return
    try {
      let query = supabase
        .from('ventas_actividad')
        .select('*, usuario:usuarios(id, nombre, email), lead:ventas_leads(id, nombre)')
        .order('created_at', { ascending: false })
        .limit(15)

      if (!esAdmin && !esDirector) {
        query = query.eq('usuario_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error
      setActividad(data || [])
    } catch (e) {
      setErrores(prev => ({ ...prev, actividad: e.message }))
    }
  }, [user?.id, esAdmin, esDirector])

  const cargarCitasHoy = useCallback(async () => {
    if (!user?.id) return
    try {
      const hoy = new Date()
      const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
      const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString()

      let query = supabase
        .from('ventas_citas')
        .select('*, lead:ventas_leads(id, nombre), closer:usuarios!ventas_citas_closer_id_fkey(id, nombre, email)')
        .gte('fecha_hora', inicioHoy)
        .lt('fecha_hora', finHoy)
        .neq('estado', 'cancelada')
        .order('fecha_hora')

      if (esCloser && !esDirector && !esAdmin) {
        query = query.eq('closer_id', user.id)
      } else if (esSetter && !esCloser && !esDirector && !esAdmin) {
        query = query.eq('setter_origen_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error
      setCitasHoy(data || [])
    } catch (e) {
      setErrores(prev => ({ ...prev, citas: e.message }))
    }
  }, [user?.id, esCloser, esSetter, esDirector, esAdmin])

  const cargarPendientes = useCallback(async () => {
    try {
      const [ventasRes, retirosRes] = await Promise.all([
        supabase.from('ventas_ventas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('ventas_retiros').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      ])
      setPendientes({
        ventas: ventasRes.count || 0,
        retiros: retirosRes.count || 0,
      })
    } catch (e) {
      setErrores(prev => ({ ...prev, pendientes: e.message }))
    }
  }, [])

  const cargarTodo = useCallback(async () => {
    if (!user?.id || !fechaInicio || !fechaFin) return
    setLoading(true)
    setErrores({})

    const prev = calcularPeriodoAnterior(fechaInicio, fechaFin)

    const promesas = [
      cargarKPIs(fechaInicio, fechaFin).then(d => { if (d) setKpis(d) }),
      cargarKPIs(prev.inicio, prev.fin).then(d => { if (d) setKpisPrevios(d) }),
      cargarActividad(),
      cargarCitasHoy(),
    ]

    if (esCloser || esDirector || esAdmin) {
      promesas.push(cargarGraficoVentas(fechaInicio, fechaFin))
    }
    if (esDirector || esAdmin) {
      promesas.push(cargarFunnel(fechaInicio, fechaFin))
      promesas.push(cargarRanking(fechaInicio, fechaFin))
    }
    if (esAdmin) {
      promesas.push(cargarPendientes())
    }

    await Promise.allSettled(promesas)
    setLoading(false)
  }, [user?.id, fechaInicio, fechaFin, esCloser, esSetter, esDirector, esAdmin, cargarKPIs, cargarGraficoVentas, cargarFunnel, cargarRanking, cargarActividad, cargarCitasHoy, cargarPendientes])

  const refrescar = useCallback(() => {
    cargarTodo()
  }, [cargarTodo])

  // Refresh on tab focus
  useRefreshOnFocus(refrescar, { enabled: !!user?.id && !!fechaInicio })

  useEffect(() => {
    if (fechaInicio && fechaFin && rolesComerciales.length >= 0 && user?.id) {
      cargarTodo()
    }
  }, [fechaInicio, fechaFin, rolesComerciales, user?.id])

  return {
    periodo, setPeriodo,
    fechaInicio, fechaFin,
    setFechaPersonalizada,
    kpis, kpisPrevios,
    graficoVentas, funnel,
    rankingSetters, rankingClosers,
    actividad, citasHoy, pendientes,
    loading, errores,
    esAdmin, esCloser, esSetter, esDirector,
    cargarTodo, refrescar,
  }
}
