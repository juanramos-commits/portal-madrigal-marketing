import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'

const PAGE_SIZE = 25

export function useVentas() {
  const { user, usuario } = useAuth()

  const [ventas, setVentas] = useState([])
  const [paquetes, setPaquetes] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [paginaActual, setPaginaActual] = useState(0)
  const [totalVentas, setTotalVentas] = useState(0)
  const [contadores, setContadores] = useState({ todas: 0, pendiente: 0, aprobada: 0, rechazada: 0, devolucion: 0 })
  const [error, setError] = useState(null)

  const busquedaTimeoutRef = useRef(null)

  // Roles
  const [rolesComerciales, setRolesComerciales] = useState([])
  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esDirector = misRoles.some(r => r.rol === 'director_ventas' || r.rol === 'super_admin')
  const esCloser = misRoles.some(r => r.rol === 'closer')
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esAdminODirector = esAdmin || esDirector

  // ── Load roles ─────────────────────────────────────────────────────
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

  // ── Load packages ──────────────────────────────────────────────────
  const cargarPaquetes = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_paquetes')
      .select('*')
      .eq('activo', true)
      .order('orden')
    setPaquetes(data || [])
  }, [])

  useEffect(() => {
    cargarPaquetes()
  }, [cargarPaquetes])

  // ── Build query ────────────────────────────────────────────────────
  const buildQuery = useCallback((countOnly = false) => {
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

    // Search
    if (busqueda.trim()) {
      query = query.ilike('lead.nombre', `%${busqueda.trim()}%`)
    }

    return query
  }, [esAdminODirector, esCloser, esSetter, user?.id, filtroEstado, busqueda])

  // ── Load ventas ────────────────────────────────────────────────────
  const cargarVentas = useCallback(async () => {
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

      // Filter out null leads from ilike (inner join workaround)
      const filtered = busqueda.trim()
        ? (data || []).filter(v => v.lead !== null)
        : (data || [])

      setVentas(filtered)
      setTotalVentas(busqueda.trim() ? filtered.length : (count || 0))
    } catch (err) {
      setError('Error al cargar ventas')
    } finally {
      setLoading(false)
    }
  }, [buildQuery, paginaActual, busqueda])

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
    } catch (_) {
      // Non-critical
    }
  }, [esAdminODirector, esCloser, esSetter, user?.id])

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

  // ── Register sale (from pop-up) ────────────────────────────────────
  const registrarVenta = useCallback(async (datos) => {
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

    // Log activity
    await supabase.from('ventas_actividad').insert({
      lead_id: datos.lead_id,
      usuario_id: user.id,
      tipo: 'venta',
      descripcion: `Venta registrada — ${datos.paquete_nombre || 'Paquete'} — ${Number(datos.importe).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`,
      datos: { venta_id: venta.id, importe: datos.importe },
    })

    // Notify super_admin(s)
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
      await supabase.from('ventas_notificaciones').insert(notificaciones)
    }

    refrescar()
    return venta
  }, [user?.id, refrescar])

  // ── Move lead to venta stage in both pipelines ─────────────────────
  const moverLeadAVenta = useCallback(async (leadId, pipelineId, etapaVentaId) => {
    // Move in the current pipeline
    await supabase
      .from('ventas_lead_pipeline')
      .update({ etapa_id: etapaVentaId, fecha_entrada: new Date().toISOString() })
      .eq('lead_id', leadId)
      .eq('pipeline_id', pipelineId)

    // Move in the other pipeline too (find venta stage there)
    const { data: otherPipelines } = await supabase
      .from('ventas_lead_pipeline')
      .select('pipeline_id')
      .eq('lead_id', leadId)
      .neq('pipeline_id', pipelineId)

    if (otherPipelines && otherPipelines.length > 0) {
      for (const entry of otherPipelines) {
        const { data: etapaVenta } = await supabase
          .from('ventas_etapas')
          .select('id')
          .eq('pipeline_id', entry.pipeline_id)
          .eq('tipo', 'venta')
          .eq('activo', true)
          .limit(1)
          .single()

        if (etapaVenta) {
          await supabase
            .from('ventas_lead_pipeline')
            .update({ etapa_id: etapaVenta.id, fecha_entrada: new Date().toISOString() })
            .eq('lead_id', leadId)
            .eq('pipeline_id', entry.pipeline_id)
        }
      }
    }
  }, [])

  // ── Approve sale ───────────────────────────────────────────────────
  const aprobarVenta = useCallback(async (ventaId) => {
    const { error: err } = await supabase.rpc('ventas_aprobar_venta', { p_venta_id: ventaId })
    if (err) throw err
    refrescar()
  }, [refrescar])

  // ── Reject sale ────────────────────────────────────────────────────
  const rechazarVenta = useCallback(async (ventaId) => {
    const { error: err } = await supabase.rpc('ventas_rechazar_venta', { p_venta_id: ventaId })
    if (err) throw err
    refrescar()
  }, [refrescar])

  // ── Mark refund ────────────────────────────────────────────────────
  const marcarDevolucion = useCallback(async (ventaId) => {
    const { error: err } = await supabase.rpc('ventas_marcar_devolucion', { p_venta_id: ventaId })
    if (err) throw err
    refrescar()
  }, [refrescar])

  // ── Refresh all ────────────────────────────────────────────────────
  const refrescar = useCallback(() => {
    cargarVentas()
    cargarContadores()
  }, [cargarVentas, cargarContadores])

  // ── Refresh on tab focus ───────────────────────────────────────────
  useRefreshOnFocus(refrescar, { enabled: !!user?.id })

  // ── Realtime: listen to ventas changes ─────────────────────────────
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('ventas-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ventas_ventas',
      }, () => {
        refrescar()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, refrescar])

  // ── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id && rolesComerciales.length > 0) {
      cargarVentas()
      cargarContadores()
    }
  }, [user?.id, rolesComerciales.length])

  // ── Reload on filter/page change ───────────────────────────────────
  useEffect(() => {
    if (!user?.id || rolesComerciales.length === 0) return
    cargarVentas()
  }, [filtroEstado, paginaActual])

  // ── Reload counters on filter change ───────────────────────────────
  useEffect(() => {
    if (!user?.id || rolesComerciales.length === 0) return
    cargarContadores()
  }, [filtroEstado])

  // ── Debounced search ───────────────────────────────────────────────
  useEffect(() => {
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current)
    busquedaTimeoutRef.current = setTimeout(() => {
      if (!user?.id || rolesComerciales.length === 0) return
      setPaginaActual(0)
      cargarVentas()
    }, 300)
    return () => clearTimeout(busquedaTimeoutRef.current)
  }, [busqueda])

  return {
    ventas, paquetes, filtroEstado, busqueda, loading, error,
    paginaActual, totalVentas, contadores,
    esAdmin, esAdminODirector, esCloser, esSetter, esDirector,

    setFiltroEstado: (estado) => { setPaginaActual(0); setFiltroEstado(estado) },
    setBusqueda,
    setPaginaActual,

    cargarVentas,
    cargarPaquetes,
    cargarContadores,
    cargarComisiones,

    registrarVenta,
    moverLeadAVenta,
    aprobarVenta,
    rechazarVenta,
    marcarDevolucion,

    refrescar,
    pageSize: PAGE_SIZE,
  }
}
