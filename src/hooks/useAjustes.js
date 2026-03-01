import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useAjustes() {
  const { user, usuario } = useAuth()

  const [loading, setLoading] = useState(false)
  const [seccionActiva, setSeccionActiva] = useState('perfil')

  // Roles
  const [rolesComerciales, setRolesComerciales] = useState([])
  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esCloser = misRoles.some(r => r.rol === 'closer')
  const esSetter = misRoles.some(r => r.rol === 'setter')
  const esDirector = misRoles.some(r => r.rol === 'director_ventas') || esAdmin

  // Perfil
  const [perfil, setPerfil] = useState(null)

  // Tema
  const [tema, setTemaState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ventas-tema') || 'dark'
    }
    return 'dark'
  })

  // Pipelines & etapas
  const [pipelines, setPipelines] = useState([])
  const [etapas, setEtapas] = useState([])

  // Paquetes
  const [paquetes, setPaquetes] = useState([])

  // Categorías
  const [categorias, setCategorias] = useState([])

  // Comisiones config
  const [comisionesConfig, setComisionesConfig] = useState([])

  // Empresa fiscal
  const [empresaFiscal, setEmpresaFiscal] = useState(null)

  // Equipo
  const [equipo, setEquipo] = useState([])

  // Webhooks
  const [webhooks, setWebhooks] = useState([])

  // Reunión estados
  const [reunionEstados, setReunionEstados] = useState([])

  // Campos obligatorios
  const [camposObligatorios, setCamposObligatorios] = useState([])

  // Reparto
  const [repartoConfig, setRepartoConfig] = useState([])

  // Actividad
  const [actividad, setActividad] = useState([])
  const [actividadTotal, setActividadTotal] = useState(0)

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

  // ═══ PERFIL ═══
  const cargarPerfil = useCallback(async () => {
    if (!user?.id) return
    setPerfil({
      id: user.id,
      nombre: usuario?.nombre || '',
      email: usuario?.email || user.email || '',
      tipo: usuario?.tipo,
      avatar_url: usuario?.avatar_url || null,
    })
  }, [user, usuario])

  const guardarPerfil = useCallback(async (datos) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: datos.nombre, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) throw error
    setPerfil(prev => ({ ...prev, nombre: datos.nombre }))
  }, [user?.id])

  const subirFotoPerfil = useCallback(async (file) => {
    if (!user?.id) throw new Error('No autenticado')
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('perfiles')
      .upload(path, file, { upsert: true })
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('perfiles')
      .getPublicUrl(path)

    const fotoUrl = urlData.publicUrl + '?t=' + Date.now()
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ avatar_url: fotoUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (updateError) throw updateError

    setPerfil(prev => ({ ...prev, avatar_url: fotoUrl }))
    return fotoUrl
  }, [user?.id])

  const cambiarContrasena = useCallback(async (nueva) => {
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) throw error
  }, [])

  // ═══ TEMA ═══
  const setTema = useCallback((nuevoTema) => {
    setTemaState(nuevoTema)
    localStorage.setItem('ventas-tema', nuevoTema)

    if (nuevoTema === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      document.documentElement.setAttribute('data-theme', nuevoTema)
    }
  }, [])

  // Apply theme on mount
  useEffect(() => {
    if (tema === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
      apply()
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    } else {
      document.documentElement.setAttribute('data-theme', tema)
    }
  }, [tema])

  // ═══ PIPELINES & ETAPAS ═══
  const cargarPipelines = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_pipelines')
      .select('*')
      .eq('activo', true)
      .order('orden')
    setPipelines(data || [])
  }, [])

  const cargarEtapas = useCallback(async (pipelineId) => {
    let query = supabase
      .from('ventas_etapas')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (pipelineId) query = query.eq('pipeline_id', pipelineId)
    const { data } = await query
    setEtapas(data || [])
  }, [])

  const crearEtapa = useCallback(async (datos) => {
    const maxOrden = etapas.filter(e => e.pipeline_id === datos.pipeline_id)
      .reduce((max, e) => Math.max(max, e.orden || 0), 0)
    const { data, error } = await supabase
      .from('ventas_etapas')
      .insert({ ...datos, orden: maxOrden + 1, activo: true })
      .select()
      .single()
    if (error) throw error
    setEtapas(prev => [...prev, data])
    return data
  }, [etapas])

  const editarEtapa = useCallback(async (etapaId, datos) => {
    const { data, error } = await supabase
      .from('ventas_etapas')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', etapaId)
      .select()
      .single()
    if (error) throw error
    setEtapas(prev => prev.map(e => e.id === etapaId ? data : e))
    return data
  }, [])

  const eliminarEtapa = useCallback(async (etapaId) => {
    // Check if leads exist in this stage
    const { count } = await supabase
      .from('ventas_leads')
      .select('*', { count: 'exact', head: true })
      .eq('etapa_id', etapaId)
    if (count > 0) {
      throw new Error(`No se puede eliminar: hay ${count} lead${count === 1 ? '' : 's'} en esta etapa. Muévelos primero.`)
    }
    const { error } = await supabase
      .from('ventas_etapas')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', etapaId)
    if (error) throw error
    setEtapas(prev => prev.filter(e => e.id !== etapaId))
  }, [])

  const reordenarEtapas = useCallback(async (pipelineId, nuevasIds) => {
    const other = etapas.filter(e => e.pipeline_id !== pipelineId)
    const reordered = nuevasIds.map((id, i) => {
      const e = etapas.find(x => x.id === id)
      return { ...e, orden: i + 1 }
    })
    setEtapas([...other, ...reordered])

    const updates = nuevasIds.map((id, i) =>
      supabase.from('ventas_etapas').update({ orden: i + 1 }).eq('id', id)
    )
    await Promise.all(updates)
  }, [etapas])

  // ═══ PAQUETES ═══
  const cargarPaquetes = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_paquetes')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    setPaquetes(data || [])
  }, [])

  const crearPaquete = useCallback(async (datos) => {
    const { data, error } = await supabase
      .from('ventas_paquetes')
      .insert({ ...datos, activo: true })
      .select()
      .single()
    if (error) throw error
    setPaquetes(prev => [...prev, data])
    return data
  }, [])

  const editarPaquete = useCallback(async (id, datos) => {
    const { data, error } = await supabase
      .from('ventas_paquetes')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setPaquetes(prev => prev.map(p => p.id === id ? data : p))
  }, [])

  const eliminarPaquete = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_paquetes')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    setPaquetes(prev => prev.filter(p => p.id !== id))
  }, [])

  // ═══ CATEGORÍAS ═══
  const cargarCategorias = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_categorias')
      .select('*')
      .eq('activo', true)
      .order('orden')
    setCategorias(data || [])
  }, [])

  const crearCategoria = useCallback(async (datos) => {
    const maxOrden = categorias.reduce((max, c) => Math.max(max, c.orden || 0), 0)
    const { data, error } = await supabase
      .from('ventas_categorias')
      .insert({ ...datos, orden: maxOrden + 1, activo: true })
      .select()
      .single()
    if (error) throw error
    setCategorias(prev => [...prev, data])
    return data
  }, [categorias])

  const editarCategoria = useCallback(async (id, datos) => {
    const { data, error } = await supabase
      .from('ventas_categorias')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setCategorias(prev => prev.map(c => c.id === id ? data : c))
  }, [])

  const eliminarCategoria = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_categorias')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    setCategorias(prev => prev.filter(c => c.id !== id))
  }, [])

  const reordenarCategorias = useCallback(async (nuevasIds) => {
    const reordered = nuevasIds.map((id, i) => {
      const c = categorias.find(x => x.id === id)
      return { ...c, orden: i + 1 }
    })
    setCategorias(reordered)
    const updates = nuevasIds.map((id, i) =>
      supabase.from('ventas_categorias').update({ orden: i + 1 }).eq('id', id)
    )
    await Promise.all(updates)
  }, [categorias])

  // ═══ COMISIONES CONFIG ═══
  const cargarComisionesConfig = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_comisiones_config')
      .select('*')
      .eq('activo', true)
      .order('rol')
    setComisionesConfig(data || [])
  }, [])

  const guardarComisionesConfig = useCallback(async (configs) => {
    for (const cfg of configs) {
      const { error } = await supabase
        .from('ventas_comisiones_config')
        .update({
          comision_fija: cfg.comision_fija,
          bonus_pago_unico: cfg.bonus_pago_unico,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cfg.id)
      if (error) throw error
    }
    setComisionesConfig(configs)
  }, [])

  const asignarBonusManual = useCallback(async (datos) => {
    const { error } = await supabase
      .from('ventas_comisiones')
      .insert({
        usuario_id: datos.usuario_id,
        monto: datos.monto,
        concepto: datos.concepto || 'Bonus manual',
        es_bonus_manual: true,
        disponible_desde: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    if (error) throw error
    // Update wallet balance
    const { data: wallet } = await supabase
      .from('ventas_wallets')
      .select('saldo_total')
      .eq('usuario_id', datos.usuario_id)
      .single()
    if (wallet) {
      await supabase
        .from('ventas_wallets')
        .update({
          saldo_total: (wallet.saldo_total || 0) + Number(datos.monto),
          updated_at: new Date().toISOString(),
        })
        .eq('usuario_id', datos.usuario_id)
    }
  }, [])

  // ═══ EMPRESA FISCAL ═══
  const cargarEmpresaFiscal = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_empresa_fiscal')
      .select('*')
      .limit(1)
      .single()
    setEmpresaFiscal(data || null)
  }, [])

  const guardarEmpresaFiscal = useCallback(async (datos) => {
    if (empresaFiscal?.id) {
      const { data, error } = await supabase
        .from('ventas_empresa_fiscal')
        .update({ ...datos, updated_at: new Date().toISOString() })
        .eq('id', empresaFiscal.id)
        .select()
        .single()
      if (error) throw error
      setEmpresaFiscal(data)
    } else {
      const { data, error } = await supabase
        .from('ventas_empresa_fiscal')
        .insert(datos)
        .select()
        .single()
      if (error) throw error
      setEmpresaFiscal(data)
    }
  }, [empresaFiscal])

  // ═══ EQUIPO ═══
  const cargarEquipo = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_roles_comerciales')
      .select('*, usuario:usuarios(id, nombre, email, avatar_url)')
      .order('created_at', { ascending: false })
    // Group by usuario
    const map = {}
    for (const r of (data || [])) {
      if (!map[r.usuario_id]) {
        map[r.usuario_id] = {
          usuario_id: r.usuario_id,
          usuario: r.usuario,
          roles: [],
          activo: false,
        }
      }
      map[r.usuario_id].roles.push({ id: r.id, rol: r.rol, activo: r.activo })
      if (r.activo) map[r.usuario_id].activo = true
    }
    setEquipo(Object.values(map))
  }, [])

  const asignarRolComercial = useCallback(async (usuarioId, roles) => {
    const inserts = roles.map(rol => ({
      usuario_id: usuarioId,
      rol,
      activo: true,
    }))
    const { error } = await supabase
      .from('ventas_roles_comerciales')
      .insert(inserts)
    if (error) throw error
    await cargarEquipo()
  }, [cargarEquipo])

  const editarRoles = useCallback(async (usuarioId, rolesNuevos) => {
    // Delete existing roles for user
    await supabase
      .from('ventas_roles_comerciales')
      .delete()
      .eq('usuario_id', usuarioId)
    // Insert new
    if (rolesNuevos.length > 0) {
      const inserts = rolesNuevos.map(rol => ({
        usuario_id: usuarioId,
        rol,
        activo: true,
      }))
      await supabase.from('ventas_roles_comerciales').insert(inserts)
    }
    await cargarEquipo()
  }, [cargarEquipo])

  const desactivarMiembro = useCallback(async (usuarioId, activar) => {
    const { error } = await supabase
      .from('ventas_roles_comerciales')
      .update({ activo: activar, updated_at: new Date().toISOString() })
      .eq('usuario_id', usuarioId)
    if (error) throw error
    await cargarEquipo()
  }, [cargarEquipo])

  // ═══ WEBHOOKS ═══
  const cargarWebhooks = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_webhooks')
      .select('*')
      .order('created_at', { ascending: false })
    setWebhooks(data || [])
  }, [])

  const crearWebhook = useCallback(async (datos) => {
    const token = crypto.randomUUID()
    const { data, error } = await supabase
      .from('ventas_webhooks')
      .insert({
        nombre: datos.nombre,
        fuente: datos.fuente || null,
        endpoint_token: token,
        mapeo_campos: datos.mapeo_campos || {},
        activo: true,
      })
      .select()
      .single()
    if (error) throw error
    setWebhooks(prev => [data, ...prev])
    return data
  }, [])

  const editarWebhook = useCallback(async (id, datos) => {
    const { data, error } = await supabase
      .from('ventas_webhooks')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setWebhooks(prev => prev.map(w => w.id === id ? data : w))
  }, [])

  const eliminarWebhook = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_webhooks')
      .delete()
      .eq('id', id)
    if (error) throw error
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }, [])

  const guardarMapeo = useCallback(async (webhookId, mapeo) => {
    const { error } = await supabase
      .from('ventas_webhooks')
      .update({ mapeo_campos: mapeo, updated_at: new Date().toISOString() })
      .eq('id', webhookId)
    if (error) throw error
    setWebhooks(prev => prev.map(w => w.id === webhookId ? { ...w, mapeo_campos: mapeo } : w))
  }, [])

  const cargarWebhookLogs = useCallback(async (webhookId) => {
    const { data } = await supabase
      .from('ventas_webhook_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(50)
    return data || []
  }, [])

  // ═══ REUNIÓN ESTADOS ═══
  const cargarReunionEstados = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_reunion_estados')
      .select('*')
      .eq('activo', true)
      .order('orden')
    setReunionEstados(data || [])
  }, [])

  const crearEstado = useCallback(async (datos) => {
    const maxOrden = reunionEstados.reduce((max, e) => Math.max(max, e.orden || 0), 0)
    const { data, error } = await supabase
      .from('ventas_reunion_estados')
      .insert({ ...datos, orden: maxOrden + 1, activo: true })
      .select()
      .single()
    if (error) throw error
    setReunionEstados(prev => [...prev, data])
    return data
  }, [reunionEstados])

  const editarEstado = useCallback(async (id, datos) => {
    const { data, error } = await supabase
      .from('ventas_reunion_estados')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setReunionEstados(prev => prev.map(e => e.id === id ? data : e))
  }, [])

  const eliminarEstado = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_reunion_estados')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    setReunionEstados(prev => prev.filter(e => e.id !== id))
  }, [])

  const reordenarEstados = useCallback(async (nuevasIds) => {
    const reordered = nuevasIds.map((id, i) => {
      const e = reunionEstados.find(x => x.id === id)
      return { ...e, orden: i + 1 }
    })
    setReunionEstados(reordered)
    const updates = nuevasIds.map((id, i) =>
      supabase.from('ventas_reunion_estados').update({ orden: i + 1 }).eq('id', id)
    )
    await Promise.all(updates)
  }, [reunionEstados])

  // ═══ CAMPOS OBLIGATORIOS ═══
  const cargarCamposObligatorios = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_campos_obligatorios')
      .select('*')
      .order('campo')
    setCamposObligatorios(data || [])
  }, [])

  const toggleCampoObligatorio = useCallback(async (campoId, esObligatorio) => {
    const { error } = await supabase
      .from('ventas_campos_obligatorios')
      .update({ es_obligatorio: esObligatorio, updated_at: new Date().toISOString() })
      .eq('id', campoId)
    if (error) throw error
    setCamposObligatorios(prev =>
      prev.map(c => c.id === campoId ? { ...c, es_obligatorio: esObligatorio } : c)
    )
  }, [])

  // ═══ REPARTO ═══
  const cargarReparto = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_reparto_config')
      .select('*, usuario:usuarios!ventas_reparto_config_setter_id_fkey(id, nombre, email)')
      .order('updated_at', { ascending: false, nullsFirst: false })
    setRepartoConfig(data?.map(r => ({ ...r, usuario_id: r.setter_id })) || [])
  }, [])

  const guardarReparto = useCallback(async (configs) => {
    // Delete existing
    await supabase.from('ventas_reparto_config').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    // Insert new
    if (configs.length > 0) {
      const { error } = await supabase
        .from('ventas_reparto_config')
        .insert(configs.map(c => ({
          setter_id: c.usuario_id,
          porcentaje: c.porcentaje,
        })))
      if (error) throw error
    }
    await cargarReparto()
  }, [cargarReparto])

  // ═══ LOG ACTIVIDAD ═══
  const cargarActividad = useCallback(async (filtros = {}, pagina = 0, porPagina = 50) => {
    let query = supabase
      .from('ventas_actividad')
      .select('*, usuario:usuarios(id, nombre, email), lead:ventas_leads(id, nombre)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagina * porPagina, (pagina + 1) * porPagina - 1)

    if (filtros.usuario_id) query = query.eq('usuario_id', filtros.usuario_id)
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
    if (filtros.desde) query = query.gte('created_at', filtros.desde)
    if (filtros.hasta) query = query.lte('created_at', filtros.hasta)

    const { data, count } = await query
    setActividad(data || [])
    setActividadTotal(count || 0)
  }, [])

  // ═══ REFRESH ═══
  const refrescar = useCallback(async () => {
    setLoading(true)
    try {
      await cargarPerfil()
    } catch (_) {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [cargarPerfil])

  // Initial load
  useEffect(() => {
    if (user?.id) {
      cargarPerfil()
    }
  }, [user?.id])

  return {
    loading, seccionActiva, setSeccionActiva,
    esAdmin, esCloser, esSetter, esDirector,
    rolesComerciales,

    // Perfil
    perfil, cargarPerfil, guardarPerfil, cambiarContrasena, subirFotoPerfil,

    // Tema
    tema, setTema,

    // Pipelines
    pipelines, etapas,
    cargarPipelines, cargarEtapas,
    crearEtapa, editarEtapa, eliminarEtapa, reordenarEtapas,

    // Paquetes
    paquetes, cargarPaquetes, crearPaquete, editarPaquete, eliminarPaquete,

    // Categorías
    categorias, cargarCategorias, crearCategoria, editarCategoria, eliminarCategoria, reordenarCategorias,

    // Comisiones
    comisionesConfig, cargarComisionesConfig, guardarComisionesConfig, asignarBonusManual,

    // Empresa fiscal
    empresaFiscal, cargarEmpresaFiscal, guardarEmpresaFiscal,

    // Equipo
    equipo, cargarEquipo, asignarRolComercial, editarRoles, desactivarMiembro,

    // Webhooks
    webhooks, cargarWebhooks, crearWebhook, editarWebhook, eliminarWebhook,
    guardarMapeo, cargarWebhookLogs,

    // Estados reunión
    reunionEstados, cargarReunionEstados, crearEstado, editarEstado, eliminarEstado, reordenarEstados,

    // Campos obligatorios
    camposObligatorios, cargarCamposObligatorios, toggleCampoObligatorio,

    // Reparto
    repartoConfig, cargarReparto, guardarReparto,

    // Log
    actividad, actividadTotal, cargarActividad,

    refrescar,
  }
}
