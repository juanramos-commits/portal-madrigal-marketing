import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRefreshOnFocus } from './useRefreshOnFocus'

const COMISIONES_PAGE_SIZE = 20
const RETIROS_PAGE_SIZE = 25
const FACTURAS_PAGE_SIZE = 25

export function useWallet() {
  const { user, usuario } = useAuth()

  const [wallet, setWallet] = useState(null)
  const [saldoDisponible, setSaldoDisponible] = useState(0)
  const [comisiones, setComisiones] = useState([])
  const [comisionesTotal, setComisionesTotal] = useState(0)
  const [comisionesPagina, setComisionesPagina] = useState(0)
  const [retiros, setRetiros] = useState([])
  const [retirosTotal, setRetirosTotal] = useState(0)
  const [facturas, setFacturas] = useState([])
  const [facturasTotal, setFacturasTotal] = useState(0)
  const [datosFiscales, setDatosFiscales] = useState(null)
  const [empresaFiscal, setEmpresaFiscal] = useState(null)
  const [closerAlDia, setCloserAlDia] = useState(true)
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

  // Members list (for admin)
  const [miembros, setMiembros] = useState([])

  // Roles
  const [rolesComerciales, setRolesComerciales] = useState([])
  const esAdmin = usuario?.tipo === 'super_admin'
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

  // ── Verificar closer al día ────────────────────────────────────────
  const verificarCloserAlDia = useCallback(async () => {
    if (!user?.id) return
    const { data, error: err } = await supabase.rpc('ventas_verificar_closer_al_dia', { p_usuario_id: user.id })
    if (!err) setCloserAlDia(data !== false)
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
    const { data, count } = await supabase
      .from('ventas_retiros')
      .select('*, factura:ventas_facturas(id, numero_factura)', { count: 'exact' })
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, RETIROS_PAGE_SIZE - 1)

    setRetiros(data || [])
    setRetirosTotal(count || 0)
  }, [user?.id])

  // ── Load facturas (own) ────────────────────────────────────────────
  const cargarFacturas = useCallback(async () => {
    if (!user?.id) return
    const { data, count } = await supabase
      .from('ventas_facturas')
      .select('*', { count: 'exact' })
      .eq('usuario_id', user.id)
      .order('fecha_emision', { ascending: false })
      .range(0, FACTURAS_PAGE_SIZE - 1)

    setFacturas(data || [])
    setFacturasTotal(count || 0)
  }, [user?.id])

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
      const { data: created } = await supabase
        .from('ventas_datos_fiscales')
        .insert({ usuario_id: user.id })
        .select()
        .single()
      setDatosFiscales(created || { usuario_id: user.id, serie_factura: 'F', siguiente_numero_factura: 1, iva_porcentaje: 0, iva_incluido: false })
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
    const { error: err } = await supabase
      .from('ventas_datos_fiscales')
      .upsert({
        ...datos,
        usuario_id: user.id,
      }, { onConflict: 'usuario_id' })

    if (err) throw err
    setDatosFiscales(datos)
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

    const { data, count } = await query
    setTodasFacturas(data || [])
    setTodasFacturasTotal(count || 0)
  }, [todasFacturasFiltroUsuario])

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
    const { data, error: err } = await supabase.rpc('ventas_solicitar_retiro', {
      p_usuario_id: user.id,
      p_monto: monto,
    })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error || 'Error al solicitar retiro')
    refrescar()
    return data
  }, [user?.id, refrescar])

  // ── Admin: aprobar retiro ──────────────────────────────────────────
  const aprobarRetiro = useCallback(async (retiroId) => {
    const { data, error: err } = await supabase.rpc('ventas_aprobar_retiro', { p_retiro_id: retiroId })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error || 'Error al aprobar retiro')
    refrescar()
    return data
  }, [refrescar])

  // ── Admin: rechazar retiro ─────────────────────────────────────────
  const rechazarRetiro = useCallback(async (retiroId, motivo) => {
    const { data, error: err } = await supabase.rpc('ventas_rechazar_retiro', {
      p_retiro_id: retiroId,
      p_motivo: motivo || null,
    })
    if (err) throw err
    if (data && !data.ok) throw new Error(data.error || 'Error al rechazar retiro')
    refrescar()
    return data
  }, [refrescar])

  // ── Refresh on tab focus ───────────────────────────────────────────
  useRefreshOnFocus(refrescar, { enabled: !!user?.id })

  // ── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id && rolesComerciales.length > 0) {
      refrescar()
    }
  }, [user?.id, rolesComerciales.length])

  // ── Reload comisiones on filter change ─────────────────────────────
  useEffect(() => {
    if (user?.id) cargarComisiones()
  }, [comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesPagina, comisionesUsuarioId])

  // ── Reload admin retiros on filter change ──────────────────────────
  useEffect(() => {
    if (esAdmin) cargarTodosRetiros()
  }, [todosRetirosFiltro])

  // ── Reload admin facturas on filter change ─────────────────────────
  useEffect(() => {
    if (esAdmin) cargarTodasFacturas()
  }, [todasFacturasFiltroUsuario])

  return {
    wallet, saldoDisponible, comisiones, comisionesTotal, comisionesPagina,
    retiros, retirosTotal, facturas, facturasTotal,
    datosFiscales, empresaFiscal, closerAlDia, loading, error,
    esAdmin, esCloser, miembros,

    todosRetiros, todosRetirosTotal, todosRetirosFiltro,
    todasFacturas, todasFacturasTotal, todasFacturasFiltroUsuario,
    contadoresRetiros,

    comisionesFiltroTipo, comisionesFiltroDesde, comisionesFiltroHasta, comisionesUsuarioId,

    setComisionesPagina,
    setComisionesFiltroTipo,
    setComisionesFiltroDesde,
    setComisionesFiltroHasta,
    setComisionesUsuarioId,
    setTodosRetirosFiltro,
    setTodasFacturasFiltroUsuario,

    cargarWallet, cargarSaldoDisponible, cargarComisiones, cargarRetiros,
    cargarFacturas, cargarDatosFiscales, cargarEmpresaFiscal, verificarCloserAlDia,
    guardarDatosFiscales, solicitarRetiro,

    cargarTodosRetiros, cargarTodasFacturas, cargarContadoresRetiros,
    aprobarRetiro, rechazarRetiro,

    refrescar,
    comisionesPageSize: COMISIONES_PAGE_SIZE,
  }
}
