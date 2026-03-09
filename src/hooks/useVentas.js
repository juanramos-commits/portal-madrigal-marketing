import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { logActividad } from '../lib/logActividad'
import { getCached, setCache } from '../lib/cache'

const PAGE_SIZE = 25

export function useVentas() {
  const { user, usuario, tienePermiso } = useAuth()

  const [ventas, setVentas] = useState([])
  const [paquetes, setPaquetes] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [paginaActual, setPaginaActual] = useState(0)
  const [totalVentas, setTotalVentas] = useState(0)
  const [contadores, setContadores] = useState({ todas: 0, pendiente: 0, aprobada: 0, rechazada: 0, devolucion: 0 })
  const [error, setError] = useState(null)
  const [filtros, setFiltrosState] = useState({
    setter_id: '', closer_id: '', paquete_id: '', metodo_pago: '',
    es_pago_unico: '', importe_min: '', importe_max: '', fecha_desde: '', fecha_hasta: '',
  })
  const [settersList, setSettersList] = useState([])
  const [closersList, setClosersList] = useState([])

  const busquedaTimeoutRef = useRef(null)
  const searchRequestRef = useRef(0)
  const loadRequestRef = useRef(0)
  const realtimeDebounceRef = useRef(null)
  const loadingTimeoutRef = useRef(null)
  const refrescarRef = useRef(null)
  const [searchResultCount, setSearchResultCount] = useState(null)
  const [exportando, setExportando] = useState(false)

  // Roles
  const [rolesComerciales, setRolesComerciales] = useState([])
  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esDirector = misRoles.some(r => r.rol === 'director_ventas' || r.rol === 'super_admin')
  const esCloser = misRoles.some(r => r.rol === 'closer')
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esAdminODirector = tienePermiso('ventas.ventas.ver_todos')

  // ── Load roles ─────────────────────────────────────────────────────
  const [rolesLoaded, setRolesLoaded] = useState(false)
  useEffect(() => {
    if (!user?.id) return
    const cargar = async () => {
      const cached = getCached('rolesBasic')
      if (cached) {
        setRolesComerciales(cached)
        setRolesLoaded(true)
        return
      }
      const { data, error } = await supabase
        .from('ventas_roles_comerciales')
        .select('id, usuario_id, rol, activo')
        .eq('activo', true)
      if (error) console.error('Error cargando roles comerciales:', error)
      setRolesComerciales(data || [])
      setCache('rolesBasic', data || [])
      setRolesLoaded(true)
    }
    cargar()
  }, [user?.id])

  // ── Load packages ──────────────────────────────────────────────────
  const cargarPaquetes = useCallback(async () => {
    const { data, error } = await supabase
      .from('ventas_paquetes')
      .select('id, nombre, precio, descripcion, orden, activo')
      .eq('activo', true)
      .order('orden')
    if (error) console.error('Error cargando paquetes:', error)
    setPaquetes(data || [])
  }, [])

  useEffect(() => {
    cargarPaquetes()
  }, [cargarPaquetes])

  // ── Load setters/closers for filter selects ───────────────────────
  useEffect(() => {
    if (!user?.id) return
    const cargar = async () => {
      const cachedS = getCached('settersList')
      const cachedC = getCached('closersList')
      if (cachedS && cachedC) {
        setSettersList(cachedS)
        setClosersList(cachedC)
        return
      }
      const [{ data: s }, { data: c }] = await Promise.all([
        supabase.from('ventas_roles_comerciales').select('usuario_id, usuario:usuarios(id, nombre, email)').eq('rol', 'setter').eq('activo', true),
        supabase.from('ventas_roles_comerciales').select('usuario_id, usuario:usuarios(id, nombre, email)').eq('rol', 'closer').eq('activo', true),
      ])
      setSettersList(s || [])
      setClosersList(c || [])
      setCache('settersList', s || [])
      setCache('closersList', c || [])
    }
    cargar()
  }, [user?.id])

  // ── Build query (non-search only) ──────────────────────────────────
  const buildQuery = useCallback(() => {
    let query = supabase
      .from('ventas_ventas')
      .select(`
        id, lead_id, closer_id, setter_id, paquete_id,
        fecha_venta, importe, metodo_pago, estado,
        es_pago_unico, es_devolucion, fecha_devolucion,
        fecha_aprobacion, fecha_rechazo, notas,
        created_at, updated_at,
        lead:ventas_leads(id, nombre, telefono, email),
        paquete:ventas_paquetes(id, nombre, precio),
        closer:usuarios!ventas_ventas_closer_id_fkey(id, nombre, email),
        setter:usuarios!ventas_ventas_setter_id_fkey(id, nombre, email)
      `, { count: 'exact' })

    // Role-based filtering
    if (!esAdminODirector) {
      if (esCloser && !esSetter) {
        query = query.eq('closer_id', user.id)
      } else if (esSetter && !esCloser) {
        query = query.eq('setter_id', user.id)
      } else if (esSetter && esCloser) {
        query = query.or(`closer_id.eq.${user.id},setter_id.eq.${user.id}`)
      }
    }

    // Status filter
    if (filtroEstado === 'devolucion') {
      query = query.eq('es_devolucion', true)
    } else if (filtroEstado !== 'todas') {
      query = query.eq('estado', filtroEstado).eq('es_devolucion', false)
    }

    // Advanced filters
    if (filtros.setter_id) query = query.eq('setter_id', filtros.setter_id)
    if (filtros.closer_id) query = query.eq('closer_id', filtros.closer_id)
    if (filtros.paquete_id) query = query.eq('paquete_id', filtros.paquete_id)
    if (filtros.metodo_pago) query = query.eq('metodo_pago', filtros.metodo_pago)
    if (filtros.es_pago_unico !== '') query = query.eq('es_pago_unico', filtros.es_pago_unico === 'true')
    if (filtros.importe_min) query = query.gte('importe', parseFloat(filtros.importe_min))
    if (filtros.importe_max) query = query.lte('importe', parseFloat(filtros.importe_max))
    if (filtros.fecha_desde) query = query.gte('fecha_venta', filtros.fecha_desde)
    if (filtros.fecha_hasta) query = query.lte('fecha_venta', filtros.fecha_hasta)

    return query
  }, [esAdminODirector, esCloser, esSetter, user?.id, filtroEstado, filtros])

  // ── Load ventas ────────────────────────────────────────────────────
  const cargarVentas = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    try {
      setLoading(true)
      setError(null)

      const from = paginaActual * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const query = buildQuery()
        .order('fecha_venta', { ascending: false })
        .range(from, to)

      const { data, count, error: err } = await query
      if (err) throw err
      if (requestId !== loadRequestRef.current) return

      setVentas(data || [])
      setTotalVentas(count || 0)
    } catch (err) {
      if (requestId !== loadRequestRef.current) return
      setError('Error al cargar ventas')
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }, [buildQuery, paginaActual])

  // ── Load counters ──────────────────────────────────────────────────
  const cargarContadores = useCallback(async () => {
    try {
      const baseFilter = (q) => {
        if (!esAdminODirector) {
          if (esCloser && !esSetter) {
            q = q.eq('closer_id', user.id)
          } else if (esSetter && !esCloser) {
            q = q.eq('setter_id', user.id)
          } else if (esSetter && esCloser) {
            q = q.or(`closer_id.eq.${user.id},setter_id.eq.${user.id}`)
          }
        }
        // Advanced filters
        if (filtros.setter_id) q = q.eq('setter_id', filtros.setter_id)
        if (filtros.closer_id) q = q.eq('closer_id', filtros.closer_id)
        if (filtros.paquete_id) q = q.eq('paquete_id', filtros.paquete_id)
        if (filtros.metodo_pago) q = q.eq('metodo_pago', filtros.metodo_pago)
        if (filtros.es_pago_unico !== '') q = q.eq('es_pago_unico', filtros.es_pago_unico === 'true')
        if (filtros.importe_min) q = q.gte('importe', parseFloat(filtros.importe_min))
        if (filtros.importe_max) q = q.lte('importe', parseFloat(filtros.importe_max))
        if (filtros.fecha_desde) q = q.gte('fecha_venta', filtros.fecha_desde)
        if (filtros.fecha_hasta) q = q.lte('fecha_venta', filtros.fecha_hasta)
        return q
      }

      const [
        { count: todas },
        { count: pendiente },
        { count: aprobada },
        { count: rechazada },
        { count: devolucion },
      ] = await Promise.all([
        baseFilter(supabase.from('ventas_ventas').select('id', { count: 'exact', head: true })),
        baseFilter(supabase.from('ventas_ventas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').eq('es_devolucion', false)),
        baseFilter(supabase.from('ventas_ventas').select('id', { count: 'exact', head: true }).eq('estado', 'aprobada').eq('es_devolucion', false)),
        baseFilter(supabase.from('ventas_ventas').select('id', { count: 'exact', head: true }).eq('estado', 'rechazada').eq('es_devolucion', false)),
        baseFilter(supabase.from('ventas_ventas').select('id', { count: 'exact', head: true }).eq('es_devolucion', true)),
      ])

      setContadores({
        todas: todas || 0,
        pendiente: pendiente || 0,
        aprobada: aprobada || 0,
        rechazada: rechazada || 0,
        devolucion: devolucion || 0,
      })
    } catch {
      // Non-critical
    }
  }, [esAdminODirector, esCloser, esSetter, user?.id, filtros])

  // ── Estado → RPC params helper ────────────────────────────────────
  const getEstadoRPCParams = (estado) => {
    switch (estado) {
      case 'devolucion': return { p_estado: null, p_es_devolucion: true }
      case 'todas': return { p_estado: null, p_es_devolucion: null }
      default: return { p_estado: estado, p_es_devolucion: false }
    }
  }

  // ── Search-aware counters via RPC ────────────────────────────────
  const cargarContadoresConBusqueda = useCallback(async (query) => {
    try {
      const effectiveRole = esAdminODirector ? 'super_admin' : ''
      const configs = [
        { key: 'todas', p_estado: null, p_es_devolucion: null },
        { key: 'pendiente', p_estado: 'pendiente', p_es_devolucion: false },
        { key: 'aprobada', p_estado: 'aprobada', p_es_devolucion: false },
        { key: 'rechazada', p_estado: 'rechazada', p_es_devolucion: false },
        { key: 'devolucion', p_estado: null, p_es_devolucion: true },
      ]

      const results = await Promise.all(
        configs.map(({ p_estado, p_es_devolucion }) =>
          supabase.rpc('ventas_buscar_ventas', {
            p_query: query,
            p_estado,
            p_es_devolucion,
            p_user_id: user?.id,
            p_user_role: effectiveRole,
            p_limit: 1,
            p_offset: 0,
          })
        )
      )

      const conteos = {}
      configs.forEach(({ key }, i) => {
        const { data } = results[i]
        conteos[key] = Number(data?.[0]?.total_count || 0)
      })

      setContadores(conteos)
    } catch {
      // Non-critical
    }
  }, [esAdminODirector, user?.id])

  // ── Search via RPC ───────────────────────────────────────────────
  const buscarVentas = useCallback(async (query) => {
    const requestId = ++searchRequestRef.current
    setLoading(true)
    setError(null)

    try {
      const effectiveRole = esAdminODirector ? 'super_admin' : ''
      const { p_estado, p_es_devolucion } = getEstadoRPCParams(filtroEstado)

      const { data: results, error: rpcErr } = await supabase.rpc('ventas_buscar_ventas', {
        p_query: query,
        p_estado,
        p_es_devolucion,
        p_user_id: user?.id,
        p_user_role: effectiveRole,
        p_limit: PAGE_SIZE,
        p_offset: paginaActual * PAGE_SIZE,
      })

      if (rpcErr) throw rpcErr
      if (requestId !== searchRequestRef.current) return

      if (!results || results.length === 0) {
        setVentas([])
        setTotalVentas(0)
        setSearchResultCount(0)
        cargarContadoresConBusqueda(query)
        return
      }

      const totalCount = Number(results[0]?.total_count || 0)
      const ventaIds = results.map(r => r.venta_id)

      // Load full venta data
      const { data: ventasData, error: ventasErr } = await supabase
        .from('ventas_ventas')
        .select(`
          id, lead_id, closer_id, setter_id, paquete_id,
          fecha_venta, importe, metodo_pago, estado,
          es_pago_unico, es_devolucion, fecha_devolucion,
          fecha_aprobacion, fecha_rechazo, notas,
          created_at, updated_at,
          lead:ventas_leads(id, nombre, telefono, email),
          paquete:ventas_paquetes(id, nombre, precio),
          closer:usuarios!ventas_ventas_closer_id_fkey(id, nombre, email),
          setter:usuarios!ventas_ventas_setter_id_fkey(id, nombre, email)
        `)
        .in('id', ventaIds)

      if (ventasErr) throw ventasErr
      if (requestId !== searchRequestRef.current) return

      // Sort by relevancia
      const relevanciaMap = {}
      results.forEach(r => { relevanciaMap[r.venta_id] = r.relevancia })
      const sorted = (ventasData || []).sort(
        (a, b) => (relevanciaMap[b.id] || 0) - (relevanciaMap[a.id] || 0)
      )

      setVentas(sorted)
      setTotalVentas(totalCount)
      setSearchResultCount(totalCount)
      cargarContadoresConBusqueda(query).catch(() => {})
    } catch (err) {
      if (requestId !== searchRequestRef.current) return
      console.warn('RPC ventas_buscar_ventas no disponible, usando búsqueda simple:', err.message)
      setSearchResultCount(null)
      await cargarVentas()
      cargarContadores().catch(() => {})
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false)
    }
  }, [esAdminODirector, user?.id, filtroEstado, paginaActual, cargarVentas, cargarContadores, cargarContadoresConBusqueda])

  // ── Load commissions for a sale ────────────────────────────────────
  const cargarComisiones = useCallback(async (ventaId) => {
    const { data, error: err } = await supabase
      .from('ventas_comisiones')
      .select('*, usuario:usuarios(id, nombre, email)')
      .eq('venta_id', ventaId)
      .order('created_at', { ascending: true })

    if (err) throw err
    return data || []
  }, [])

  // ── Export CSV (paginated to get ALL results) ─────────────────────
  const exportarCSV = useCallback(async () => {
    if (!tienePermiso('ventas.ventas.exportar')) throw new Error('No tienes permiso para exportar ventas')
    setExportando(true)
    setError(null)
    try {
      const PAGE = 1000
      let allData = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from('ventas_ventas')
          .select(`
            *, lead:ventas_leads(nombre, email, telefono, nombre_negocio),
            paquete:ventas_paquetes(nombre),
            setter:usuarios!ventas_ventas_setter_id_fkey(nombre),
            closer:usuarios!ventas_ventas_closer_id_fkey(nombre)
          `)
          .order('fecha_venta', { ascending: false })
          .range(page * PAGE, (page + 1) * PAGE - 1)

        // RBAC
        if (!esAdminODirector) {
          if (esCloser && !esSetter) query = query.eq('closer_id', user.id)
          else if (esSetter && !esCloser) query = query.eq('setter_id', user.id)
          else if (esSetter && esCloser) query = query.or(`closer_id.eq.${user.id},setter_id.eq.${user.id}`)
        }

        // Status filter
        if (filtroEstado === 'devolucion') query = query.eq('es_devolucion', true)
        else if (filtroEstado !== 'todas') query = query.eq('estado', filtroEstado).eq('es_devolucion', false)

        // Advanced filters
        if (filtros.setter_id) query = query.eq('setter_id', filtros.setter_id)
        if (filtros.closer_id) query = query.eq('closer_id', filtros.closer_id)
        if (filtros.paquete_id) query = query.eq('paquete_id', filtros.paquete_id)
        if (filtros.metodo_pago) query = query.eq('metodo_pago', filtros.metodo_pago)
        if (filtros.es_pago_unico !== '') query = query.eq('es_pago_unico', filtros.es_pago_unico === 'true')
        if (filtros.importe_min) query = query.gte('importe', parseFloat(filtros.importe_min))
        if (filtros.importe_max) query = query.lte('importe', parseFloat(filtros.importe_max))
        if (filtros.fecha_desde) query = query.gte('fecha_venta', filtros.fecha_desde)
        if (filtros.fecha_hasta) query = query.lte('fecha_venta', filtros.fecha_hasta)

        const { data, error: err } = await query
        if (err) throw err

        allData = allData.concat(data || [])
        hasMore = (data || []).length === PAGE
        page++
      }

      if (allData.length === 0) {
        setError('No hay ventas para exportar con los filtros actuales')
        return
      }

      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-ES') : '-'

      const csvData = allData.map(v => ({
        'Lead': v.lead?.nombre || '-',
        'Email': v.lead?.email || '-',
        'Teléfono': v.lead?.telefono || '-',
        'Nombre Negocio': v.lead?.nombre_negocio || '-',
        'Fecha Venta': fmtDate(v.fecha_venta),
        'Paquete': v.paquete?.nombre || '-',
        'Importe': v.importe ? `${v.importe}€` : '0€',
        'Método Pago': v.metodo_pago || '-',
        'Pago Único': v.es_pago_unico ? 'Sí' : 'No',
        'Setter': v.setter?.nombre || '-',
        'Closer': v.closer?.nombre || '-',
        'Estado': v.estado || '-',
        'Es Devolución': v.es_devolucion ? 'Sí' : 'No',
        'Fecha Aprobación': fmtDate(v.fecha_aprobacion),
        'Fecha Rechazo': fmtDate(v.fecha_rechazo),
        'Fecha Devolución': fmtDate(v.fecha_devolucion),
      }))

      const Papa = (await import('papaparse')).default
      const { saveAs } = await import('file-saver')
      const csv = Papa.unparse(csvData, { delimiter: ';', quotes: true })
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const fecha = new Date().toISOString().split('T')[0]
      saveAs(blob, `ventas_${fecha}.csv`)
    } catch (err) {
      console.error('Error exportando CSV:', err)
      setError('Error al exportar CSV')
    } finally {
      setExportando(false)
    }
  }, [esAdminODirector, esCloser, esSetter, user?.id, filtroEstado, filtros])

  // ── Refresh all ────────────────────────────────────────────────────
  const refrescar = useCallback(() => {
    if (busqueda.trim()) {
      buscarVentas(busqueda.trim())
    } else {
      setSearchResultCount(null)
      cargarVentas()
      cargarContadores()
    }
  }, [busqueda, buscarVentas, cargarVentas, cargarContadores])

  useEffect(() => { refrescarRef.current = refrescar }, [refrescar])

  // ── Register sale (from pop-up) ────────────────────────────────────
  const registrarVenta = useCallback(async (datos) => {
    if (!tienePermiso('ventas.ventas.crear')) throw new Error('No tienes permiso para registrar ventas')
    const { data: venta, error: err } = await supabase
      .from('ventas_ventas')
      .insert({
        lead_id: datos.lead_id,
        closer_id: datos.closer_id || null,
        setter_id: datos.setter_id || null,
        paquete_id: datos.paquete_id,
        fecha_venta: datos.fecha_venta,
        importe: datos.importe,
        metodo_pago: datos.metodo_pago,
        es_pago_unico: datos.es_pago_unico || false,
        estado: 'pendiente',
      })
      .select()
      .single()

    if (err) throw err

    // Log activity (non-critical)
    const { error: actErr } = await supabase.from('ventas_actividad').insert({
      lead_id: datos.lead_id,
      usuario_id: user?.id,
      tipo: 'venta',
      descripcion: `Venta registrada — ${datos.paquete_nombre || 'Paquete'} — ${Number(datos.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`,
      datos: { venta_id: venta.id, importe: datos.importe },
    })
    if (actErr) console.warn('Error al registrar actividad:', actErr.message)

    logActividad('ventas', 'crear', 'Venta registrada: ' + (datos.paquete_nombre || 'Paquete') + ' — ' + datos.importe + '€', { entidad: 'venta', entidad_id: venta.id })

    // Notify super_admin(s) (non-critical)
    const { data: admins } = await supabase
      .from('usuarios')
      .select('id')
      .eq('tipo', 'super_admin')
      .eq('activo', true)

    if (admins && admins.length > 0) {
      const notificaciones = admins.map(a => ({
        usuario_id: a.id,
        tipo: 'venta_pendiente',
        titulo: 'Nueva venta pendiente de aprobación',
        mensaje: `${datos.lead_nombre || 'Lead'} — ${Number(datos.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`,
        datos: { venta_id: venta.id, lead_id: datos.lead_id },
      }))
      const { error: notifErr } = await supabase.from('ventas_notificaciones').insert(notificaciones)
      if (notifErr) console.warn('Error al crear notificaciones:', notifErr.message)
    }

    refrescar()
    return venta
  }, [user?.id, refrescar, tienePermiso])

  // ── Move lead to venta stage in both pipelines ─────────────────────
  const moverLeadAVenta = useCallback(async (leadId, pipelineId, etapaVentaId) => {
    // Move in the current pipeline
    const { error: moveErr } = await supabase
      .from('ventas_lead_pipeline')
      .update({ etapa_id: etapaVentaId, fecha_entrada: new Date().toISOString() })
      .eq('lead_id', leadId)
      .eq('pipeline_id', pipelineId)

    if (moveErr) throw moveErr

    // Move in the other pipeline too (find venta stage there)
    const { data: otherPipelines, error: otherErr } = await supabase
      .from('ventas_lead_pipeline')
      .select('pipeline_id')
      .eq('lead_id', leadId)
      .neq('pipeline_id', pipelineId)

    if (otherErr) throw otherErr

    if (otherPipelines && otherPipelines.length > 0) {
      for (const entry of otherPipelines) {
        const { data: etapaVenta, error: etapaErr } = await supabase
          .from('ventas_etapas')
          .select('id')
          .eq('pipeline_id', entry.pipeline_id)
          .eq('tipo', 'venta')
          .eq('activo', true)
          .limit(1)
          .single()

        if (etapaErr) console.warn('Error buscando etapa venta:', etapaErr.message)

        if (etapaVenta) {
          const { error: moveOtherErr } = await supabase
            .from('ventas_lead_pipeline')
            .update({ etapa_id: etapaVenta.id, fecha_entrada: new Date().toISOString() })
            .eq('lead_id', leadId)
            .eq('pipeline_id', entry.pipeline_id)

          if (moveOtherErr) console.warn('Error moviendo lead en pipeline secundario:', moveOtherErr.message)
        }
      }
    }
  }, [])

  // ── Approve sale ───────────────────────────────────────────────────
  const aprobarVenta = useCallback(async (ventaId) => {
    if (!tienePermiso('ventas.ventas.aprobar')) throw new Error('No tienes permiso para aprobar ventas')
    const { error: err } = await supabase.rpc('ventas_aprobar_venta', { p_venta_id: ventaId })
    if (err) throw err
    logActividad('ventas', 'aprobar', 'Venta aprobada', { entidad: 'venta', entidad_id: ventaId })
    refrescar()
  }, [refrescar, tienePermiso])

  // ── Reject sale ────────────────────────────────────────────────────
  const rechazarVenta = useCallback(async (ventaId) => {
    if (!tienePermiso('ventas.ventas.rechazar')) throw new Error('No tienes permiso para rechazar ventas')
    const { error: err } = await supabase.rpc('ventas_rechazar_venta', { p_venta_id: ventaId })
    if (err) throw err
    logActividad('ventas', 'rechazar', 'Venta rechazada', { entidad: 'venta', entidad_id: ventaId })
    refrescar()
  }, [refrescar, tienePermiso])

  // ── Mark refund ────────────────────────────────────────────────────
  const marcarDevolucion = useCallback(async (ventaId) => {
    if (!tienePermiso('ventas.ventas.devolucion')) throw new Error('No tienes permiso para registrar devoluciones')
    const { error: err } = await supabase.rpc('ventas_marcar_devolucion', { p_venta_id: ventaId })
    if (err) throw err
    logActividad('ventas', 'devolucion', 'Devolución registrada', { entidad: 'venta', entidad_id: ventaId })
    refrescar()
  }, [refrescar, tienePermiso])

  // ── Revert rejection (rechazada → pendiente) ─────────────────────
  const revertirRechazo = useCallback(async (ventaId) => {
    if (!tienePermiso('ventas.ventas.revertir')) throw new Error('No tienes permiso para revertir ventas')
    const { data, error: err } = await supabase.rpc('ventas_revertir_rechazo', { p_venta_id: ventaId })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error)
    logActividad('ventas', 'editar', 'Rechazo revertido', { entidad: 'venta', entidad_id: ventaId })
    refrescar()
  }, [refrescar, tienePermiso])

  // ── Revert refund (devolución → aprobada) ─────────────────────────
  const revertirDevolucion = useCallback(async (ventaId) => {
    if (!tienePermiso('ventas.ventas.revertir')) throw new Error('No tienes permiso para revertir ventas')
    const { data, error: err } = await supabase.rpc('ventas_revertir_devolucion', { p_venta_id: ventaId })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error)
    logActividad('ventas', 'editar', 'Devolución revertida', { entidad: 'venta', entidad_id: ventaId })
    refrescar()
  }, [refrescar, tienePermiso])

  // ── General state change handler ──────────────────────────────────
  const cambiarEstado = useCallback(async (ventaId, nuevoEstado, venta) => {
    const estadoActual = venta.es_devolucion ? 'devolucion' : venta.estado
    const transicion = `${estadoActual}->${nuevoEstado}`

    switch (transicion) {
      case 'pendiente->aprobada': return aprobarVenta(ventaId)
      case 'pendiente->rechazada': return rechazarVenta(ventaId)
      case 'aprobada->rechazada': return rechazarVenta(ventaId)
      case 'aprobada->devolucion': return marcarDevolucion(ventaId)
      case 'rechazada->pendiente': return revertirRechazo(ventaId)
      case 'devolucion->aprobada': return revertirDevolucion(ventaId)
      default: throw new Error(`Transición no permitida: ${transicion}`)
    }
  }, [aprobarVenta, rechazarVenta, marcarDevolucion, revertirRechazo, revertirDevolucion])

  // ── Refresh on tab focus ───────────────────────────────────────────
  useRefreshOnFocus(refrescar, { enabled: !!user?.id })

  // ── Safety net: never stay in loading state for more than 15s ──────
  useEffect(() => {
    if (loading) {
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('[Ventas] Loading timeout — forcing loading=false')
        setLoading(false)
      }, 15000)
    } else {
      clearTimeout(loadingTimeoutRef.current)
    }
    return () => clearTimeout(loadingTimeoutRef.current)
  }, [loading])

  // ── Realtime: listen to ventas changes ─────────────────────────────
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`ventas-changes-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ventas_ventas',
      }, () => {
        clearTimeout(realtimeDebounceRef.current)
        realtimeDebounceRef.current = setTimeout(() => refrescarRef.current?.(), 500)
      })
      .subscribe()

    return () => {
      clearTimeout(realtimeDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // ── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id && rolesLoaded) {
      cargarVentas()
      cargarContadores()
    }
  }, [user?.id, rolesLoaded]) // eslint-disable-line react-hooks/exhaustive-deps -- only run on initial load when roles are ready

  // ── Reload on filter/page change ───────────────────────────────────
  useEffect(() => {
    if (!user?.id || !rolesLoaded) return
    if (busqueda.trim()) {
      buscarVentas(busqueda.trim())
    } else {
      cargarVentas()
    }
  }, [filtroEstado, paginaActual, filtros]) // eslint-disable-line react-hooks/exhaustive-deps -- buscarVentas/cargarVentas are stable via useCallback; guards check user/roles

  // ── Reload counters on filter change ───────────────────────────────
  useEffect(() => {
    if (!user?.id || !rolesLoaded) return
    if (!busqueda.trim()) {
      cargarContadores()
    }
  }, [filtroEstado, filtros]) // eslint-disable-line react-hooks/exhaustive-deps -- cargarContadores stable via useCallback; guards check user/roles

  // ── Debounced search ───────────────────────────────────────────────
  useEffect(() => {
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current)
    busquedaTimeoutRef.current = setTimeout(() => {
      if (!user?.id || !rolesLoaded) return
      setPaginaActual(0)
      if (busqueda.trim()) {
        buscarVentas(busqueda.trim())
      } else {
        setSearchResultCount(null)
        cargarVentas()
        cargarContadores()
      }
    }, 300)
    return () => clearTimeout(busquedaTimeoutRef.current)
  }, [busqueda]) // eslint-disable-line react-hooks/exhaustive-deps -- intentionally only re-run on search text change; 300ms debounce handles the rest

  return {
    ventas, paquetes, filtroEstado, busqueda, loading, error,
    paginaActual, totalVentas, contadores, searchResultCount,
    esAdmin, esAdminODirector, esCloser, esSetter, esDirector,

    setFiltroEstado: (estado) => { setPaginaActual(0); setFiltroEstado(estado); if (!busqueda.trim()) setSearchResultCount(null) },
    setBusqueda,
    setPaginaActual,
    setFiltros: (f) => { setPaginaActual(0); setFiltrosState(f); if (!busqueda.trim()) setSearchResultCount(null) },
    filtros, settersList, closersList,

    cargarVentas,
    cargarPaquetes,
    cargarContadores,
    cargarComisiones,

    registrarVenta,
    moverLeadAVenta,
    aprobarVenta,
    rechazarVenta,
    marcarDevolucion,
    revertirRechazo,
    revertirDevolucion,
    cambiarEstado,

    exportarCSV,
    exportando,

    refrescar,
    pageSize: PAGE_SIZE,
  }
  // PERF: useMemo on return object not needed — each page gets its own instance
  // (VentasVentas, VentasCRM), so no cross-consumer re-render cascade
}
