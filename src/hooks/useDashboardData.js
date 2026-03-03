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

export function useDashboardData(layout) {
  const { user } = useAuth()
  const [periodo, setPeriodo] = useState('este_mes')
  const [fechaInicio, setFechaInicio] = useState(null)
  const [fechaFin, setFechaFin] = useState(null)
  const [usuarioFiltro, setUsuarioFiltro] = useState('')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const requestRef = useRef(0)

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
    const keys = dataKeysStr.split(',')
    if (keys.length === 0 || keys[0] === '') { setLoading(false); return }

    const reqId = ++requestRef.current
    setLoading(true)

    try {
      const { data: result, error } = await supabase.rpc('ventas_dashboard_widget_data', {
        p_usuario_id: usuarioFiltro || user.id,
        p_fecha_inicio: formatDate(fechaInicio),
        p_fecha_fin: formatDate(fechaFin),
        p_widgets: keys,
      })
      if (error) throw error
      if (reqId === requestRef.current) setData(result || {})
    } catch (e) {
      console.error('Dashboard data error:', e)
    } finally {
      if (reqId === requestRef.current) setLoading(false)
    }
  }, [user?.id, usuarioFiltro, fechaInicio, fechaFin, dataKeysStr])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  return {
    data, loading, periodo, setPeriodo,
    fechaInicio, fechaFin, setFechaPersonalizada,
    usuarioFiltro, setUsuarioFiltro,
    refrescar: cargarDatos,
  }
}
