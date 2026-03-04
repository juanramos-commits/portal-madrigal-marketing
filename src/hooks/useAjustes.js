import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logActividad } from '../lib/logActividad'

export function useAjustes() {
  const { user, usuario, rolesComerciales, refrescarRolesComerciales } = useAuth()

  const [loading, setLoading] = useState(false)
  const [seccionActiva, setSeccionActiva] = useState('perfil')

  // Roles
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
    logActividad('ajustes', 'editar', `Perfil actualizado: ${datos.nombre}`, { entidad: 'perfil' })
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
    logActividad('ajustes', 'editar', 'Contraseña cambiada')
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
    const { data, error } = await supabase
      .from('ventas_pipelines')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (error) { console.error('[Pipelines] Error cargando:', error); return }
    setPipelines(data || [])
  }, [])

  const cargarEtapas = useCallback(async (pipelineId) => {
    let query = supabase
      .from('ventas_etapas')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (pipelineId) query = query.eq('pipeline_id', pipelineId)
    const { data, error } = await query
    if (error) { console.error('[Etapas] Error cargando:', error); return }
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
    logActividad('ajustes', 'crear', `Etapa creada: ${datos.nombre}`, { entidad: 'etapa', entidad_id: data.id })
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
    logActividad('ajustes', 'editar', `Etapa editada: ${data.nombre}`, { entidad: 'etapa', entidad_id: etapaId })
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
    logActividad('ajustes', 'eliminar', 'Etapa eliminada', { entidad: 'etapa', entidad_id: etapaId })
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
    const { data, error } = await supabase
      .from('ventas_paquetes')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    if (error) { console.error('[Paquetes] Error cargando:', error); return }
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
    logActividad('ajustes', 'crear', `Paquete creado: ${datos.nombre}`, { entidad: 'paquete', entidad_id: data.id })
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
    logActividad('ajustes', 'editar', `Paquete editado: ${data.nombre}`, { entidad: 'paquete', entidad_id: id })
  }, [])

  const eliminarPaquete = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_paquetes')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    setPaquetes(prev => prev.filter(p => p.id !== id))
    logActividad('ajustes', 'eliminar', 'Paquete eliminado', { entidad: 'paquete', entidad_id: id })
  }, [])

  // ═══ CATEGORÍAS ═══
  const cargarCategorias = useCallback(async () => {
    const { data, error } = await supabase
      .from('ventas_categorias')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (error) { console.error('[Categorias] Error cargando:', error); return }
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
    logActividad('ajustes', 'crear', `Categoría creada: ${datos.nombre}`, { entidad: 'categoria', entidad_id: data.id })
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
    logActividad('ajustes', 'editar', `Categoría editada: ${data.nombre}`, { entidad: 'categoria', entidad_id: id })
  }, [])

  const eliminarCategoria = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_categorias')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    setCategorias(prev => prev.filter(c => c.id !== id))
    logActividad('ajustes', 'eliminar', 'Categoría eliminada', { entidad: 'categoria', entidad_id: id })
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
    const { data, error } = await supabase
      .from('ventas_comisiones_config')
      .select('*')
      .eq('activo', true)
      .order('rol')
    if (error) { console.error('[Comisiones] Error cargando:', error); return }
    setComisionesConfig(data || [])
  }, [])

  const guardarComisionesConfig = useCallback(async (configs) => {
    const updates = configs.map(cfg =>
      supabase
        .from('ventas_comisiones_config')
        .update({
          comision_fija: cfg.comision_fija,
          bonus_pago_unico: cfg.bonus_pago_unico,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cfg.id)
    )
    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)
    if (failed) throw failed.error
    setComisionesConfig(configs)
    logActividad('ajustes', 'editar', 'Comisiones configuradas', { entidad: 'comisiones' })
  }, [])

  const asignarBonusManual = useCallback(async (datos) => {
    const monto = Number(datos.monto)
    const { error } = await supabase
      .from('ventas_comisiones')
      .insert({
        usuario_id: datos.usuario_id,
        monto,
        concepto: datos.concepto || 'Bonus manual',
        es_bonus: true,
        es_bonus_manual: true,
        disponible_desde: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    if (error) throw error
    // Atomic wallet balance increment via RPC or fallback to optimistic update
    const { error: rpcError } = await supabase.rpc('incrementar_wallet', {
      p_usuario_id: datos.usuario_id,
      p_monto: monto,
    })
    if (rpcError) {
      // Fallback: read-then-write (less safe but functional if RPC doesn't exist)
      console.warn('[Bonus] RPC not available, using fallback:', rpcError.message)
      const { data: wallet } = await supabase
        .from('ventas_wallet')
        .select('saldo, total_ganado')
        .eq('usuario_id', datos.usuario_id)
        .single()
      if (wallet) {
        const { error: updateError } = await supabase
          .from('ventas_wallet')
          .update({
            saldo: (wallet.saldo || 0) + monto,
            total_ganado: (wallet.total_ganado || 0) + monto,
            updated_at: new Date().toISOString(),
          })
          .eq('usuario_id', datos.usuario_id)
        if (updateError) throw updateError
      }
    }
    logActividad('wallet', 'crear', `Bonus manual: ${monto}€ — ${datos.concepto || 'Bonus manual'}`, { entidad: 'comision' })
  }, [])

  // ═══ EMPRESA FISCAL ═══
  const cargarEmpresaFiscal = useCallback(async () => {
    const { data, error } = await supabase
      .from('ventas_empresa_fiscal')
      .select('*')
      .limit(1)
      .maybeSingle()
    if (error) { console.error('[EmpresaFiscal] Error cargando:', error); return }
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
    logActividad('ajustes', 'editar', 'Datos fiscales empresa actualizados', { entidad: 'empresa_fiscal' })
  }, [empresaFiscal])

  // ═══ EQUIPO ═══
  const cargarEquipo = useCallback(async () => {
    // Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('ventas_roles_comerciales')
      .select('*')
      .order('created_at', { ascending: false })
    if (rolesError) { console.error('[Equipo] Error cargando roles:', rolesError); return }

    // Fetch user details separately to avoid FK join hangs
    const userIds = [...new Set((rolesData || []).map(r => r.usuario_id))]
    let usersMap = {}
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('usuarios')
        .select('id, nombre, email, avatar_url')
        .in('id', userIds)
      for (const u of (usersData || [])) usersMap[u.id] = u
    }

    // Group by usuario
    const map = {}
    for (const r of (rolesData || [])) {
      if (!map[r.usuario_id]) {
        map[r.usuario_id] = {
          usuario_id: r.usuario_id,
          usuario: usersMap[r.usuario_id] || null,
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
    await Promise.all([cargarEquipo(), refrescarRolesComerciales()])
    logActividad('ajustes', 'crear', `Rol asignado: ${roles.join(', ')}`, { entidad: 'equipo' })
  }, [cargarEquipo, refrescarRolesComerciales])

  const editarRoles = useCallback(async (usuarioId, rolesNuevos) => {
    // Delete existing roles for user
    const { error: delError } = await supabase
      .from('ventas_roles_comerciales')
      .delete()
      .eq('usuario_id', usuarioId)
    if (delError) throw delError
    // Insert new
    if (rolesNuevos.length > 0) {
      const inserts = rolesNuevos.map(rol => ({
        usuario_id: usuarioId,
        rol,
        activo: true,
      }))
      const { error } = await supabase.from('ventas_roles_comerciales').insert(inserts)
      if (error) throw error
    }
    await Promise.all([cargarEquipo(), refrescarRolesComerciales()])
    logActividad('ajustes', 'editar', `Roles editados: ${rolesNuevos.join(', ')}`, { entidad: 'equipo' })
  }, [cargarEquipo, refrescarRolesComerciales])

  const desactivarMiembro = useCallback(async (usuarioId, activar) => {
    const { error } = await supabase
      .from('ventas_roles_comerciales')
      .update({ activo: activar })
      .eq('usuario_id', usuarioId)
    if (error) throw error
    await Promise.all([cargarEquipo(), refrescarRolesComerciales()])
    logActividad('ajustes', 'editar', `Miembro ${activar ? 'activado' : 'desactivado'}`, { entidad: 'equipo' })
  }, [cargarEquipo, refrescarRolesComerciales])

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
    logActividad('ajustes', 'crear', `Webhook creado: ${datos.nombre}`, { entidad: 'webhook', entidad_id: data.id })
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
    logActividad('ajustes', 'editar', `Webhook editado: ${data.nombre}`, { entidad: 'webhook', entidad_id: id })
  }, [])

  const eliminarWebhook = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_webhooks')
      .delete()
      .eq('id', id)
    if (error) throw error
    setWebhooks(prev => prev.filter(w => w.id !== id))
    logActividad('ajustes', 'eliminar', 'Webhook eliminado', { entidad: 'webhook', entidad_id: id })
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
    const { data, error } = await supabase
      .from('ventas_reunion_estados')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (error) { console.error('[ReunionEstados] Error cargando:', error); return }
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
    logActividad('ajustes', 'crear', `Estado reunión creado: ${datos.nombre}`, { entidad: 'reunion_estado', entidad_id: data.id })
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
    logActividad('ajustes', 'editar', `Estado reunión editado: ${data.nombre}`, { entidad: 'reunion_estado', entidad_id: id })
  }, [])

  const eliminarEstado = useCallback(async (id) => {
    const { error } = await supabase
      .from('ventas_reunion_estados')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    setReunionEstados(prev => prev.filter(e => e.id !== id))
    logActividad('ajustes', 'eliminar', 'Estado reunión eliminado', { entidad: 'reunion_estado', entidad_id: id })
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
    const { data, error } = await supabase
      .from('ventas_campos_obligatorios')
      .select('*')
      .order('campo')
    if (error) { console.error('[CamposObligatorios] Error cargando:', error); return }
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
    const { data, error } = await supabase
      .from('ventas_reparto_config')
      .select('*')
      .order('updated_at', { ascending: false, nullsFirst: false })
    if (error) { console.error('[Reparto] Error cargando config:', error); return }
    setRepartoConfig((data || []).map(r => ({ ...r, usuario_id: r.setter_id })))
  }, [])

  const guardarReparto = useCallback(async (configs) => {
    // Delete existing
    const { error: delError } = await supabase.from('ventas_reparto_config').delete().gte('id', '00000000-0000-0000-0000-000000000000')
    if (delError) throw delError
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
    logActividad('ajustes', 'editar', 'Reparto configurado', { entidad: 'reparto' })
  }, [cargarReparto])

  // ═══ LOG ACTIVIDAD ═══
  const cargarActividad = useCallback(async (filtros = {}, pagina = 0, porPagina = 50) => {
    let query = supabase
      .from('ventas_log_global')
      .select('*, usuario:usuarios(id, nombre, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagina * porPagina, (pagina + 1) * porPagina - 1)

    if (filtros.usuario_id) query = query.eq('usuario_id', filtros.usuario_id)
    if (filtros.modulo) query = query.eq('modulo', filtros.modulo)
    if (filtros.accion) query = query.eq('accion', filtros.accion)
    if (filtros.desde) query = query.gte('created_at', filtros.desde)
    if (filtros.hasta) query = query.lte('created_at', filtros.hasta)

    const { data, count, error } = await query
    if (error) { console.error('[Actividad] Error cargando:', error); return }
    setActividad(data || [])
    setActividadTotal(count || 0)
  }, [])

  // ═══ REFRESH ═══
  const refrescar = useCallback(async () => {
    setLoading(true)
    try {
      await cargarPerfil()
    } catch (err) {
      console.warn('Error al refrescar perfil:', err)
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
