import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { WIDGET_CATALOG } from '../config/widgetCatalog'

function calcularPeriodo(tipo) {
  const hoy = new Date()
  const yyyy = hoy.getFullYear(), mm = hoy.getMonth(), dd = hoy.getDate()
  switch (tipo) {
    case 'este_mes': return { inicio: new Date(yyyy, mm, 1), fin: hoy }
    case 'mes_pasado': return { inicio: new Date(yyyy, mm - 1, 1), fin: new Date(yyyy, mm, 0) }
    case 'ultimos_7': return { inicio: new Date(yyyy, mm, dd - 7), fin: hoy }
    case 'ultimos_30': return { inicio: new Date(yyyy, mm, dd - 30), fin: hoy }
    case 'ultimos_90': return { inicio: new Date(yyyy, mm, dd - 90), fin: hoy }
    case 'este_ano': return { inicio: new Date(yyyy, 0, 1), fin: hoy }
    default: return { inicio: new Date(yyyy, mm, 1), fin: hoy }
  }
}

function formatDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

let _dashboardCache = null

export function useDashboardData(layout) {
  const { user } = useAuth()
  const [periodo, setPeriodo] = useState('este_mes')
  const [fechaInicio, setFechaInicio] = useState(null)
  const [fechaFin, setFechaFin] = useState(null)
  const [usuarioFiltro, setUsuarioFiltro] = useState('')
  const [data, setData] = useState(_dashboardCache?.data || {})
  const [loading, setLoading] = useState(!_dashboardCache)
  const [error, setError] = useState(null)
  const requestRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

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

  // Stabilize: only recalculate when the set of widget types changes, not on drag/resize
  const dataKeysStr = useMemo(() => {
    const keys = new Set()
    layout.forEach(item => {
      const def = WIDGET_CATALOG[item.type]
      if (def?.dataKey) keys.add(def.dataKey)
    })
    return [...keys].sort().join(',')
  }, [layout])

  const cargarDatos = useCallback(async () => {
    if (!user?.id || !fechaInicio || !fechaFin || !dataKeysStr) {
      setLoading(false)
      return
    }
    const keys = dataKeysStr.split(',').filter(Boolean)
    if (keys.length === 0) { setLoading(false); return }

    const reqId = ++requestRef.current
    if (!_dashboardCache) setLoading(true)
    setError(null)

    try {
      const { data: result, error: rpcError } = await supabase.rpc('ventas_dashboard_widget_data', {
        p_usuario_id: usuarioFiltro || user.id,
        p_fecha_inicio: formatDate(fechaInicio),
        p_fecha_fin: formatDate(fechaFin),
        p_widgets: keys,
      })
      if (rpcError) throw rpcError
      if (reqId === requestRef.current && mountedRef.current) {
        _dashboardCache = { data: result || {} }
        setData(result || {})
      }
    } catch (e) {
      if (e?.name === 'AbortError' || e?.message?.includes('AbortError')) return
      import.meta.env.DEV && console.error('Dashboard data error:', e)
      if (reqId === requestRef.current && mountedRef.current) {
        setData({})
        setError(e?.message || 'Error cargando datos')
      }
    } finally {
      if (reqId === requestRef.current && mountedRef.current) setLoading(false)
    }
  }, [user?.id, usuarioFiltro, fechaInicio, fechaFin, dataKeysStr])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  return {
    data, loading, error, periodo, setPeriodo,
    fechaInicio, fechaFin, setFechaPersonalizada,
    usuarioFiltro, setUsuarioFiltro,
    refrescar: cargarDatos,
  }
}
