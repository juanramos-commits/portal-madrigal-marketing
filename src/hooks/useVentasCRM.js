import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'

const LEADS_PER_BATCH = 20
const TABLE_PAGE_SIZE = 50

export function useVentasCRM() {
  const { user, usuario } = useAuth()

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

  const hasMoreRef = useRef({})
  const busquedaTimeoutRef = useRef(null)

  const esAdmin = usuario?.tipo === 'super_admin'
  const rolComercialActual = rolesComerciales.find(r => r.usuario_id === user?.id)
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esCloser = misRoles.some(r => r.rol === 'closer')
  const esDirector = misRoles.some(r => r.rol === 'director_ventas')
  const esAdminODirector = esAdmin || esDirector || misRoles.some(r => r.rol === 'super_admin')

  // ── Load initial data ──────────────────────────────────────────────
  const cargarDatosIniciales = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [
        { data: pipelinesData },
        { data: categoriasData },
        { data: etiquetasData },
        { data: rolesData },
      ] = await Promise.all([
        supabase.from('ventas_pipelines').select('*').eq('activo', true).order('orden'),
        supabase.from('ventas_categorias').select('*').eq('activo', true).order('orden'),
        supabase.from('ventas_etiquetas').select('*').eq('activo', true),
        supabase.from('ventas_roles_comerciales').select('*, usuario:usuarios(id, nombre, email)').eq('activo', true),
      ])

      setPipelines(pipelinesData || [])
      setCategorias(categoriasData || [])
      setEtiquetas(etiquetasData || [])
      setRolesComerciales(rolesData || [])

      const settersList = (rolesData || []).filter(r => r.rol === 'setter' && r.activo)
      const closersList = (rolesData || []).filter(r => r.rol === 'closer' && r.activo)
      setSetters(settersList)
      setClosers(closersList)

      const userRoles = (rolesData || []).filter(r => r.usuario_id === user?.id && r.activo)
      const userEsAdmin = usuario?.tipo === 'super_admin'
      const userEsDirector = userRoles.some(r => r.rol === 'director_ventas' || r.rol === 'super_admin')
      const userEsSetter = userRoles.some(r => r.rol === 'setter')
      const userEsCloser = userRoles.some(r => r.rol === 'closer')

      let defaultPipeline = null
      if (pipelinesData && pipelinesData.length > 0) {
        if (userEsAdmin || userEsDirector) {
          defaultPipeline = pipelinesData[0]
        } else if (userEsSetter && !userEsCloser) {
          defaultPipeline = pipelinesData.find(p => p.nombre.toLowerCase().includes('setter')) || pipelinesData[0]
        } else if (userEsCloser && !userEsSetter) {
          defaultPipeline = pipelinesData.find(p => p.nombre.toLowerCase().includes('closer')) || pipelinesData[0]
        } else {
          defaultPipeline = pipelinesData[0]
        }
      }

      if (defaultPipeline) {
        setPipelineActivoState(defaultPipeline)
        // Don't setLoading(false) here — let cargarLeads handle it
        // after etapas load and leads are fetched
      } else {
        // No pipelines available — nothing more to load
        setLoading(false)
      }
    } catch (err) {
      setError('Error al cargar datos iniciales')
      setLoading(false)
    }
  }, [user?.id, usuario?.tipo])

  // ── Load stages when pipeline changes ──────────────────────────────
  useEffect(() => {
    if (!pipelineActivo) return
    const cargarEtapas = async () => {
      try {
        const { data, error: err } = await supabase
          .from('ventas_etapas')
          .select('*')
          .eq('pipeline_id', pipelineActivo.id)
          .eq('activo', true)
          .order('orden')
        if (err) throw err
        setEtapas(data || [])
      } catch (err) {
        setError('Error al cargar etapas')
        setLoading(false)
      }
    }
    cargarEtapas()
  }, [pipelineActivo?.id])

  // ── Build query with filters ───────────────────────────────────────
  const buildLeadQuery = useCallback((etapaId = null) => {
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
          closer:usuarios!ventas_leads_closer_asignado_id_fkey(id, nombre, email)
        )
      `, { count: 'exact' })
      .eq('pipeline_id', pipelineActivo?.id)

    if (etapaId) {
      query = query.eq('etapa_id', etapaId)
    }

    // Role-based filtering
    if (!esAdminODirector) {
      const pipelineNombre = pipelineActivo?.nombre?.toLowerCase() || ''
      if (pipelineNombre.includes('setter') && esSetter) {
        query = query.eq('lead.setter_asignado_id', user.id)
      } else if (pipelineNombre.includes('closer') && esCloser) {
        query = query.eq('lead.closer_asignado_id', user.id)
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

    // Search
    if (busqueda.trim()) {
      query = query.or(`nombre.ilike.%${busqueda.trim()}%,telefono.ilike.%${busqueda.trim()}%`, { foreignTable: 'ventas_leads' })
    }

    return query
  }, [pipelineActivo?.id, pipelineActivo?.nombre, esAdminODirector, esSetter, esCloser, user?.id, filtros, busqueda])

  // ── Load leads for Kanban ──────────────────────────────────────────
  const cargarLeads = useCallback(async () => {
    if (!pipelineActivo || etapas.length === 0) return

    try {
      setLoading(true)
      setError(null)
      const newLeads = {}
      const newCounts = {}
      let total = 0

      await Promise.all(etapas.map(async (etapa) => {
        const query = buildLeadQuery(etapa.id)
          .order('fecha_entrada', { ascending: false })
          .range(0, LEADS_PER_BATCH - 1)

        const { data, count, error: err } = await query
        if (err) throw err

        newLeads[etapa.id] = (data || []).map(item => ({
          ...item.lead,
          pipeline_lead_id: item.id,
          etapa_id: item.etapa_id,
          pipeline_id: item.pipeline_id,
          contador_intentos: item.contador_intentos,
          fecha_entrada: item.fecha_entrada,
        }))
        newCounts[etapa.id] = count || 0
        total += count || 0
        hasMoreRef.current[etapa.id] = (count || 0) > LEADS_PER_BATCH
      }))

      setLeads(newLeads)
      setLeadCounts(newCounts)
      setTotalLeads(total)
    } catch (err) {
      setError('Error al cargar leads')
    } finally {
      setLoading(false)
    }
  }, [pipelineActivo, etapas, buildLeadQuery])

  // ── Load more leads for a column ───────────────────────────────────
  const cargarMasLeads = useCallback(async (etapaId) => {
    if (!hasMoreRef.current[etapaId] || loadingMore[etapaId]) return

    setLoadingMore(prev => ({ ...prev, [etapaId]: true }))
    try {
      const current = leads[etapaId]?.length || 0
      const query = buildLeadQuery(etapaId)
        .order('fecha_entrada', { ascending: false })
        .range(current, current + LEADS_PER_BATCH - 1)

      const { data, error: err } = await query
      if (err) throw err

      const mapped = (data || []).map(item => ({
        ...item.lead,
        pipeline_lead_id: item.id,
        etapa_id: item.etapa_id,
        pipeline_id: item.pipeline_id,
        contador_intentos: item.contador_intentos,
        fecha_entrada: item.fecha_entrada,
      }))

      setLeads(prev => ({
        ...prev,
        [etapaId]: [...(prev[etapaId] || []), ...mapped],
      }))

      if (mapped.length < LEADS_PER_BATCH) {
        hasMoreRef.current[etapaId] = false
      }
    } catch (_) {
      // Silently fail for load more
    } finally {
      setLoadingMore(prev => ({ ...prev, [etapaId]: false }))
    }
  }, [leads, buildLeadQuery, loadingMore])

  // ── Load leads for Table view ──────────────────────────────────────
  const cargarLeadsTabla = useCallback(async () => {
    if (!pipelineActivo) return

    try {
      setLoading(true)
      const sortCol = tablaSort.col === 'created_at' ? 'lead.created_at' :
                       tablaSort.col === 'nombre' ? 'lead.nombre' :
                       tablaSort.col === 'fecha_entrada' ? 'fecha_entrada' : 'lead.created_at'

      const query = buildLeadQuery()
        .order('fecha_entrada', { ascending: tablaSort.dir === 'asc' })
        .range(tablaPage * TABLE_PAGE_SIZE, (tablaPage + 1) * TABLE_PAGE_SIZE - 1)

      const { data, count, error: err } = await query
      if (err) throw err

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
    } catch (_) {
      setError('Error al cargar leads')
    } finally {
      setLoading(false)
    }
  }, [pipelineActivo, buildLeadQuery, tablaPage, tablaSort, etapas])

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
  const [etapaVentaOrigen, setEtapaVentaOrigen] = useState(null)

  // ── Move lead (drag & drop) ────────────────────────────────────────
  const moverLead = useCallback(async (leadId, etapaOrigenId, etapaDestinoId) => {
    if (etapaOrigenId === etapaDestinoId) return

    const etapaDestino = etapas.find(e => e.id === etapaDestinoId)
    const etapaOrigen = etapas.find(e => e.id === etapaOrigenId)
    if (!etapaDestino) return

    // Find lead
    const leadData = leads[etapaOrigenId]?.find(l => l.id === leadId)
    if (!leadData) return

    // Intercept venta stage — open popup instead of moving
    if (etapaDestino.tipo === 'venta') {
      setLeadParaVenta(leadData)
      setEtapaVentaDestino(etapaDestinoId)
      setEtapaVentaOrigen(etapaOrigenId)
      return
    }

    // Optimistic update
    setLeads(prev => {
      const newLeads = { ...prev }
      newLeads[etapaOrigenId] = (prev[etapaOrigenId] || []).filter(l => l.id !== leadId)
      const movedLead = { ...leadData, etapa_id: etapaDestinoId, contador_intentos: 0 }

      if (etapaDestino.tipo === 'ghosting' || etapaDestino.tipo === 'seguimiento') {
        movedLead.contador_intentos = (leadData.contador_intentos || 0) + 1
      }

      newLeads[etapaDestinoId] = [movedLead, ...(prev[etapaDestinoId] || [])]
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
    } catch (_) {
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
    }
  }, [leads, etapas, pipelineActivo])

  // ── Force move lead (after venta popup confirms) ───────────────────
  const moverLeadForzado = useCallback(async (leadId, pipelineId, etapaDestinoId) => {
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

    if (pErr) throw pErr

    // Auto-assign setter
    try {
      await supabase.rpc('ventas_asignar_lead_automatico', { p_lead_id: lead.id })
    } catch (_) {
      // Non-critical
    }

    // Log activity
    await supabase.from('ventas_actividad').insert({
      lead_id: lead.id,
      usuario_id: user.id,
      tipo: 'creacion',
      descripcion: 'Lead creado manualmente',
      datos: {},
    })

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

  // ── Delete lead ────────────────────────────────────────────────────
  const eliminarLead = useCallback(async (leadId) => {
    const { error: err } = await supabase
      .from('ventas_leads')
      .delete()
      .eq('id', leadId)

    if (err) throw err
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
    await supabase.from('ventas_leads').update({ setter_asignado_id: setterId }).eq('id', leadId)
    await supabase.from('ventas_actividad').insert({
      lead_id: leadId,
      usuario_id: user.id,
      tipo: 'asignacion',
      descripcion: 'Setter reasignado',
      datos: { setter_id: setterId },
    })
    refrescar()
  }, [user?.id, refrescar])

  const cambiarCloserAsignado = useCallback(async (leadId, closerId) => {
    await supabase.from('ventas_leads').update({ closer_asignado_id: closerId }).eq('id', leadId)
    await supabase.from('ventas_actividad').insert({
      lead_id: leadId,
      usuario_id: user.id,
      tipo: 'asignacion',
      descripcion: 'Closer reasignado',
      datos: { closer_id: closerId },
    })
    refrescar()
  }, [user?.id, refrescar])

  // ── Tags ───────────────────────────────────────────────────────────
  const añadirEtiqueta = useCallback(async (leadId, etiquetaId) => {
    const { error: err } = await supabase
      .from('ventas_lead_etiquetas')
      .insert({ lead_id: leadId, etiqueta_id: etiquetaId })
    if (err && err.code !== '23505') throw err
  }, [])

  const quitarEtiqueta = useCallback(async (leadId, etiquetaId) => {
    await supabase
      .from('ventas_lead_etiquetas')
      .delete()
      .eq('lead_id', leadId)
      .eq('etiqueta_id', etiquetaId)
  }, [])

  // ── Unique sources for filters ─────────────────────────────────────
  const [fuentes, setFuentes] = useState([])
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('ventas_leads')
        .select('fuente')
        .not('fuente', 'is', null)
        .limit(200)
      const unique = [...new Set((data || []).map(d => d.fuente).filter(Boolean))]
      setFuentes(unique)
    }
    cargar()
  }, [])

  // ── Set pipeline ───────────────────────────────────────────────────
  const setPipelineActivo = useCallback((pipeline) => {
    setLoading(true)
    setPipelineActivoState(pipeline)
    setLeads({})
    setLeadCounts({})
    setTablaPage(0)
  }, [])

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
        refrescar()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pipelineActivo?.id, refrescar])

  // ── Reload leads on pipeline/filters/search change ─────────────────
  useEffect(() => {
    if (!pipelineActivo || etapas.length === 0) return
    if (vista === 'kanban') {
      cargarLeads()
    } else {
      cargarLeadsTabla()
    }
  }, [pipelineActivo?.id, etapas.length, filtros, vista])

  // ── Debounced search ───────────────────────────────────────────────
  useEffect(() => {
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current)
    busquedaTimeoutRef.current = setTimeout(() => {
      if (!pipelineActivo || etapas.length === 0) return
      if (vista === 'kanban') cargarLeads()
      else cargarLeadsTabla()
    }, 300)
    return () => clearTimeout(busquedaTimeoutRef.current)
  }, [busqueda])

  // ── Table pagination/sort ──────────────────────────────────────────
  useEffect(() => {
    if (vista === 'tabla' && pipelineActivo) cargarLeadsTabla()
  }, [tablaPage, tablaSort])

  // ── Pipelines visible to user ──────────────────────────────────────
  const pipelinesVisibles = pipelines.filter(p => {
    if (esAdminODirector) return true
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
    hasMore: hasMoreRef.current,

    // Actions
    setPipelineActivo, setVista, setFiltros, setBusqueda,
    setTablaPage, setTablaSort,

    // CRUD
    cargarLeads, cargarMasLeads, moverLead, moverLeadForzado, crearLead,
    actualizarLead, eliminarLead,

    // Venta popup
    leadParaVenta, etapaVentaDestino, etapaVentaOrigen,
    setLeadParaVenta, setEtapaVentaDestino,

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
