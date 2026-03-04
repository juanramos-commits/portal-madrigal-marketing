import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'
import { logActividad } from '../lib/logActividad'

const COMISIONES_PAGE_SIZE = 20
const RETIROS_PAGE_SIZE = 25
const FACTURAS_PAGE_SIZE = 25

export function useWallet() {
  const { user, usuario, tienePermiso, loading: authLoading } = useAuth()

  const [wallet, setWallet] = useState(null)
  const [saldoDisponible, setSaldoDisponible] = useState(0)
  const [comisiones, setComisiones] = useState([])
  const [comisionesTotal, setComisionesTotal] = useState(0)
  const [comisionesPagina, setComisionesPagina] = useState(0)
  const [retiros, setRetiros] = useState([])
  const [retirosTotal, setRetirosTotal] = useState(0)
  const [retirosPagina, setRetirosPagina] = useState(0)
  const [facturas, setFacturas] = useState([])
  const [facturasTotal, setFacturasTotal] = useState(0)
  const [facturasPagina, setFacturasPagina] = useState(0)
  const [datosFiscales, setDatosFiscales] = useState(null)
  const [empresaFiscal, setEmpresaFiscal] = useState(null)
  const [closerAlDia, setCloserAlDia] = useState(true)
  const [citasPendientes, setCitasPendientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Admin state
  const [todosRetiros, setTodosRetiros] = useState([])
  const [todosRetirosTotal, setTodosRetirosTotal] = useState(0)
  const [todosRetirosFiltro, setTodosRetirosFiltro] = useState('pendiente')
  const [todasFacturas, setTodasFacturas] = useState([])
  const [todasFacturasTotal, setTodasFacturasTotal] = useState(0)
  const [todasFacturasFiltroUsuario, setTodasFacturasFiltroUsuario] = useState('')
  const [contadoresRetiros, setContadoresRetiros] = useState({ pendiente: 0, aprobado: 0, rechazado: 0, todos: 0 })

  // Comisiones filters
  const [comisionesFiltroTipo, setComisionesFiltroTipo] = useState('todas')
  const [comisionesFiltroDesde, setComisionesFiltroDesde] = useState('')
  const [comisionesFiltroHasta, setComisionesFiltroHasta] = useState('')
  const [comisionesUsuarioId, setComisionesUsuarioId] = useState('')

  // Search state
  const [comisionesBusqueda, setComisionesBusqueda] = useState('')
  const [retirosBusqueda, setRetirosBusqueda] = useState('')
  const [facturasBusqueda, setFacturasBusqueda] = useState('')
  const [adminRetirosBusqueda, setAdminRetirosBusqueda] = useState('')
  const [adminFacturasBusqueda, setAdminFacturasBusqueda] = useState('')

  // Search refs (race condition prevention + debounce)
  const comisionesSearchRef = useRef(0)
  const retirosSearchRef = useRef(0)
  const facturasSearchRef = useRef(0)
  const adminRetirosSearchRef = useRef(0)
  const adminFacturasSearchRef = useRef(0)
  const comisionesBusquedaTimeout = useRef(null)
  const retirosBusquedaTimeout = useRef(null)
  const facturasBusquedaTimeout = useRef(null)
  const adminRetirosBusquedaTimeout = useRef(null)
  const adminFacturasBusquedaTimeout = useRef(null)

  // Members list (for admin)
  const [miembros, setMiembros] = useState([])

  // Roles
  const [rolesComerciales, setRolesComerciales] = useState([])
  const esAdmin = tienePermiso('ventas.wallet.ver_todos')
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esCloser = misRoles.some(r => r.rol === 'closer')

  // ── Load roles ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const cargar = async () => {
      const { data } = await supabase
        .from('ventas_roles_comerciales')
        .select('*, usuario:usuarios(id, nombre, email)')
        .eq('activo', true)
      setRolesComerciales(data || [])
      const unique = []
      const seen = new Set()
      for (const r of (data || [])) {
        if (!seen.has(r.usuario_id)) {
          seen.add(r.usuario_id)
          unique.push({ id: r.usuario_id, nombre: r.usuario?.nombre, email: r.usuario?.email })
        }
      }
      setMiembros(unique)
    }
    cargar()
  }, [user?.id])

  // ── Load wallet ────────────────────────────────────────────────────
  const cargarWallet = useCallback(async () => {
    if (!user?.id) return
    const { data, error: err } = await supabase
      .from('ventas_wallet')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (err) { setError('Error al cargar wallet'); return }
    setWallet(data)
  }, [user?.id])

  // ── Load saldo disponible ──────────────────────────────────────────
  const cargarSaldoDisponible = useCallback(async () => {
    if (!user?.id) return
    const { data, error: err } = await supabase.rpc('ventas_obtener_saldo_disponible', { p_usuario_id: user.id })
    if (!err) setSaldoDisponible(data || 0)
  }, [user?.id])

  // ── Verificar closer al día + cargar citas pendientes ──────────────
  const verificarCloserAlDia = useCallback(async () => {
    if (!user?.id) return
    const { data, error: err } = await supabase.rpc('ventas_verificar_closer_al_dia', { p_usuario_id: user.id })
    if (!err) setCloserAlDia(data !== false)

    // Si no está al día, cargar las citas pendientes para mostrar al usuario
    if (!err && data === false) {
      const { data: citas } = await supabase
        .from('ventas_citas')
        .select('id, fecha_hora, lead:ventas_leads!ventas_citas_lead_id_fkey(id, nombre)')
        .eq('closer_id', user.id)
        .is('estado_reunion_id', null)
        .neq('estado', 'cancelada')
        .lt('fecha_hora', new Date().toISOString())
        .order('fecha_hora', { ascending: false })
        .limit(10)
      setCitasPendientes(citas || [])
    } else {
      setCitasPendientes([])
    }
  }, [user?.id])

  // ── Load comisiones ────────────────────────────────────────────────
  const cargarComisiones = useCallback(async () => {
    const uid = (esAdmin && comisionesUsuarioId) ? comisionesUsuarioId : user?.id
    if (!uid) return

    let query = supabase
      .from('ventas_comisiones')
      .select(`
        *, venta:ventas_ventas(id, lead_id, lead:ventas_leads(id, nombre))
      `, { count: 'exact' })
      .eq('usuario_id', uid)
      .order('created_at', { ascending: false })

    if (comisionesFiltroTipo === 'fijas') query = query.eq('es_bonus', false).gte('monto', 0)
    if (comisionesFiltroTipo === 'bonus') query = query.eq('es_bonus', true)
    if (comisionesFiltroTipo === 'negativas') query = query.lt('monto', 0)
    if (comisionesFiltroDesde) query = query.gte('created_at', comisionesFiltroDesde)
    if (comisionesFiltroHasta) query = query.lte('created_at', comisionesFiltroHasta + 'T23:59:59')

    const from = comisionesPagina * COMISIONES_PAGE_SIZE
    query = query.range(from, from + COMISIONES_PAGE_SIZE - 1)

    const { data, count } = await query
    setComisiones(data || [])
    setComisionesTotal(count || 0)
  }, [user?.id, esAdmin, comisionesUsuarioId, comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesPagina])

  // ── Load retiros (own) ─────────────────────────────────────────────
  const cargarRetiros = useCallback(async () => {
    if (!user?.id) return
    const from = retirosPagina * RETIROS_PAGE_SIZE
    const { data, count } = await supabase
      .from('ventas_retiros')
      .select('*, factura:ventas_facturas(id, numero_factura)', { count: 'exact' })
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, from + RETIROS_PAGE_SIZE - 1)

    setRetiros(data || [])
    setRetirosTotal(count || 0)
  }, [user?.id, retirosPagina])

  // ── Load facturas (own) ────────────────────────────────────────────
  const cargarFacturas = useCallback(async () => {
    if (!user?.id) return
    const from = facturasPagina * FACTURAS_PAGE_SIZE
    const { data, count } = await supabase
      .from('ventas_facturas')
      .select('*', { count: 'exact' })
      .eq('usuario_id', user.id)
      .order('fecha_emision', { ascending: false })
      .range(from, from + FACTURAS_PAGE_SIZE - 1)

    setFacturas(data || [])
    setFacturasTotal(count || 0)
  }, [user?.id, facturasPagina])

  // ── Load datos fiscales ────────────────────────────────────────────
  const cargarDatosFiscales = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_datos_fiscales')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (data) {
      setDatosFiscales(data)
    } else {
      const { data: created, error: insertErr } = await supabase
        .from('ventas_datos_fiscales')
        .upsert({ usuario_id: user.id }, { onConflict: 'usuario_id' })
        .select()
        .single()
      if (insertErr) {
        // Race condition: another call already created the row — re-fetch
        const { data: refetched } = await supabase
          .from('ventas_datos_fiscales')
          .select('*')
          .eq('usuario_id', user.id)
          .maybeSingle()
        setDatosFiscales(refetched || { usuario_id: user.id, tipo_cuenta: 'iban', serie_factura: 'F', siguiente_numero_factura: 1, iva_porcentaje: 0, iva_incluido: false })
      } else {
        setDatosFiscales(created || { usuario_id: user.id, tipo_cuenta: 'iban', serie_factura: 'F', siguiente_numero_factura: 1, iva_porcentaje: 0, iva_incluido: false })
      }
    }
  }, [user?.id])

  // ── Load empresa fiscal ────────────────────────────────────────────
  const cargarEmpresaFiscal = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_empresa_fiscal')
      .select('*')
      .limit(1)
      .maybeSingle()
    setEmpresaFiscal(data)
  }, [])

  // ── Save datos fiscales ────────────────────────────────────────────
  const guardarDatosFiscales = useCallback(async (datos) => {
    const { siguiente_numero_factura, id, created_at, updated_at, ...datosParaGuardar } = datos
    const { error: err } = await supabase
      .from('ventas_datos_fiscales')
      .upsert({
        ...datosParaGuardar,
        usuario_id: user.id,
      }, { onConflict: 'usuario_id' })

    if (err) throw err
    setDatosFiscales(datos)
    logActividad('wallet', 'editar', 'Datos fiscales actualizados')
  }, [user?.id])

  // ── Admin: load all retiros ────────────────────────────────────────
  const cargarTodosRetiros = useCallback(async () => {
    let query = supabase
      .from('ventas_retiros')
      .select(`
        *,
        usuario:usuarios!ventas_retiros_usuario_id_fkey(id, nombre, email),
        factura:ventas_facturas(id, numero_factura)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (todosRetirosFiltro !== 'todos') {
      query = query.eq('estado', todosRetirosFiltro)
    }

    query = query.limit(200)

    const { data, count } = await query
    setTodosRetiros(data || [])
    setTodosRetirosTotal(count || 0)
  }, [todosRetirosFiltro])

  // ── Admin: load retiro counters ────────────────────────────────────
  const cargarContadoresRetiros = useCallback(async () => {
    const [
      { count: todos },
      { count: pendiente },
      { count: aprobado },
      { count: rechazado },
    ] = await Promise.all([
      supabase.from('ventas_retiros').select('id', { count: 'exact', head: true }),
      supabase.from('ventas_retiros').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('ventas_retiros').select('id', { count: 'exact', head: true }).eq('estado', 'aprobado'),
      supabase.from('ventas_retiros').select('id', { count: 'exact', head: true }).eq('estado', 'rechazado'),
    ])
    setContadoresRetiros({ todos: todos || 0, pendiente: pendiente || 0, aprobado: aprobado || 0, rechazado: rechazado || 0 })
  }, [])

  // ── Admin: load all facturas ───────────────────────────────────────
  const cargarTodasFacturas = useCallback(async () => {
    let query = supabase
      .from('ventas_facturas')
      .select('*, usuario:usuarios(id, nombre, email)', { count: 'exact' })
      .order('fecha_emision', { ascending: false })

    if (todasFacturasFiltroUsuario) {
      query = query.eq('usuario_id', todasFacturasFiltroUsuario)
    }

    query = query.limit(200)

    const { data, count } = await query
    setTodasFacturas(data || [])
    setTodasFacturasTotal(count || 0)
  }, [todasFacturasFiltroUsuario])

  // ── Search: comisiones ─────────────────────────────────────────────
  const buscarComisiones = useCallback(async (query) => {
    const requestId = ++comisionesSearchRef.current
    try {
      const effectiveRole = esAdmin ? 'super_admin' : ''
      const uid = (esAdmin && comisionesUsuarioId) ? comisionesUsuarioId : user?.id
      const { data: results, error: err } = await supabase.rpc('ventas_buscar_comisiones', {
        p_query: query.trim(),
        p_user_id: user?.id,
        p_user_role: effectiveRole,
        p_filtro_usuario_id: (esAdmin && comisionesUsuarioId) ? comisionesUsuarioId : null,
        p_tipo: comisionesFiltroTipo,
        p_desde: comisionesFiltroDesde || null,
        p_hasta: comisionesFiltroHasta || null,
        p_limit: COMISIONES_PAGE_SIZE,
        p_offset: comisionesPagina * COMISIONES_PAGE_SIZE,
      })
      if (err) throw err
      if (requestId !== comisionesSearchRef.current) return
      if (!results || results.length === 0) {
        setComisiones([])
        setComisionesTotal(0)
        return
      }
      const ids = results.map(r => r.comision_id)
      const { data } = await supabase
        .from('ventas_comisiones')
        .select('*, venta:ventas_ventas(id, lead_id, lead:ventas_leads(id, nombre))')
        .in('id', ids)
      if (requestId !== comisionesSearchRef.current) return
      // Sort by relevance
      const relevMap = Object.fromEntries(results.map(r => [r.comision_id, r.relevancia]))
      const sorted = (data || []).sort((a, b) => (relevMap[b.id] || 0) - (relevMap[a.id] || 0))
      setComisiones(sorted)
      // RPC doesn't return total count — estimate: if full page, assume more exist
      const estimatedTotal = results.length >= COMISIONES_PAGE_SIZE
        ? (comisionesPagina + 2) * COMISIONES_PAGE_SIZE
        : comisionesPagina * COMISIONES_PAGE_SIZE + sorted.length
      setComisionesTotal(estimatedTotal)
    } catch (err) {
      if (requestId !== comisionesSearchRef.current) return
      console.warn('RPC ventas_buscar_comisiones no disponible:', err.message)
      cargarComisiones()
    }
  }, [user?.id, esAdmin, comisionesUsuarioId, comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesPagina, cargarComisiones])

  // ── Search: retiros (own) ─────────────────────────────────────────
  const buscarRetiros = useCallback(async (query) => {
    const requestId = ++retirosSearchRef.current
    try {
      const { data: results, error: err } = await supabase.rpc('ventas_buscar_retiros', {
        p_query: query.trim(),
        p_user_id: user?.id,
        p_user_role: '',
        p_estado: null,
        p_limit: RETIROS_PAGE_SIZE,
        p_offset: retirosPagina * RETIROS_PAGE_SIZE,
      })
      if (err) throw err
      if (requestId !== retirosSearchRef.current) return
      if (!results || results.length === 0) {
        setRetiros([])
        setRetirosTotal(0)
        return
      }
      const ids = results.map(r => r.retiro_id)
      const { data } = await supabase
        .from('ventas_retiros')
        .select('*, factura:ventas_facturas(id, numero_factura)')
        .in('id', ids)
      if (requestId !== retirosSearchRef.current) return
      const relevMap = Object.fromEntries(results.map(r => [r.retiro_id, r.relevancia]))
      const sorted = (data || []).sort((a, b) => (relevMap[b.id] || 0) - (relevMap[a.id] || 0))
      setRetiros(sorted)
      const estTotal = results.length >= RETIROS_PAGE_SIZE
        ? (retirosPagina + 2) * RETIROS_PAGE_SIZE
        : retirosPagina * RETIROS_PAGE_SIZE + sorted.length
      setRetirosTotal(estTotal)
    } catch (err) {
      if (requestId !== retirosSearchRef.current) return
      console.warn('RPC ventas_buscar_retiros no disponible:', err.message)
      cargarRetiros()
    }
  }, [user?.id, retirosPagina, cargarRetiros])

  // ── Search: facturas (own) ────────────────────────────────────────
  const buscarFacturas = useCallback(async (query) => {
    const requestId = ++facturasSearchRef.current
    try {
      const { data: results, error: err } = await supabase.rpc('ventas_buscar_facturas', {
        p_query: query.trim(),
        p_user_id: user?.id,
        p_user_role: '',
        p_filtro_usuario_id: null,
        p_limit: FACTURAS_PAGE_SIZE,
        p_offset: facturasPagina * FACTURAS_PAGE_SIZE,
      })
      if (err) throw err
      if (requestId !== facturasSearchRef.current) return
      if (!results || results.length === 0) {
        setFacturas([])
        setFacturasTotal(0)
        return
      }
      const ids = results.map(r => r.factura_id)
      const { data } = await supabase
        .from('ventas_facturas')
        .select('*')
        .in('id', ids)
      if (requestId !== facturasSearchRef.current) return
      const relevMap = Object.fromEntries(results.map(r => [r.factura_id, r.relevancia]))
      const sorted = (data || []).sort((a, b) => (relevMap[b.id] || 0) - (relevMap[a.id] || 0))
      setFacturas(sorted)
      const estTotal = results.length >= FACTURAS_PAGE_SIZE
        ? (facturasPagina + 2) * FACTURAS_PAGE_SIZE
        : facturasPagina * FACTURAS_PAGE_SIZE + sorted.length
      setFacturasTotal(estTotal)
    } catch (err) {
      if (requestId !== facturasSearchRef.current) return
      console.warn('RPC ventas_buscar_facturas no disponible:', err.message)
      cargarFacturas()
    }
  }, [user?.id, facturasPagina, cargarFacturas])

  // ── Search: admin retiros ─────────────────────────────────────────
  const buscarAdminRetiros = useCallback(async (query) => {
    const requestId = ++adminRetirosSearchRef.current
    try {
      const { data: results, error: err } = await supabase.rpc('ventas_buscar_retiros', {
        p_query: query.trim(),
        p_user_id: user?.id,
        p_user_role: 'super_admin',
        p_estado: todosRetirosFiltro !== 'todos' ? todosRetirosFiltro : null,
        p_limit: 200,
        p_offset: 0,
      })
      if (err) throw err
      if (requestId !== adminRetirosSearchRef.current) return
      if (!results || results.length === 0) {
        setTodosRetiros([])
        setTodosRetirosTotal(0)
        return
      }
      const ids = results.map(r => r.retiro_id)
      const { data } = await supabase
        .from('ventas_retiros')
        .select('*, usuario:usuarios!ventas_retiros_usuario_id_fkey(id, nombre, email), factura:ventas_facturas(id, numero_factura)')
        .in('id', ids)
      if (requestId !== adminRetirosSearchRef.current) return
      const relevMap = Object.fromEntries(results.map(r => [r.retiro_id, r.relevancia]))
      const sorted = (data || []).sort((a, b) => (relevMap[b.id] || 0) - (relevMap[a.id] || 0))
      setTodosRetiros(sorted)
      setTodosRetirosTotal(sorted.length)
    } catch (err) {
      if (requestId !== adminRetirosSearchRef.current) return
      console.warn('RPC ventas_buscar_retiros (admin) no disponible:', err.message)
      cargarTodosRetiros()
    }
  }, [user?.id, todosRetirosFiltro, cargarTodosRetiros])

  // ── Search: admin facturas ────────────────────────────────────────
  const buscarAdminFacturas = useCallback(async (query) => {
    const requestId = ++adminFacturasSearchRef.current
    try {
      const { data: results, error: err } = await supabase.rpc('ventas_buscar_facturas', {
        p_query: query.trim(),
        p_user_id: user?.id,
        p_user_role: 'super_admin',
        p_filtro_usuario_id: todasFacturasFiltroUsuario || null,
        p_limit: 200,
        p_offset: 0,
      })
      if (err) throw err
      if (requestId !== adminFacturasSearchRef.current) return
      if (!results || results.length === 0) {
        setTodasFacturas([])
        setTodasFacturasTotal(0)
        return
      }
      const ids = results.map(r => r.factura_id)
      const { data } = await supabase
        .from('ventas_facturas')
        .select('*, usuario:usuarios(id, nombre, email)')
        .in('id', ids)
      if (requestId !== adminFacturasSearchRef.current) return
      const relevMap = Object.fromEntries(results.map(r => [r.factura_id, r.relevancia]))
      const sorted = (data || []).sort((a, b) => (relevMap[b.id] || 0) - (relevMap[a.id] || 0))
      setTodasFacturas(sorted)
      setTodasFacturasTotal(sorted.length)
    } catch (err) {
      if (requestId !== adminFacturasSearchRef.current) return
      console.warn('RPC ventas_buscar_facturas (admin) no disponible:', err.message)
      cargarTodasFacturas()
    }
  }, [user?.id, todasFacturasFiltroUsuario, cargarTodasFacturas])

  // ── Export comisiones CSV ─────────────────────────────────────────
  const exportarComisionesCSV = useCallback(async () => {
    const uid = (esAdmin && comisionesUsuarioId) ? comisionesUsuarioId : user?.id
    if (!uid) return

    let rows = []
    if (comisionesBusqueda.trim()) {
      const effectiveRole = esAdmin ? 'super_admin' : ''
      const { data: results } = await supabase.rpc('ventas_buscar_comisiones', {
        p_query: comisionesBusqueda.trim(),
        p_user_id: user?.id,
        p_user_role: effectiveRole,
        p_filtro_usuario_id: (esAdmin && comisionesUsuarioId) ? comisionesUsuarioId : null,
        p_tipo: comisionesFiltroTipo,
        p_desde: comisionesFiltroDesde || null,
        p_hasta: comisionesFiltroHasta || null,
        p_limit: 10000,
        p_offset: 0,
      })
      if (results && results.length > 0) {
        const ids = results.map(r => r.comision_id)
        const { data } = await supabase
          .from('ventas_comisiones')
          .select('*, venta:ventas_ventas(id, lead_id, lead:ventas_leads(id, nombre))')
          .in('id', ids)
          .order('created_at', { ascending: false })
        rows = data || []
      }
    } else {
      let query = supabase
        .from('ventas_comisiones')
        .select('*, venta:ventas_ventas(id, lead_id, lead:ventas_leads(id, nombre))')
        .eq('usuario_id', uid)
        .order('created_at', { ascending: false })
      if (comisionesFiltroTipo === 'fijas') query = query.eq('es_bonus', false).gte('monto', 0)
      if (comisionesFiltroTipo === 'bonus') query = query.eq('es_bonus', true)
      if (comisionesFiltroTipo === 'negativas') query = query.lt('monto', 0)
      if (comisionesFiltroDesde) query = query.gte('created_at', comisionesFiltroDesde)
      if (comisionesFiltroHasta) query = query.lte('created_at', comisionesFiltroHasta + 'T23:59:59')
      query = query.limit(10000)
      const { data } = await query
      rows = data || []
    }

    if (rows.length === 0) return

    const getTipo = (c) => c.monto < 0 ? 'Devolución' : c.es_bonus ? 'Bonus' : 'Fija'
    const headers = ['Fecha', 'Concepto', 'Rol', 'Tipo', 'Importe', 'Disponible desde', 'Lead']
    const csvRows = rows.map(c => [
      c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '',
      c.concepto || '',
      c.rol || '',
      getTipo(c),
      c.monto,
      c.disponible_desde ? new Date(c.disponible_desde).toLocaleDateString('es-ES') : 'Disponible',
      c.venta?.lead?.nombre || '',
    ])

    const csv = [headers, ...csvRows].map(row =>
      row.map(cell => {
        const str = String(cell ?? '')
        return str.includes(';') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(';')
    ).join('\n')

    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comisiones_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [user?.id, esAdmin, comisionesUsuarioId, comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesBusqueda])

  // ── Refresh all ────────────────────────────────────────────────────
  const refrescar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        cargarWallet(),
        cargarSaldoDisponible(),
        cargarDatosFiscales(),
        cargarEmpresaFiscal(),
        cargarComisiones(),
        cargarRetiros(),
        cargarFacturas(),
        esCloser ? verificarCloserAlDia() : Promise.resolve(),
      ])
      if (esAdmin) {
        await Promise.all([
          cargarTodosRetiros(),
          cargarContadoresRetiros(),
          cargarTodasFacturas(),
        ])
      }
    } catch (_) {
      setError('Error al cargar datos del wallet')
    } finally {
      setLoading(false)
    }
  }, [cargarWallet, cargarSaldoDisponible, cargarDatosFiscales, cargarEmpresaFiscal, cargarComisiones, cargarRetiros, cargarFacturas, esCloser, verificarCloserAlDia, esAdmin, cargarTodosRetiros, cargarContadoresRetiros, cargarTodasFacturas])

  // ── Solicitar retiro ───────────────────────────────────────────────
  const solicitarRetiro = useCallback(async (monto) => {
    if (!tienePermiso('ventas.wallet.solicitar_retiro')) throw new Error('No tienes permiso para solicitar retiros')
    const { data, error: err } = await supabase.rpc('ventas_solicitar_retiro', {
      p_usuario_id: user.id,
      p_monto: monto,
    })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error || 'Error al solicitar retiro')
    logActividad('wallet', 'crear', 'Retiro solicitado: ' + monto + '\u20AC', { entidad: 'retiro' })
    refrescar()
    return data
  }, [user?.id, refrescar, tienePermiso])

  // ── Admin: aprobar retiro ──────────────────────────────────────────
  const aprobarRetiro = useCallback(async (retiroId) => {
    if (!tienePermiso('ventas.wallet.aprobar_retiros')) throw new Error('No tienes permiso para aprobar retiros')
    const { data, error: err } = await supabase.rpc('ventas_aprobar_retiro', { p_retiro_id: retiroId })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error || 'Error al aprobar retiro')
    logActividad('wallet', 'aprobar', 'Retiro aprobado', { entidad: 'retiro', entidad_id: retiroId })
    refrescar()
    return data
  }, [refrescar, tienePermiso])

  // ── Admin: rechazar retiro ─────────────────────────────────────────
  const rechazarRetiro = useCallback(async (retiroId, motivo) => {
    if (!tienePermiso('ventas.wallet.aprobar_retiros')) throw new Error('No tienes permiso para rechazar retiros')
    const { data, error: err } = await supabase.rpc('ventas_rechazar_retiro', {
      p_retiro_id: retiroId,
      p_motivo: motivo || null,
    })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error || 'Error al rechazar retiro')
    logActividad('wallet', 'rechazar', 'Retiro rechazado', { entidad: 'retiro', entidad_id: retiroId })
    refrescar()
    return data
  }, [refrescar, tienePermiso])

  // ── Refresh on tab focus ───────────────────────────────────────────
  useRefreshOnFocus(refrescar, { enabled: !!user?.id })

  // ── Initial load ───────────────────────────────────────────────────
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (!user?.id || authLoading || initialLoadDone.current) return
    if (rolesComerciales.length > 0 || esAdmin) {
      initialLoadDone.current = true
      refrescar()
    }
  }, [user?.id, rolesComerciales.length, esAdmin, authLoading])

  // Fallback: stop infinite loading if no roles
  useEffect(() => {
    if (user?.id && !authLoading && rolesComerciales.length === 0 && !esAdmin && !initialLoadDone.current) {
      setLoading(false)
    }
  }, [user?.id, authLoading, rolesComerciales.length, esAdmin])

  // ── Reset pagination when filters change ───────────────────────────
  useEffect(() => {
    setComisionesPagina(0)
  }, [comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesUsuarioId])

  // ── Reload comisiones on filter/page change ───────────────────────
  useEffect(() => {
    if (!user?.id) return
    if (comisionesBusqueda.trim()) buscarComisiones(comisionesBusqueda)
    else cargarComisiones()
  }, [comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesPagina, comisionesUsuarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload retiros on page change ────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    if (retirosBusqueda.trim()) buscarRetiros(retirosBusqueda)
    else cargarRetiros()
  }, [retirosPagina]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload facturas on page change ───────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    if (facturasBusqueda.trim()) buscarFacturas(facturasBusqueda)
    else cargarFacturas()
  }, [facturasPagina]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload admin retiros on filter change ──────────────────────────
  useEffect(() => {
    if (!esAdmin) return
    if (adminRetirosBusqueda.trim()) buscarAdminRetiros(adminRetirosBusqueda)
    else cargarTodosRetiros()
  }, [todosRetirosFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload admin facturas on filter change ─────────────────────────
  useEffect(() => {
    if (!esAdmin) return
    if (adminFacturasBusqueda.trim()) buscarAdminFacturas(adminFacturasBusqueda)
    else cargarTodasFacturas()
  }, [todasFacturasFiltroUsuario]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced search: comisiones ──────────────────────────────────
  useEffect(() => {
    if (comisionesBusquedaTimeout.current) clearTimeout(comisionesBusquedaTimeout.current)
    comisionesBusquedaTimeout.current = setTimeout(() => {
      if (!user?.id) return
      if (comisionesBusqueda.trim()) buscarComisiones(comisionesBusqueda)
      else cargarComisiones()
    }, 300)
    return () => clearTimeout(comisionesBusquedaTimeout.current)
  }, [comisionesBusqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced search: retiros ─────────────────────────────────────
  useEffect(() => {
    if (retirosBusquedaTimeout.current) clearTimeout(retirosBusquedaTimeout.current)
    retirosBusquedaTimeout.current = setTimeout(() => {
      if (!user?.id) return
      if (retirosBusqueda.trim()) buscarRetiros(retirosBusqueda)
      else cargarRetiros()
    }, 300)
    return () => clearTimeout(retirosBusquedaTimeout.current)
  }, [retirosBusqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced search: facturas ────────────────────────────────────
  useEffect(() => {
    if (facturasBusquedaTimeout.current) clearTimeout(facturasBusquedaTimeout.current)
    facturasBusquedaTimeout.current = setTimeout(() => {
      if (!user?.id) return
      if (facturasBusqueda.trim()) buscarFacturas(facturasBusqueda)
      else cargarFacturas()
    }, 300)
    return () => clearTimeout(facturasBusquedaTimeout.current)
  }, [facturasBusqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced search: admin retiros ───────────────────────────────
  useEffect(() => {
    if (adminRetirosBusquedaTimeout.current) clearTimeout(adminRetirosBusquedaTimeout.current)
    adminRetirosBusquedaTimeout.current = setTimeout(() => {
      if (!esAdmin) return
      if (adminRetirosBusqueda.trim()) buscarAdminRetiros(adminRetirosBusqueda)
      else cargarTodosRetiros()
    }, 300)
    return () => clearTimeout(adminRetirosBusquedaTimeout.current)
  }, [adminRetirosBusqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced search: admin facturas ──────────────────────────────
  useEffect(() => {
    if (adminFacturasBusquedaTimeout.current) clearTimeout(adminFacturasBusquedaTimeout.current)
    adminFacturasBusquedaTimeout.current = setTimeout(() => {
      if (!esAdmin) return
      if (adminFacturasBusqueda.trim()) buscarAdminFacturas(adminFacturasBusqueda)
      else cargarTodasFacturas()
    }, 300)
    return () => clearTimeout(adminFacturasBusquedaTimeout.current)
  }, [adminFacturasBusqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    wallet, saldoDisponible, comisiones, comisionesTotal, comisionesPagina,
    retiros, retirosTotal, retirosPagina,
    facturas, facturasTotal, facturasPagina,
    datosFiscales, empresaFiscal, closerAlDia, citasPendientes, loading, error,
    esAdmin, esCloser, miembros,

    todosRetiros, todosRetirosTotal, todosRetirosFiltro,
    todasFacturas, todasFacturasTotal, todasFacturasFiltroUsuario,
    contadoresRetiros,

    comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesUsuarioId,

    // Search state
    comisionesBusqueda, retirosBusqueda, facturasBusqueda,
    adminRetirosBusqueda, adminFacturasBusqueda,

    setComisionesPagina,
    setRetirosPagina,
    setFacturasPagina,
    setComisionesFiltroTipo,
    setComisionesFiltroDesde,
    setComisionesFiltroHasta,
    setComisionesUsuarioId,
    setTodosRetirosFiltro,
    setTodasFacturasFiltroUsuario,

    // Search setters
    setComisionesBusqueda, setRetirosBusqueda, setFacturasBusqueda,
    setAdminRetirosBusqueda, setAdminFacturasBusqueda,

    cargarWallet, cargarSaldoDisponible, cargarComisiones, cargarRetiros,
    cargarFacturas, cargarDatosFiscales, cargarEmpresaFiscal, verificarCloserAlDia,
    guardarDatosFiscales, solicitarRetiro, exportarComisionesCSV,

    cargarTodosRetiros, cargarTodasFacturas, cargarContadoresRetiros,
    aprobarRetiro, rechazarRetiro,

    refrescar,
    comisionesPageSize: COMISIONES_PAGE_SIZE,
    retirosPageSize: RETIROS_PAGE_SIZE,
    facturasPageSize: FACTURAS_PAGE_SIZE,
  }
}
