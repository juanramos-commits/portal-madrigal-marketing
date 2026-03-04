import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { logActividad } from '../lib/logActividad'

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function parseTime(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h + (m || 0) / 60
}

function obtenerRangoMes(fecha) {
  const y = fecha.getFullYear()
  const m = fecha.getMonth()
  const inicio = new Date(y, m, 1)
  const fin = new Date(y, m + 1, 0, 23, 59, 59)
  return { inicio, fin }
}

function obtenerRangoSemana(fecha) {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const inicio = new Date(d)
  inicio.setDate(d.getDate() + diff)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setDate(inicio.getDate() + 6)
  fin.setHours(23, 59, 59, 999)
  return { inicio, fin }
}

function obtenerRangoDia(fecha) {
  const inicio = new Date(fecha)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(fecha)
  fin.setHours(23, 59, 59, 999)
  return { inicio, fin }
}

export function useCalendario() {
  const { user, usuario, tienePermiso } = useAuth()

  const [citas, setCitas] = useState([])
  const [disponibilidad, setDisponibilidad] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [config, setConfig] = useState(null)
  const [enlaces, setEnlaces] = useState([])
  const [closers, setClosers] = useState([])
  const [reunionEstados, setReunionEstados] = useState([])
  const [setters, setSetters] = useState([])
  const [vista, setVista] = useState('semana')
  const [fechaActual, setFechaActual] = useState(new Date())
  const [closerFiltro, setCloserFiltro] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Roles
  const [rolesComerciales, setRolesComerciales] = useState([])
  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  // Roles para filtrado de datos en queries (basado en rol comercial real)
  const esCloserRol = misRoles.some(r => r.rol === 'closer')
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esDirectorRol = misRoles.some(r => r.rol === 'director_ventas') || esAdmin
  // Permisos para visibilidad de features/tabs
  const esCloser = esCloserRol || tienePermiso('ventas.calendario.disponibilidad')
  const esDirector = tienePermiso('ventas.calendario.reasignar')

  // Load roles
  useEffect(() => {
    if (!user?.id) return
    const cargar = async () => {
      const { data } = await supabase
        .from('ventas_roles_comerciales')
        .select('*, usuario:usuarios(id, nombre, email)')
        .eq('activo', true)
      setRolesComerciales(data || [])
    }
    cargar()
  }, [user?.id])

  // Derive closers and setters from roles
  useEffect(() => {
    const closersList = []
    const settersList = []
    const seenClosers = new Set()
    const seenSetters = new Set()
    for (const r of rolesComerciales) {
      if (r.rol === 'closer' && !seenClosers.has(r.usuario_id)) {
        seenClosers.add(r.usuario_id)
        closersList.push({ id: r.usuario_id, nombre: r.usuario?.nombre, email: r.usuario?.email })
      }
      if (r.rol === 'setter' && !seenSetters.has(r.usuario_id)) {
        seenSetters.add(r.usuario_id)
        settersList.push({ id: r.usuario_id, nombre: r.usuario?.nombre, email: r.usuario?.email })
      }
    }
    setClosers(closersList)
    setSetters(settersList)
  }, [rolesComerciales])

  // Obtener rango de fechas según vista
  const obtenerRangoFechas = useCallback(() => {
    if (vista === 'mes') return obtenerRangoMes(fechaActual)
    if (vista === 'semana') return obtenerRangoSemana(fechaActual)
    return obtenerRangoDia(fechaActual)
  }, [vista, fechaActual])

  // Navegación
  const irAnterior = useCallback(() => {
    setFechaActual(prev => {
      const d = new Date(prev)
      if (vista === 'mes') d.setMonth(d.getMonth() - 1)
      else if (vista === 'semana') d.setDate(d.getDate() - 7)
      else d.setDate(d.getDate() - 1)
      return d
    })
  }, [vista])

  const irSiguiente = useCallback(() => {
    setFechaActual(prev => {
      const d = new Date(prev)
      if (vista === 'mes') d.setMonth(d.getMonth() + 1)
      else if (vista === 'semana') d.setDate(d.getDate() + 7)
      else d.setDate(d.getDate() + 1)
      return d
    })
  }, [vista])

  const irHoy = useCallback(() => {
    setFechaActual(new Date())
  }, [])

  // Load reunion estados
  const cargarReunionEstados = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_reunion_estados')
      .select('*')
      .eq('activo', true)
      .order('orden')
    setReunionEstados(data || [])
  }, [])

  // Load citas
  const cargarCitas = useCallback(async () => {
    const { inicio, fin } = obtenerRangoFechas()
    let query = supabase
      .from('ventas_citas')
      .select(`
        *,
        lead:ventas_leads(id, nombre),
        closer:usuarios!ventas_citas_closer_id_fkey(id, nombre, email),
        setter_origen:usuarios!ventas_citas_setter_origen_id_fkey(id, nombre, email),
        estado_reunion:ventas_reunion_estados(id, nombre, color),
        enlace:ventas_enlaces_agenda(id, nombre, fuente)
      `)
      .gte('fecha_hora', inicio.toISOString())
      .lte('fecha_hora', fin.toISOString())
      .order('fecha_hora', { ascending: true })

    // Filter by role (usar roles comerciales reales, no permisos)
    if (esCloserRol && !esDirectorRol) {
      query = query.eq('closer_id', user.id)
    } else if (esSetter && !esDirectorRol && !esCloserRol) {
      query = query.eq('setter_origen_id', user.id)
    }

    // Admin filter by closer
    if (esDirectorRol && closerFiltro) {
      query = query.eq('closer_id', closerFiltro)
    }

    const { data, error: err } = await query
    if (err) { setError('Error al cargar citas'); return }
    setCitas(data || [])
  }, [obtenerRangoFechas, esCloserRol, esDirectorRol, esSetter, user?.id, closerFiltro])

  // Update cita estado
  const actualizarEstadoCita = useCallback(async (citaId, estadoReunionId) => {
    const { error: err } = await supabase
      .from('ventas_citas')
      .update({ estado_reunion_id: estadoReunionId, updated_at: new Date().toISOString() })
      .eq('id', citaId)
    if (err) throw err
    setCitas(prev => prev.map(c => c.id === citaId ? { ...c, estado_reunion_id: estadoReunionId, estado_reunion: reunionEstados.find(e => e.id === estadoReunionId) || c.estado_reunion } : c))
    cargarCitas()
    logActividad('calendario', 'editar', 'Estado cita actualizado', { entidad: 'cita', entidad_id: citaId })
  }, [reunionEstados, cargarCitas])

  // Update cita notas
  const actualizarNotasCita = useCallback(async (citaId, notas) => {
    const { error: err } = await supabase
      .from('ventas_citas')
      .update({ notas_closer: notas, updated_at: new Date().toISOString() })
      .eq('id', citaId)
    if (err) throw err
    setCitas(prev => prev.map(c => c.id === citaId ? { ...c, notas_closer: notas } : c))
  }, [])

  // Update lead enlace grabación
  const actualizarEnlaceGrabacion = useCallback(async (leadId, enlace) => {
    const { error: err } = await supabase
      .from('ventas_leads')
      .update({ enlace_grabacion: enlace, updated_at: new Date().toISOString() })
      .eq('id', leadId)
    if (err) throw err
  }, [])

  // Cancel cita (admin)
  const cancelarCita = useCallback(async (citaId) => {
    const { error: err } = await supabase
      .from('ventas_citas')
      .update({ estado: 'cancelada', cancelada_por: 'admin', updated_at: new Date().toISOString() })
      .eq('id', citaId)
    if (err) throw err
    setCitas(prev => prev.map(c => c.id === citaId ? { ...c, estado: 'cancelada', cancelada_por: 'admin' } : c))
    cargarCitas()
    logActividad('calendario', 'eliminar', 'Cita cancelada', { entidad: 'cita', entidad_id: citaId })
  }, [cargarCitas])

  // Reasignar closer (admin)
  const reasignarCloser = useCallback(async (citaId, nuevoCloserId) => {
    const { error: err } = await supabase
      .from('ventas_citas')
      .update({ closer_id: nuevoCloserId, updated_at: new Date().toISOString() })
      .eq('id', citaId)
    if (err) throw err
    await cargarCitas()
    logActividad('calendario', 'asignar', 'Closer reasignado en cita', { entidad: 'cita', entidad_id: citaId })
  }, [cargarCitas])

  // Load disponibilidad
  const cargarDisponibilidad = useCallback(async (uid) => {
    const targetId = uid || user?.id
    if (!targetId) return
    const { data } = await supabase
      .from('ventas_calendario_disponibilidad')
      .select('*')
      .eq('usuario_id', targetId)
      .order('dia_semana')
      .order('hora_inicio')
    setDisponibilidad(data || [])
  }, [user?.id])

  // Save disponibilidad
  const guardarDisponibilidad = useCallback(async (franjas) => {
    if (!user?.id) return
    // Delete existing
    await supabase
      .from('ventas_calendario_disponibilidad')
      .delete()
      .eq('usuario_id', user.id)

    if (franjas.length > 0) {
      const rows = franjas.map(f => ({
        usuario_id: user.id,
        dia_semana: f.dia_semana,
        hora_inicio: f.hora_inicio,
        hora_fin: f.hora_fin,
        activo: f.activo !== false,
      }))
      const { error: err } = await supabase
        .from('ventas_calendario_disponibilidad')
        .insert(rows)
      if (err) throw err
    }

    setDisponibilidad(franjas.map((f, i) => ({ ...f, id: `temp-${i}`, usuario_id: user.id })))
    logActividad('calendario', 'editar', 'Disponibilidad guardada')
  }, [user?.id])

  // Calculate weekly hours
  const calcularHorasSemanales = useCallback((disp) => {
    const data = disp || disponibilidad
    return data
      .filter(d => d.activo !== false)
      .reduce((total, d) => {
        const inicio = parseTime(d.hora_inicio)
        const fin = parseTime(d.hora_fin)
        return total + Math.max(0, fin - inicio)
      }, 0)
  }, [disponibilidad])

  // Load bloqueos
  const cargarBloqueos = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_calendario_bloqueos')
      .select('*')
      .eq('usuario_id', user.id)
      .order('fecha_inicio', { ascending: false })
    setBloqueos(data || [])
  }, [user?.id])

  // Create bloqueo
  const crearBloqueo = useCallback(async (bloqueo) => {
    if (!user?.id) return
    const { data, error: err } = await supabase
      .from('ventas_calendario_bloqueos')
      .insert({
        usuario_id: user.id,
        fecha_inicio: bloqueo.fecha_inicio,
        fecha_fin: bloqueo.fecha_fin,
        motivo: bloqueo.motivo || null,
      })
      .select()
      .single()
    if (err) throw err
    setBloqueos(prev => [data, ...prev])
    logActividad('calendario', 'crear', `Bloqueo creado: ${bloqueo.motivo || 'Sin motivo'}`, { entidad: 'bloqueo', entidad_id: data.id })
    return data
  }, [user?.id])

  // Delete bloqueo
  const eliminarBloqueo = useCallback(async (bloqueoId) => {
    const { error: err } = await supabase
      .from('ventas_calendario_bloqueos')
      .delete()
      .eq('id', bloqueoId)
    if (err) throw err
    setBloqueos(prev => prev.filter(b => b.id !== bloqueoId))
    logActividad('calendario', 'eliminar', 'Bloqueo eliminado', { entidad: 'bloqueo', entidad_id: bloqueoId })
  }, [])

  // Load config
  const cargarConfig = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_calendario_config')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (data) {
      setConfig(data)
    } else {
      setConfig({
        usuario_id: user.id,
        duracion_slot_minutos: 60,
        descanso_entre_citas_minutos: 15,
        minimo_horas_semana: null,
      })
    }
  }, [user?.id])

  // Save config
  const guardarConfig = useCallback(async (cfg) => {
    if (!user?.id) return
    const { data, error: err } = await supabase
      .from('ventas_calendario_config')
      .upsert({
        ...cfg,
        usuario_id: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'usuario_id' })
      .select()
      .single()
    if (err) throw err
    setConfig(data)
    logActividad('calendario', 'editar', 'Configuración de calendario actualizada')
  }, [user?.id])

  // Load enlaces (admin)
  const cargarEnlaces = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_enlaces_agenda')
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email), creado_por:usuarios!ventas_enlaces_agenda_creado_por_id_fkey(id, nombre)')
      .order('created_at', { ascending: false })
    setEnlaces(data || [])
  }, [])

  // Create enlace
  const crearEnlace = useCallback(async (enlace) => {
    const { data, error: err } = await supabase
      .from('ventas_enlaces_agenda')
      .insert({
        nombre: enlace.nombre,
        slug: enlace.slug,
        setter_id: enlace.setter_id || null,
        fuente: enlace.fuente || null,
        activo: true,
        creado_por_id: user?.id,
      })
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email)')
      .single()
    if (err) throw err
    setEnlaces(prev => [data, ...prev])
    return data
  }, [user?.id])

  // Update enlace
  const actualizarEnlace = useCallback(async (enlaceId, campos) => {
    const { data, error: err } = await supabase
      .from('ventas_enlaces_agenda')
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', enlaceId)
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email)')
      .single()
    if (err) throw err
    setEnlaces(prev => prev.map(e => e.id === enlaceId ? data : e))
  }, [])

  // Delete enlace
  const eliminarEnlace = useCallback(async (enlaceId) => {
    const { error: err } = await supabase
      .from('ventas_enlaces_agenda')
      .delete()
      .eq('id', enlaceId)
    if (err) throw err
    setEnlaces(prev => prev.filter(e => e.id !== enlaceId))
  }, [])

  // Admin: load closer configs
  const cargarClosersConConfig = useCallback(async () => {
    if (!closers.length) return []
    const ids = closers.map(c => c.id)
    const [configsRes, citasRes] = await Promise.all([
      supabase.from('ventas_calendario_config').select('*').in('usuario_id', ids),
      supabase.from('ventas_citas').select('closer_id, fecha_hora').in('closer_id', ids).gte('fecha_hora', obtenerRangoSemana(new Date()).inicio.toISOString()).lte('fecha_hora', obtenerRangoSemana(new Date()).fin.toISOString()),
    ])

    const configs = configsRes.data || []
    const citasSemana = citasRes.data || []

    // Load availability for each closer
    const dispRes = await supabase
      .from('ventas_calendario_disponibilidad')
      .select('*')
      .in('usuario_id', ids)
      .eq('activo', true)

    const dispData = dispRes.data || []

    return closers.map(c => {
      const cfg = configs.find(x => x.usuario_id === c.id) || {}
      const closerCitas = citasSemana.filter(x => x.closer_id === c.id)
      const closerDisp = dispData.filter(x => x.usuario_id === c.id)
      const horasSemanales = calcularHorasSemanales(closerDisp)

      const proximaCita = closerCitas
        .filter(x => new Date(x.fecha_hora) >= new Date())
        .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))[0]

      return {
        ...c,
        duracion_slot_minutos: cfg.duracion_slot_minutos || 60,
        descanso_entre_citas_minutos: cfg.descanso_entre_citas_minutos || 15,
        minimo_horas_semana: cfg.minimo_horas_semana || null,
        horas_configuradas: horasSemanales,
        citas_semana: closerCitas.length,
        proxima_cita: proximaCita?.fecha_hora || null,
        config_id: cfg.id,
      }
    })
  }, [closers, calcularHorasSemanales])

  // Admin: update minimo horas
  const actualizarMinimoHoras = useCallback(async (closerId, minimo) => {
    const { error: err } = await supabase
      .from('ventas_calendario_config')
      .upsert({
        usuario_id: closerId,
        minimo_horas_semana: minimo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'usuario_id' })
    if (err) throw err
  }, [])

  // Utilities
  const esBloqueado = useCallback((fecha) => {
    const t = new Date(fecha).getTime()
    return bloqueos.some(b => {
      const ini = new Date(b.fecha_inicio).getTime()
      const fin = new Date(b.fecha_fin).getTime()
      return t >= ini && t <= fin
    })
  }, [bloqueos])

  // Refresh
  // Usar permisos (esCloser/esDirector) para cargar datos, ya que los tabs se muestran por permisos
  const refrescar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        cargarCitas(),
        cargarReunionEstados(),
        esCloser ? cargarDisponibilidad() : Promise.resolve(),
        esCloser ? cargarBloqueos() : Promise.resolve(),
        esCloser ? cargarConfig() : Promise.resolve(),
        esDirector ? cargarEnlaces() : Promise.resolve(),
      ])
    } catch (_) {
      setError('Error al cargar datos del calendario')
    } finally {
      setLoading(false)
    }
  }, [cargarCitas, cargarReunionEstados, esCloser, esDirector, cargarDisponibilidad, cargarBloqueos, cargarConfig, cargarEnlaces])

  // Refresh on tab focus
  useRefreshOnFocus(refrescar, { enabled: !!user?.id })

  // Realtime: listen to citas changes
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('calendario-citas')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ventas_citas',
      }, () => {
        cargarCitas()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, cargarCitas])

  // Initial load
  useEffect(() => {
    if (user?.id && rolesComerciales.length > 0) {
      refrescar()
    }
  }, [user?.id, rolesComerciales.length])

  // Reload citas on navigation/filter change
  useEffect(() => {
    if (user?.id && rolesComerciales.length > 0) {
      cargarCitas()
    }
  }, [vista, fechaActual, closerFiltro])

  return {
    citas, disponibilidad, bloqueos, config, enlaces, closers, setters,
    reunionEstados,
    vista, fechaActual, closerFiltro, loading, error,
    esCloser, esSetter, esDirector, esAdmin,
    diasSemana: DIAS_SEMANA,

    setVista, setFechaActual, setCloserFiltro,
    irAnterior, irSiguiente, irHoy,
    obtenerRangoFechas,

    cargarCitas,
    actualizarEstadoCita,
    actualizarNotasCita,
    actualizarEnlaceGrabacion,
    cancelarCita,
    reasignarCloser,

    cargarDisponibilidad,
    guardarDisponibilidad,
    calcularHorasSemanales,

    cargarBloqueos,
    crearBloqueo,
    eliminarBloqueo,

    cargarConfig,
    guardarConfig,

    cargarEnlaces,
    crearEnlace,
    actualizarEnlace,
    eliminarEnlace,

    cargarClosersConConfig,
    actualizarMinimoHoras,

    esBloqueado,
    refrescar,
  }
}
