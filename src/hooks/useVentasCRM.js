import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { logActividad } from '../lib/logActividad'

const LEADS_PER_BATCH = 20
const TABLE_PAGE_SIZE = 50
const LOADING_TIMEOUT_MS = 15000

// Helper: map lead pipeline join data to flat lead objects
function mapLeadItems(data) {
  return (data || []).map(item => ({
    ...item.lead,
    pipeline_lead_id: item.id,
    etapa_id: item.etapa_id,
    pipeline_id: item.pipeline_id,
    contador_intentos: item.contador_intentos,
    fecha_entrada: item.fecha_entrada,
  }))
}

export function useVentasCRM() {
  const { user, usuario, tienePermiso } = useAuth()

  const [pipelines, setPipelines] = useState([])
  const [pipelineActivo, setPipelineActivoState] = useState(null)
  const [etapas, setEtapas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [etiquetas, setEtiquetas] = useState([])
  const [rolesComerciales, setRolesComerciales] = useState([])
  const [setters, setSetters] = useState([])
  const [closers, setClosers] = useState([])

  const [leads, setLeads] = useState({})
  const [leadCounts, setLeadCounts] = useState({})
  const [totalLeads, setTotalLeads] = useState(0)
  const [leadsTabla, setLeadsTabla] = useState([])
  const [tablaTotalCount, setTablaTotalCount] = useState(0)
  const [tablaPage, setTablaPage] = useState(0)
  const [tablaSort, setTablaSort] = useState({ col: 'created_at', dir: 'desc' })

  const [vista, setVista] = useState('kanban')
  const [filtros, setFiltros] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState({})
  const [error, setError] = useState(null)

  const loadRequestRef = useRef(0)
  const hasMoreRef = useRef({})
  const loadingMoreRef = useRef({})
  const leadsOffsetRef = useRef({})
  const busquedaTimeoutRef = useRef(null)
  const searchRequestRef = useRef(0)
  const realtimeDebounceRef = useRef(null)
  const [searchResultCount, setSearchResultCount] = useState(null)

  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esCloser = misRoles.some(r => r.rol === 'closer')
  const esDirector = misRoles.some(r => r.rol === 'director_ventas')
  const esAdminODirector = tienePermiso('ventas.crm.ver_todos')

  // ── Build query (explicit pipeline params — no stale closures) ────────
  const buildLeadQuery = useCallback((pipelineId, pipelineNombre, etapaId = null) => {
    let query = supabase
      .from('ventas_lead_pipeline')
      .select(`
        id,
        lead_id,
        pipeline_id,
        etapa_id,
        contador_intentos,
        fecha_entrada,
        lead:ventas_leads!inner(
          id, nombre, email, telefono, nombre_negocio, fuente, valor, notas,
          resumen_setter, resumen_closer, enlace_grabacion, creado_por,
          created_at, updated_at, tags, contactos_adicionales, fuente_detalle,
          categoria:ventas_categorias(id, nombre),
          setter:usuarios!ventas_leads_setter_asignado_id_fkey(id, nombre, email),
          closer:usuarios!ventas_leads_closer_asignado_id_fkey(id, nombre, email),
          lead_etiquetas:ventas_lead_etiquetas(etiqueta_id, etiqueta:ventas_etiquetas(id, nombre, color))
        )
      `, { count: 'exact' })
      .eq('pipeline_id', pipelineId)

    if (etapaId) {
      query = query.eq('etapa_id', etapaId)
    }

    // Role-based filtering
    if (!esAdminODirector) {
      const nombre = (pipelineNombre || '').toLowerCase()
      if (nombre.includes('setter') && esSetter) {
        query = query.eq('lead.setter_asignado_id', user.id)
      } else if (nombre.includes('closer') && esCloser) {
        query = query.eq('lead.closer_asignado_id', user.id)
      } else {
        // User has no matching role for this pipeline — return no results
        query = query.eq('lead_id', '00000000-0000-0000-0000-000000000000')
      }
    }

    // Filters
    if (filtros.setter_id) {
      query = query.eq('lead.setter_asignado_id', filtros.setter_id)
    }
    if (filtros.closer_id) {
      query = query.eq('lead.closer_asignado_id', filtros.closer_id)
    }
    if (filtros.categoria_id) {
      query = query.eq('lead.categoria_id', filtros.categoria_id)
    }
    if (filtros.fuente) {
      query = query.eq('lead.fuente', filtros.fuente)
    }
    if (filtros.fecha_desde) {
      query = query.gte('lead.created_at', filtros.fecha_desde)
    }
    if (filtros.fecha_hasta) {
      query = query.lte('lead.created_at', filtros.fecha_hasta + 'T23:59:59')
    }
    if (filtros.etapa_ids && filtros.etapa_ids.length > 0) {
      query = query.in('etapa_id', filtros.etapa_ids)
    }

    // Search — escape special PostgREST filter chars to prevent query injection
    if (busqueda.trim()) {
      const sanitized = busqueda.trim().replace(/[%_\\,()]/g, '')
      if (sanitized) {
        query = query.or(`nombre.ilike.%${sanitized}%,telefono.ilike.%${sanitized}%`, { foreignTable: 'ventas_leads' })
      }
    }

    return query
  }, [esAdminODirector, esSetter, esCloser, user?.id, filtros, busqueda])

  // ── Core: load etapas + leads for a pipeline (sequential, no useEffect chain) ──
  const cargarPipelineCompleto = useCallback(async (pipeline, vistaActual) => {
    if (!pipeline) return

    const requestId = ++loadRequestRef.current
    setLoading(true)
    setError(null)

    try {
      // Step 1: Load etapas
      const { data: etapasData, error: etapasErr } = await supabase
        .from('ventas_etapas')
        .select('*')
        .eq('pipeline_id', pipeline.id)
        .eq('activo', true)
        .order('orden')

      if (etapasErr) throw etapasErr
      if (requestId !== loadRequestRef.current) return

      setEtapas(etapasData || [])

      if ((etapasData || []).length === 0) return

      // Step 2: Load leads using the etapas we just fetched (no stale state)
      if (vistaActual === 'kanban') {
        const newLeads = {}
        const newCounts = {}
        let total = 0

        await Promise.all((etapasData || []).map(async (etapa) => {
          const query = buildLeadQuery(pipeline.id, pipeline.nombre, etapa.id)
            .order('fecha_entrada', { ascending: false })
            .range(0, LEADS_PER_BATCH - 1)

          const { data, count, error: err } = await query
          if (err) throw err

          newLeads[etapa.id] = mapLeadItems(data)
          newCounts[etapa.id] = count || 0
          total += count || 0
          hasMoreRef.current[etapa.id] = (count || 0) > LEADS_PER_BATCH
          leadsOffsetRef.current[etapa.id] = (data || []).length
        }))

        if (requestId !== loadRequestRef.current) return
        setLeads(newLeads)
        setLeadCounts(newCounts)
        setTotalLeads(total)
      } else {
        const query = buildLeadQuery(pipeline.id, pipeline.nombre)
          .order('fecha_entrada', { ascending: false })
          .range(0, TABLE_PAGE_SIZE - 1)

        const { data, count, error: err } = await query
        if (err) throw err
        if (requestId !== loadRequestRef.current) return

        setLeadsTabla((data || []).map(item => ({
          ...item.lead,
          pipeline_lead_id: item.id,
          etapa_id: item.etapa_id,
          pipeline_id: item.pipeline_id,
          contador_intentos: item.contador_intentos,
          fecha_entrada: item.fecha_entrada,
          etapa: (etapasData || []).find(e => e.id === item.etapa_id),
        })))
        setTablaTotalCount(count || 0)
        setTotalLeads(count || 0)
      }
    } catch (err) {
      if (requestId === loadRequestRef.current) {
        setError(err.message || 'Error al cargar pipeline')
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [buildLeadQuery])

  // ── Load initial data + default pipeline ──────────────────────────────
  const cargarDatosIniciales = useCallback(async () => {
    const requestId = ++loadRequestRef.current

    try {
      setLoading(true)
      setError(null)

      const results = await Promise.all([
        supabase.from('ventas_pipelines').select('*').eq('activo', true).order('orden'),
        supabase.from('ventas_categorias').select('*').eq('activo', true).order('orden'),
        supabase.from('ventas_etiquetas').select('*').eq('activo', true),
        supabase.from('ventas_roles_comerciales').select('*, usuario:usuarios(id, nombre, email)').eq('activo', true),
      ])

      // Check for critical errors (pipelines must load)
      if (results[0].error) throw new Error('Error cargando pipelines: ' + results[0].error.message)

      const pipelinesData = results[0].data
      const categoriasData = results[1].data
      const etiquetasData = results[2].data
      const rolesData = results[3].data

      // Procesar citas pasadas → mover leads a "Cita Realizada" (fire-and-forget)
      try { await supabase.rpc('ventas_procesar_citas_pasadas') } catch { /* non-critical */ }

      if (requestId !== loadRequestRef.current) return

      setPipelines(pipelinesData || [])
      setCategorias(categoriasData || [])
      setEtiquetas(etiquetasData || [])
      setRolesComerciales(rolesData || [])

      const settersList = (rolesData || []).filter(r => r.rol === 'setter' && r.activo)
      const closersList = (rolesData || []).filter(r => r.rol === 'closer' && r.activo)
      setSetters(settersList)
      setClosers(closersList)

      const userRoles = (rolesData || []).filter(r => r.usuario_id === user?.id && r.activo)
      const userEsSetter = userRoles.some(r => r.rol === 'setter')
      const userEsCloser = userRoles.some(r => r.rol === 'closer')

      let defaultPipeline = null
      if (pipelinesData && pipelinesData.length > 0) {
        if (tienePermiso('ventas.crm.ver_todos')) {
          defaultPipeline = pipelinesData[0]
        } else if (userEsSetter && !userEsCloser) {
          defaultPipeline = pipelinesData.find(p => p.nombre.toLowerCase().includes('setter')) || pipelinesData[0]
        } else if (userEsCloser && !userEsSetter) {
          defaultPipeline = pipelinesData.find(p => p.nombre.toLowerCase().includes('closer')) || pipelinesData[0]
        } else {
          defaultPipeline = pipelinesData[0]
        }
      }

      if (!defaultPipeline) {
        // No pipelines — nothing more to load
        return
      }

      setPipelineActivoState(defaultPipeline)

      // Load etapas + leads in sequence (same requestId — single flow)
      const { data: etapasData, error: etapasErr } = await supabase
        .from('ventas_etapas')
        .select('*')
        .eq('pipeline_id', defaultPipeline.id)
        .eq('activo', true)
        .order('orden')

      if (etapasErr) throw etapasErr
      if (requestId !== loadRequestRef.current) return

      setEtapas(etapasData || [])

      if ((etapasData || []).length === 0) return

      // Load kanban leads (initial view is always kanban)
      const newLeads = {}
      const newCounts = {}
      let total = 0

      await Promise.all((etapasData || []).map(async (etapa) => {
        const query = buildLeadQuery(defaultPipeline.id, defaultPipeline.nombre, etapa.id)
          .order('fecha_entrada', { ascending: false })
          .range(0, LEADS_PER_BATCH - 1)

        const { data, count, error: err } = await query
        if (err) throw err

        newLeads[etapa.id] = mapLeadItems(data)
        newCounts[etapa.id] = count || 0
        total += count || 0
        hasMoreRef.current[etapa.id] = (count || 0) > LEADS_PER_BATCH
        leadsOffsetRef.current[etapa.id] = (data || []).length
      }))

      if (requestId !== loadRequestRef.current) return
      setLeads(newLeads)
      setLeadCounts(newCounts)
      setTotalLeads(total)
    } catch (err) {
      console.error('CRM cargarDatosIniciales error:', err)
      if (requestId === loadRequestRef.current) {
        setError('Error al cargar datos iniciales')
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [user?.id, usuario?.tipo, buildLeadQuery])

  // ── Load leads for Kanban (used by refrescar, filter/search changes) ──
  const cargarLeads = useCallback(async () => {
    if (!pipelineActivo || etapas.length === 0) return

    const requestId = ++loadRequestRef.current

    try {
      setLoading(true)
      setError(null)
      const newLeads = {}
      const newCounts = {}
      let total = 0

      await Promise.all(etapas.map(async (etapa) => {
        const query = buildLeadQuery(pipelineActivo.id, pipelineActivo.nombre, etapa.id)
          .order('fecha_entrada', { ascending: false })
          .range(0, LEADS_PER_BATCH - 1)

        const { data, count, error: err } = await query
        if (err) throw err

        newLeads[etapa.id] = mapLeadItems(data)
        newCounts[etapa.id] = count || 0
        total += count || 0
        hasMoreRef.current[etapa.id] = (count || 0) > LEADS_PER_BATCH
        leadsOffsetRef.current[etapa.id] = (data || []).length
      }))

      if (requestId !== loadRequestRef.current) return
      setLeads(newLeads)
      setLeadCounts(newCounts)
      setTotalLeads(total)
    } catch (err) {
      if (requestId === loadRequestRef.current) {
        setError('Error al cargar leads')
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [pipelineActivo, etapas, buildLeadQuery])

  // ── Load more leads for a column ───────────────────────────────────
  const cargarMasLeads = useCallback(async (etapaId) => {
    if (!hasMoreRef.current[etapaId] || loadingMoreRef.current[etapaId]) return

    loadingMoreRef.current[etapaId] = true
    setLoadingMore(prev => ({ ...prev, [etapaId]: true }))
    try {
      const offset = leadsOffsetRef.current[etapaId] || LEADS_PER_BATCH
      const query = buildLeadQuery(pipelineActivo.id, pipelineActivo.nombre, etapaId)
        .order('fecha_entrada', { ascending: false })
        .range(offset, offset + LEADS_PER_BATCH - 1)

      const { data, error: err } = await query
      if (err) throw err

      const mapped = mapLeadItems(data)

      setLeads(prev => ({
        ...prev,
        [etapaId]: [...(prev[etapaId] || []), ...mapped],
      }))

      leadsOffsetRef.current[etapaId] = offset + mapped.length

      if (mapped.length < LEADS_PER_BATCH) {
        hasMoreRef.current[etapaId] = false
      }
    } catch {
      setError('Error al cargar más leads. Inténtalo de nuevo.')
    } finally {
      loadingMoreRef.current[etapaId] = false
      setLoadingMore(prev => ({ ...prev, [etapaId]: false }))
    }
  }, [buildLeadQuery, pipelineActivo])

  // ── Load leads for Table view ──────────────────────────────────────
  const cargarLeadsTabla = useCallback(async () => {
    if (!pipelineActivo) return

    const requestId = ++loadRequestRef.current

    try {
      setLoading(true)
      // Map table column keys to actual sortable fields
      const sortCol = tablaSort.col
      const ascending = tablaSort.dir === 'asc'
      let query = buildLeadQuery(pipelineActivo.id, pipelineActivo.nombre)

      // Lead-level fields need foreignTable option; pipeline-level fields sort directly
      const leadFields = ['nombre', 'telefono', 'email', 'fuente', 'created_at']
      if (leadFields.includes(sortCol)) {
        query = query.order(sortCol, { ascending, foreignTable: 'ventas_leads' })
      } else {
        query = query.order('fecha_entrada', { ascending })
      }

      query = query.range(tablaPage * TABLE_PAGE_SIZE, (tablaPage + 1) * TABLE_PAGE_SIZE - 1)

      const { data, count, error: err } = await query
      if (err) throw err
      if (requestId !== loadRequestRef.current) return

      const mapped = (data || []).map(item => ({
        ...item.lead,
        pipeline_lead_id: item.id,
        etapa_id: item.etapa_id,
        pipeline_id: item.pipeline_id,
        contador_intentos: item.contador_intentos,
        fecha_entrada: item.fecha_entrada,
        etapa: etapas.find(e => e.id === item.etapa_id),
      }))

      setLeadsTabla(mapped)
      setTablaTotalCount(count || 0)
      setTotalLeads(count || 0)
    } catch {
      if (requestId === loadRequestRef.current) {
        setError('Error al cargar leads')
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [pipelineActivo, buildLeadQuery, tablaPage, tablaSort, etapas])

  // ── RPC-powered search across all fields ───────────────────────────
  const buscarLeads = useCallback(async (query) => {
    if (!pipelineActivo || etapas.length === 0) return

    const requestId = ++searchRequestRef.current
    setLoading(true)
    setError(null)

    try {
      const effectiveRole = esAdminODirector ? 'super_admin' : ''

      const { data: results, error: rpcErr } = await supabase.rpc('ventas_buscar_leads', {
        p_query: query.trim(),
        p_pipeline_id: pipelineActivo.id,
        p_user_id: user?.id,
        p_user_role: effectiveRole,
        p_limit: 100,
        p_offset: 0,
      })

      if (rpcErr) throw rpcErr
      if (requestId !== searchRequestRef.current) return

      // No results
      if (!results || results.length === 0) {
        if (vista === 'kanban') {
          const emptyLeads = {}
          const emptyCounts = {}
          etapas.forEach(e => { emptyLeads[e.id] = []; emptyCounts[e.id] = 0 })
          setLeads(emptyLeads)
          setLeadCounts(emptyCounts)
          setTotalLeads(0)
        } else {
          setLeadsTabla([])
          setTablaTotalCount(0)
        }
        setSearchResultCount(0)
        return
      }

      const leadIds = results.map(r => r.lead_id)
      const relevanciaMap = Object.fromEntries(results.map(r => [r.lead_id, r.relevancia]))

      // Load full lead data for matched IDs
      let dataQuery = supabase
        .from('ventas_lead_pipeline')
        .select(`
          id,
          lead_id,
          pipeline_id,
          etapa_id,
          contador_intentos,
          fecha_entrada,
          lead:ventas_leads!inner(
            id, nombre, email, telefono, nombre_negocio, fuente, valor, notas,
            resumen_setter, resumen_closer, enlace_grabacion, creado_por,
            created_at, updated_at, tags, contactos_adicionales, fuente_detalle,
            categoria:ventas_categorias(id, nombre),
            setter:usuarios!ventas_leads_setter_asignado_id_fkey(id, nombre, email),
            closer:usuarios!ventas_leads_closer_asignado_id_fkey(id, nombre, email),
            lead_etiquetas:ventas_lead_etiquetas(etiqueta_id, etiqueta:ventas_etiquetas(id, nombre, color))
          )
        `)
        .eq('pipeline_id', pipelineActivo.id)
        .in('lead_id', leadIds)

      // Apply active filters on top of search results
      if (filtros.setter_id) dataQuery = dataQuery.eq('lead.setter_asignado_id', filtros.setter_id)
      if (filtros.closer_id) dataQuery = dataQuery.eq('lead.closer_asignado_id', filtros.closer_id)
      if (filtros.categoria_id) dataQuery = dataQuery.eq('lead.categoria_id', filtros.categoria_id)
      if (filtros.fuente) dataQuery = dataQuery.eq('lead.fuente', filtros.fuente)
      if (filtros.fecha_desde) dataQuery = dataQuery.gte('lead.created_at', filtros.fecha_desde)
      if (filtros.fecha_hasta) dataQuery = dataQuery.lte('lead.created_at', filtros.fecha_hasta + 'T23:59:59')
      if (filtros.etapa_ids && filtros.etapa_ids.length > 0) dataQuery = dataQuery.in('etapa_id', filtros.etapa_ids)

      const { data: pipelineData, error: pipeErr } = await dataQuery
      if (pipeErr) throw pipeErr
      if (requestId !== searchRequestRef.current) return

      // Map results with relevance
      const mapped = (pipelineData || []).map(item => ({
        ...item.lead,
        pipeline_lead_id: item.id,
        etapa_id: item.etapa_id,
        pipeline_id: item.pipeline_id,
        contador_intentos: item.contador_intentos,
        fecha_entrada: item.fecha_entrada,
        _relevancia: relevanciaMap[item.lead_id] || 0,
      }))

      // Sort by relevance
      mapped.sort((a, b) => (b._relevancia || 0) - (a._relevancia || 0))

      if (vista === 'kanban') {
        const newLeads = {}
        const newCounts = {}
        let total = 0

        etapas.forEach(e => { newLeads[e.id] = []; newCounts[e.id] = 0 })

        mapped.forEach(lead => {
          if (newLeads[lead.etapa_id]) {
            newLeads[lead.etapa_id].push(lead)
            newCounts[lead.etapa_id]++
            total++
          }
        })

        setLeads(newLeads)
        setLeadCounts(newCounts)
        setTotalLeads(total)
        // Disable "load more" during search
        Object.keys(hasMoreRef.current).forEach(k => { hasMoreRef.current[k] = false })
      } else {
        setLeadsTabla(mapped.map(lead => ({
          ...lead,
          etapa: etapas.find(e => e.id === lead.etapa_id),
        })))
        setTablaTotalCount(mapped.length)
      }

      setSearchResultCount(mapped.length)
    } catch (err) {
      if (requestId !== searchRequestRef.current) return
      // Fallback: use the old simple search (buildLeadQuery with ilike)
      // Delegate loading state entirely to the fallback function
      console.warn('RPC ventas_buscar_leads no disponible, usando búsqueda simple:', err.message)
      setSearchResultCount(null)
      if (vista === 'kanban') {
        await cargarLeads()
      } else {
        await cargarLeadsTabla()
      }
      return // Skip finally's setLoading — fallback manages its own loading state
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoading(false)
      }
    }
  }, [pipelineActivo, etapas, esAdminODirector, user?.id, vista, filtros, cargarLeads, cargarLeadsTabla])

  // ── Reload ─────────────────────────────────────────────────────────
  const refrescar = useCallback(() => {
    if (vista === 'kanban') {
      cargarLeads()
    } else {
      cargarLeadsTabla()
    }
  }, [vista, cargarLeads, cargarLeadsTabla])

  // ── Venta popup state ──────────────────────────────────────────────
  const [leadParaVenta, setLeadParaVenta] = useState(null)
  const [etapaVentaDestino, setEtapaVentaDestino] = useState(null)

  // ── Cita popup state (interceptar drag a Agendado) ────────────────
  const [leadParaCita, setLeadParaCita] = useState(null)
  const [etapaCitaDestino, setEtapaCitaDestino] = useState(null)

  // ── Move lead (drag & drop) ────────────────────────────────────────
  const movingLeadsRef = useRef(new Set())
  const moverLead = useCallback(async (leadId, etapaOrigenId, etapaDestinoId, dropIndex = 0) => {
    if (etapaOrigenId === etapaDestinoId) return
    if (movingLeadsRef.current.has(leadId)) return
    if (!tienePermiso('ventas.crm.mover_leads')) throw new Error('No tienes permiso para mover leads')

    const etapaDestino = etapas.find(e => e.id === etapaDestinoId)
    const etapaOrigen = etapas.find(e => e.id === etapaOrigenId)
    if (!etapaDestino) return

    // Find lead
    const leadData = leads[etapaOrigenId]?.find(l => l.id === leadId)
    if (!leadData) return

    // Intercept venta stage — open popup instead of moving
    if (etapaDestino.tipo === 'venta') {
      if (!tienePermiso('ventas.ventas.crear')) throw new Error('No tienes permiso para registrar ventas')
      setLeadParaVenta(leadData)
      setEtapaVentaDestino(etapaDestinoId)
      return
    }

    // Intercept agendado/cita stages — require scheduling a meeting
    const nombreLower = etapaDestino.nombre.toLowerCase()
    if (nombreLower.includes('agendad') || nombreLower.includes('llamada agendada')) {
      setLeadParaCita(leadData)
      setEtapaCitaDestino(etapaDestinoId)
      return
    }

    movingLeadsRef.current.add(leadId)

    // Optimistic update
    const nuevoContadorOptimistic = (etapaDestino.tipo === 'ghosting' || etapaDestino.tipo === 'seguimiento')
      ? (leadData.contador_intentos || 0) + 1
      : 0

    setLeads(prev => {
      const newLeads = { ...prev }
      newLeads[etapaOrigenId] = (prev[etapaOrigenId] || []).filter(l => l.id !== leadId)
      const movedLead = { ...leadData, etapa_id: etapaDestinoId, contador_intentos: nuevoContadorOptimistic }
      const destLeads = [...(prev[etapaDestinoId] || [])]
      const idx = Math.min(dropIndex, destLeads.length)
      destLeads.splice(idx, 0, movedLead)
      newLeads[etapaDestinoId] = destLeads
      return newLeads
    })

    setLeadCounts(prev => ({
      ...prev,
      [etapaOrigenId]: Math.max(0, (prev[etapaOrigenId] || 0) - 1),
      [etapaDestinoId]: (prev[etapaDestinoId] || 0) + 1,
    }))

    try {
      // Calculate new counter
      let nuevoContador = 0
      if (etapaDestino.tipo === 'ghosting' || etapaDestino.tipo === 'seguimiento') {
        nuevoContador = (leadData.contador_intentos || 0) + 1
      }

      // Check if max attempts reached for ghosting
      if (etapaDestino.tipo === 'ghosting' && etapaDestino.max_intentos && nuevoContador >= etapaDestino.max_intentos) {
        // Move to Lost instead
        const etapaLost = etapas.find(e => e.tipo === 'lost')
        if (etapaLost) {
          const { error: err } = await supabase
            .from('ventas_lead_pipeline')
            .update({
              etapa_id: etapaLost.id,
              contador_intentos: nuevoContador,
              fecha_entrada: new Date().toISOString(),
            })
            .eq('lead_id', leadId)
            .eq('pipeline_id', pipelineActivo.id)

          if (err) throw err

          // Fix optimistic state
          setLeads(prev => {
            const newLeads = { ...prev }
            newLeads[etapaDestinoId] = (prev[etapaDestinoId] || []).filter(l => l.id !== leadId)
            const movedLead = { ...leadData, etapa_id: etapaLost.id, contador_intentos: nuevoContador }
            newLeads[etapaLost.id] = [movedLead, ...(prev[etapaLost.id] || [])]
            return newLeads
          })
          setLeadCounts(prev => ({
            ...prev,
            [etapaDestinoId]: Math.max(0, (prev[etapaDestinoId] || 0) - 1),
            [etapaLost.id]: (prev[etapaLost.id] || 0) + 1,
          }))

          // Log actividad (no-crítico)
          const { error: actErr } = await supabase.from('ventas_actividad').insert({
            lead_id: leadId, usuario_id: user.id, tipo: 'cambio_etapa',
            descripcion: `${etapaOrigen?.nombre || '?'} → ${etapaLost.nombre} (max intentos)`,
            datos: { etapa_anterior_id: etapaOrigenId, etapa_nueva_id: etapaLost.id, via: 'drag_drop' },
          })
          if (actErr) console.error('Error registrando actividad drag&drop:', actErr)

          logActividad('crm', 'cambio_etapa', `${etapaOrigen?.nombre || '?'} → ${etapaLost.nombre} (max intentos)`, { entidad: 'lead', entidad_id: leadId })

          return
        }
      }

      const { error: err } = await supabase
        .from('ventas_lead_pipeline')
        .update({
          etapa_id: etapaDestinoId,
          contador_intentos: nuevoContador,
          fecha_entrada: new Date().toISOString(),
        })
        .eq('lead_id', leadId)
        .eq('pipeline_id', pipelineActivo.id)

      if (err) throw err

      // Log actividad (no-crítico)
      const { error: actErr } = await supabase.from('ventas_actividad').insert({
        lead_id: leadId, usuario_id: user.id, tipo: 'cambio_etapa',
        descripcion: `${etapaOrigen?.nombre || '?'} → ${etapaDestino.nombre}`,
        datos: { etapa_anterior_id: etapaOrigenId, etapa_nueva_id: etapaDestinoId, via: 'drag_drop' },
      })
      if (actErr) console.error('Error registrando actividad drag&drop:', actErr)

      logActividad('crm', 'cambio_etapa', `${etapaOrigen?.nombre || '?'} → ${etapaDestino.nombre}`, { entidad: 'lead', entidad_id: leadId })
    } catch {
      // Revert optimistic update
      setLeads(prev => {
        const newLeads = { ...prev }
        newLeads[etapaDestinoId] = (prev[etapaDestinoId] || []).filter(l => l.id !== leadId)
        newLeads[etapaOrigenId] = [leadData, ...(prev[etapaOrigenId] || [])]
        return newLeads
      })
      setLeadCounts(prev => ({
        ...prev,
        [etapaOrigenId]: (prev[etapaOrigenId] || 0) + 1,
        [etapaDestinoId]: Math.max(0, (prev[etapaDestinoId] || 0) - 1),
      }))
      throw new Error('Error al mover el lead')
    } finally {
      movingLeadsRef.current.delete(leadId)
    }
  }, [leads, etapas, pipelineActivo, user?.id])

  // ── Force move lead (after venta popup confirms) ───────────────────
  const moverLeadForzado = useCallback(async (leadId, pipelineId, etapaDestinoId) => {
    if (!tienePermiso('ventas.crm.mover_leads')) throw new Error('No tienes permiso para mover leads')
    const { error: err } = await supabase
      .from('ventas_lead_pipeline')
      .update({
        etapa_id: etapaDestinoId,
        contador_intentos: 0,
        fecha_entrada: new Date().toISOString(),
      })
      .eq('lead_id', leadId)
      .eq('pipeline_id', pipelineId)

    if (err) throw err
  }, [])

  // ── Create lead ────────────────────────────────────────────────────
  const crearLead = useCallback(async (datos) => {
    if (!tienePermiso('ventas.crm.crear_leads')) throw new Error('No tienes permiso para crear leads')
    const primeraEtapa = etapas.find(e => e.orden === Math.min(...etapas.map(et => et.orden)))
    if (!primeraEtapa) throw new Error('No hay etapas en el pipeline')

    const { data: lead, error: err } = await supabase
      .from('ventas_leads')
      .insert({
        nombre: datos.nombre,
        telefono: datos.telefono || null,
        email: datos.email || null,
        nombre_negocio: datos.nombre_negocio || null,
        categoria_id: datos.categoria_id || null,
        fuente: datos.fuente || null,
        notas: datos.notas || null,
        creado_por: 'manual',
      })
      .select()
      .single()

    if (err) throw err

    // Create pipeline entry
    const { error: pErr } = await supabase
      .from('ventas_lead_pipeline')
      .insert({
        lead_id: lead.id,
        pipeline_id: pipelineActivo.id,
        etapa_id: primeraEtapa.id,
      })

    if (pErr) {
      // Rollback: eliminar el lead que acabamos de crear para evitar huérfano
      await supabase.from('ventas_leads').delete().eq('id', lead.id)
      throw new Error('Error al asignar pipeline. Lead no fue creado.')
    }

    // Auto-assign setter (no-crítico)
    try {
      const { error: rpcErr } = await supabase.rpc('ventas_asignar_lead_automatico', { p_lead_id: lead.id })
      if (rpcErr) console.error('Auto-asignación de setter falló:', rpcErr)
    } catch (rpcEx) {
      console.error('Auto-asignación de setter falló:', rpcEx)
    }

    // Log activity
    await supabase.from('ventas_actividad').insert({
      lead_id: lead.id,
      usuario_id: user.id,
      tipo: 'creacion',
      descripcion: 'Lead creado manualmente',
      datos: {},
    })

    logActividad('crm', 'crear', 'Lead creado: ' + datos.nombre, { entidad: 'lead', entidad_id: lead.id })

    // Refetch leads to show the new lead
    refrescar()

    return lead
  }, [etapas, pipelineActivo, user?.id, refrescar])

  // ── Update lead fields ─────────────────────────────────────────────
  const actualizarLead = useCallback(async (leadId, campos) => {
    const { error: err } = await supabase
      .from('ventas_leads')
      .update(campos)
      .eq('id', leadId)

    if (err) throw err
    refrescar()
  }, [refrescar])

  // ── Delete lead (super_admin only via RPC) ─────────────────────────
  const eliminarLead = useCallback(async (leadId) => {
    const { data, error: err } = await supabase.rpc('ventas_eliminar_lead', { p_lead_id: leadId })

    if (err) throw err
    if (data && !data.ok) throw new Error(data.error || 'No se pudo eliminar el lead')

    logActividad('crm', 'eliminar', 'Lead eliminado', { entidad: 'lead', entidad_id: leadId })

    refrescar()
  }, [refrescar])

  // ── Load lead detail ───────────────────────────────────────────────
  const cargarLeadDetalle = useCallback(async (leadId) => {
    const [
      { data: lead, error: leadErr },
      { data: pipelineStates },
      { data: citas },
      { data: leadEtiquetas },
    ] = await Promise.all([
      supabase
        .from('ventas_leads')
        .select(`
          *,
          categoria:ventas_categorias(id, nombre),
          setter:usuarios!ventas_leads_setter_asignado_id_fkey(id, nombre, email),
          closer:usuarios!ventas_leads_closer_asignado_id_fkey(id, nombre, email)
        `)
        .eq('id', leadId)
        .single(),
      supabase
        .from('ventas_lead_pipeline')
        .select(`
          *,
          pipeline:ventas_pipelines(id, nombre),
          etapa:ventas_etapas(id, nombre, color, tipo)
        `)
        .eq('lead_id', leadId),
      supabase
        .from('ventas_citas')
        .select(`
          *,
          closer:usuarios!ventas_citas_closer_id_fkey(id, nombre),
          estado_reunion:ventas_reunion_estados(id, nombre, color)
        `)
        .eq('lead_id', leadId)
        .order('fecha_hora', { ascending: false }),
      supabase
        .from('ventas_lead_etiquetas')
        .select('*, etiqueta:ventas_etiquetas(*)')
        .eq('lead_id', leadId),
    ])

    if (leadErr) throw leadErr

    return {
      ...lead,
      pipeline_states: pipelineStates || [],
      citas: citas || [],
      lead_etiquetas: (leadEtiquetas || []).map(le => le.etiqueta),
    }
  }, [])

  // ── Load activity ──────────────────────────────────────────────────
  const cargarActividad = useCallback(async (leadId, offset = 0, limit = 20) => {
    const { data, error: err } = await supabase
      .from('ventas_actividad')
      .select('*, usuario:usuarios(id, nombre)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (err) throw err
    return data || []
  }, [])

  // ── Change assigned setter/closer ──────────────────────────────────
  const cambiarSetterAsignado = useCallback(async (leadId, setterId) => {
    const { error: updateErr } = await supabase.from('ventas_leads').update({ setter_asignado_id: setterId }).eq('id', leadId)
    if (updateErr) throw updateErr

    // Get lead name for notification
    const leadData = Object.values(leads).flat().find(l => l.id === leadId)
    const leadNombre = leadData?.nombre || 'Lead'

    const { error: actErr } = await supabase.from('ventas_actividad').insert({
      lead_id: leadId,
      usuario_id: user.id,
      tipo: 'asignacion',
      descripcion: 'Setter reasignado',
      datos: { setter_id: setterId },
    })
    if (actErr) console.error('Error registrando actividad setter:', actErr)

    // Notify assigned setter
    if (setterId && setterId !== user.id) {
      try {
        await supabase.from('ventas_notificaciones').insert({
          usuario_id: setterId,
          tipo: 'asignacion',
          titulo: 'Lead asignado',
          mensaje: `Se te ha asignado el lead "${leadNombre}"`,
          datos: { lead_id: leadId },
        })
      } catch { /* non-critical */ }
    }

    logActividad('crm', 'asignar', 'Setter reasignado', { entidad: 'lead', entidad_id: leadId })

    refrescar()
  }, [user?.id, leads, refrescar])

  const cambiarCloserAsignado = useCallback(async (leadId, closerId) => {
    const { error: updateErr } = await supabase.from('ventas_leads').update({ closer_asignado_id: closerId }).eq('id', leadId)
    if (updateErr) throw updateErr

    // Get lead name for notification
    const leadData = Object.values(leads).flat().find(l => l.id === leadId)
    const leadNombre = leadData?.nombre || 'Lead'

    const { error: actErr } = await supabase.from('ventas_actividad').insert({
      lead_id: leadId,
      usuario_id: user.id,
      tipo: 'asignacion',
      descripcion: 'Closer reasignado',
      datos: { closer_id: closerId },
    })
    if (actErr) console.error('Error registrando actividad closer:', actErr)

    // Notify assigned closer
    if (closerId && closerId !== user.id) {
      try {
        await supabase.from('ventas_notificaciones').insert({
          usuario_id: closerId,
          tipo: 'asignacion',
          titulo: 'Lead asignado',
          mensaje: `Se te ha asignado el lead "${leadNombre}" como closer`,
          datos: { lead_id: leadId },
        })
      } catch { /* non-critical */ }
    }

    logActividad('crm', 'asignar', 'Closer reasignado', { entidad: 'lead', entidad_id: leadId })

    refrescar()
  }, [user?.id, leads, refrescar])

  // ── Tags ───────────────────────────────────────────────────────────
  const añadirEtiqueta = useCallback(async (leadId, etiquetaId) => {
    const { error: err } = await supabase
      .from('ventas_lead_etiquetas')
      .insert({ lead_id: leadId, etiqueta_id: etiquetaId })
    if (err && err.code !== '23505') throw err

    logActividad('crm', 'editar', 'Etiqueta añadida', { entidad: 'lead', entidad_id: leadId })
  }, [])

  const quitarEtiqueta = useCallback(async (leadId, etiquetaId) => {
    const { error } = await supabase
      .from('ventas_lead_etiquetas')
      .delete()
      .eq('lead_id', leadId)
      .eq('etiqueta_id', etiquetaId)
    if (error) throw error

    logActividad('crm', 'editar', 'Etiqueta eliminada', { entidad: 'lead', entidad_id: leadId })
  }, [])

  // ── Unique sources for filters ─────────────────────────────────────
  const [fuentes, setFuentes] = useState([])
  useEffect(() => {
    const cargar = async () => {
      try {
        const { data } = await supabase
          .from('ventas_leads')
          .select('fuente')
          .not('fuente', 'is', null)
          .limit(200)
        const unique = [...new Set((data || []).map(d => d.fuente).filter(Boolean))]
        setFuentes(unique)
      } catch (err) {
        console.error('[CRM] Error loading fuentes:', err)
      }
    }
    cargar()
  }, [])

  // ── Set pipeline (direct orchestration — no useEffect chain) ───────
  const setPipelineActivo = useCallback((pipeline) => {
    setPipelineActivoState(pipeline)
    setLeads({})
    setLeadCounts({})
    setTablaPage(0)
    // Load etapas + leads directly — no reliance on chained useEffects
    cargarPipelineCompleto(pipeline, vista)
  }, [cargarPipelineCompleto, vista])

  // ── Refresh on tab focus ───────────────────────────────────────────
  useRefreshOnFocus(refrescar, { enabled: !!pipelineActivo })

  // ── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) cargarDatosIniciales()
  }, [user?.id, cargarDatosIniciales])

  // ── Realtime: listen to pipeline changes from other users ──────────
  useEffect(() => {
    if (!pipelineActivo?.id) return

    const channel = supabase
      .channel(`crm-pipeline-${pipelineActivo.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ventas_lead_pipeline',
        filter: `pipeline_id=eq.${pipelineActivo.id}`,
      }, () => {
        // Debounce to avoid thundering herd from rapid changes
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
        realtimeDebounceRef.current = setTimeout(() => refrescar(), 500)
      })
      .subscribe()

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [pipelineActivo?.id, refrescar])

  // ── Reload leads on filter or vista change ─────────────────────────
  // Pipeline changes are handled by setPipelineActivo → cargarPipelineCompleto
  const filtrosVistaRef = useRef({ filtros, vista })
  useEffect(() => {
    // Skip if this is the initial render or pipeline hasn't loaded yet
    if (!pipelineActivo || etapas.length === 0) return

    const prev = filtrosVistaRef.current
    filtrosVistaRef.current = { filtros, vista }

    // Only reload if filtros or vista actually changed (not due to other deps)
    if (prev.filtros === filtros && prev.vista === vista) return

    if (vista === 'kanban') {
      cargarLeads()
    } else {
      cargarLeadsTabla()
    }
  }, [filtros, vista, pipelineActivo, etapas.length, cargarLeads, cargarLeadsTabla])

  // ── Debounced search ───────────────────────────────────────────────
  useEffect(() => {
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current)
    busquedaTimeoutRef.current = setTimeout(() => {
      if (!pipelineActivo || etapas.length === 0) return
      if (busqueda.trim()) {
        buscarLeads(busqueda)
      } else {
        setSearchResultCount(null)
        if (vista === 'kanban') cargarLeads()
        else cargarLeadsTabla()
      }
    }, 300)
    return () => clearTimeout(busquedaTimeoutRef.current)
  }, [busqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Table pagination/sort ──────────────────────────────────────────
  useEffect(() => {
    if (vista === 'tabla' && pipelineActivo) cargarLeadsTabla()
  }, [tablaPage, tablaSort]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Safety net: force loading=false after timeout ──────────────────
  useEffect(() => {
    if (!loading) return
    const timeout = setTimeout(() => {
      console.error('[CRM] Loading timeout — forcing loading=false after', LOADING_TIMEOUT_MS, 'ms')
      setLoading(false)
      setError('La carga tardó demasiado. Intenta refrescar.')
    }, LOADING_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [loading])

  // ── Pipelines visible to user ──────────────────────────────────────
  const pipelinesVisibles = pipelines.filter(p => {
    if (tienePermiso('ventas.crm.ver_todos')) return true
    const nombre = p.nombre.toLowerCase()
    if (esSetter && nombre.includes('setter')) return true
    if (esCloser && nombre.includes('closer')) return true
    return false
  })

  return {
    // Data
    leads, leadCounts, totalLeads, etapas, categorias, etiquetas,
    pipelines: pipelinesVisibles, pipelineActivo, vista, filtros, busqueda,
    loading, loadingMore, error, setters, closers, fuentes,
    rolesComerciales, misRoles, esAdminODirector, esSetter, esCloser, esDirector, esAdmin,
    leadsTabla, tablaTotalCount, tablaPage, tablaSort,
    hasMore: hasMoreRef.current, searchResultCount,

    // Actions
    setPipelineActivo, setVista, setFiltros, setBusqueda,
    setTablaPage, setTablaSort,

    // CRUD
    cargarLeads, cargarMasLeads, moverLead, moverLeadForzado, crearLead,
    actualizarLead, eliminarLead,

    // Venta popup
    leadParaVenta, etapaVentaDestino,
    setLeadParaVenta, setEtapaVentaDestino,

    // Cita popup (interceptar drag a Agendado)
    leadParaCita, etapaCitaDestino,
    setLeadParaCita, setEtapaCitaDestino,

    // Detail
    cargarLeadDetalle, cargarActividad,

    // Assignments
    cambiarSetterAsignado, cambiarCloserAsignado,

    // Tags
    añadirEtiqueta, quitarEtiqueta,

    // Utility
    refrescar,
  }
}
