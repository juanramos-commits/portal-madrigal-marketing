import { logger } from '../lib/logger'
import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { logActividad } from '../lib/logActividad'
import { invalidateAll } from '../lib/cache'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [permisos, setPermisos] = useState([])
  const [permisosLoaded, setPermisosLoaded] = useState(false)
  const [permisosError, setPermisosError] = useState(null)
  const [rolesComerciales, setRolesComerciales] = useState([])
  const [loading, setLoading] = useState(true)
  const isSigningIn = useRef(false)

  const cargarUsuario = useCallback(async (email, { esLoginFresco = false, _retry = 0 } = {}) => {
    try {
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('*, rol:roles(id, nombre, nivel, color)')
        .eq('email', email)
        .single()

      if (usuarioError) {
        logger.error('Error cargando usuario:', usuarioError)
        // Retry once on transient errors (AbortError, network issues)
        if (_retry < 1) {
          logger.warn('Reintentando cargarUsuario...')
          await new Promise(r => setTimeout(r, 1000))
          return cargarUsuario(email, { esLoginFresco, _retry: _retry + 1 })
        }
        return null
      }

      if (!usuarioData.activo) {
        return { ...usuarioData, desactivado: true }
      }

      setUsuario(usuarioData)

      // Cargar permisos
      setPermisosError(null)
      try {
        if (usuarioData.tipo === 'super_admin') {
          const { data: todosPermisos, error: permErr } = await supabase.from('permisos').select('codigo')
          if (permErr) throw permErr
          setPermisos(todosPermisos?.map(p => p.codigo) || [])
        } else {
          // Cargar permisos base del rol + permisos ventas comerciales en paralelo
          const [permisosRes, ventasRes] = await Promise.all([
            supabase.rpc('obtener_permisos_usuario', { p_usuario_id: usuarioData.id }),
            supabase.rpc('obtener_permisos_ventas_usuario', { p_usuario_id: usuarioData.id }),
          ])
          if (permisosRes.error) logger.error('Error cargando permisos base:', permisosRes.error)
          if (ventasRes.error) logger.error('Error cargando permisos ventas:', ventasRes.error)
          // If BOTH fail, throw so user sees error + retry
          if (permisosRes.error && ventasRes.error) throw permisosRes.error
          const base = permisosRes.data?.map(p => p.codigo) || []
          const ventas = ventasRes.data?.map(p => p.codigo) || []
          setPermisos([...new Set([...base, ...ventas])])
        }
        setPermisosLoaded(true)
      } catch (permError) {
        logger.error('Error crítico cargando permisos:', permError)
        setPermisosError(permError.message || 'Error cargando permisos')
        setPermisosLoaded(true) // Mark as loaded so SmartRedirect doesn't hang
      }

      // Actualizar ultimo acceso solo en login fresco (evita PATCH 400 por JWT en refresh)
      if (esLoginFresco) {
        supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', usuarioData.id).then(
          ({ error }) => { if (error) logger.error('Error actualizando ultimo_acceso:', error) },
          (err) => logger.error('Error de red actualizando ultimo_acceso:', err)
        )
      }

      return usuarioData
    } catch (error) {
      logger.error('Error en cargarUsuario:', error)
      // Retry once on transient errors (AbortError, network issues)
      if (_retry < 1) {
        logger.warn('Reintentando cargarUsuario tras excepción...')
        await new Promise(r => setTimeout(r, 1000))
        return cargarUsuario(email, { esLoginFresco, _retry: _retry + 1 })
      }
      return null
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let initialSessionHandled = false

    const isAuthPage = () => ['/activar-cuenta', '/reset-password'].some(p => window.location.pathname.startsWith(p))

    // Obtener sesión inicial primero
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      initialSessionHandled = true
      if (session?.user) {
        setUser(session.user)
        if (!isAuthPage()) {
          const resultado = await cargarUsuario(session.user.email)
          // Si no se pudo cargar el usuario, la sesión puede estar corrupta
          if (!resultado) {
            logger.warn('No se pudo cargar usuario, verificando sesión...')
            const { data: { user: validUser }, error: userError } = await supabase.auth.getUser()
            if (userError || !validUser) {
              logger.warn('Sesión inválida, limpiando...')
              await supabase.auth.signOut()
              setUser(null)
            }
          }
        }
      }
      setLoading(false)
    }).catch(async (err) => {
      logger.error('Error en getSession:', err)
      // Sesión corrupta (AbortError, etc.) — limpiar para evitar bucle infinito
      try {
        await supabase.auth.signOut()
      } catch (_) { /* ignore */ }
      if (mounted) {
        setUser(null)
        setUsuario(null)
        setPermisos([])
        setPermisosLoaded(false)
        setPermisosError(null)
        setRolesComerciales([])
        setLoading(false)
      }
    })

    // Escuchar cambios de auth posteriores (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      logger.log('Auth event:', event)

      // Ignorar el INITIAL_SESSION ya que lo manejamos con getSession
      if (event === 'INITIAL_SESSION') return

      // En token refresh solo actualizar el user, no recargar todo
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) setUser(session.user)
        return
      }

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUsuario(null)
        setPermisos([])
        setRolesComerciales([])
        setLoading(false)
        return
      }

      if (session?.user) {
        setUser(session.user)
        if (!isSigningIn.current && !isAuthPage()) {
          await cargarUsuario(session.user.email)
        }
      } else {
        setUser(null)
        setUsuario(null)
        setPermisos([])
        setPermisosLoaded(false)
        setPermisosError(null)
        setRolesComerciales([])
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [cargarUsuario])

  // Session health check — only runs when a user is logged in
  useEffect(() => {
    if (!usuario?.id) return
    const healthCheck = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          logger.warn('Session expired, signing out...')
          setUser(null)
          setUsuario(null)
          setPermisos([])
          setPermisosLoaded(false)
          setPermisosError(null)
          setRolesComerciales([])
        }
      } catch {
        // Network error — ignore, will retry next interval
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(healthCheck)
  }, [usuario?.id])

  const tienePermiso = useCallback((permiso) => {
    if (usuario?.tipo === 'super_admin') return true
    return permisos.includes(permiso)
  }, [usuario, permisos])

  // Refrescar permisos sin logout (tras cambios de admin)
  const refrescarPermisos = useCallback(async () => {
    if (!usuario?.id) return
    setPermisosError(null)
    try {
      if (usuario.tipo === 'super_admin') {
        const { data: todosPermisos, error: permErr } = await supabase.from('permisos').select('codigo')
        if (permErr) throw permErr
        setPermisos(todosPermisos?.map(p => p.codigo) || [])
      } else {
        const [permisosRes, ventasRes] = await Promise.all([
          supabase.rpc('obtener_permisos_usuario', { p_usuario_id: usuario.id }),
          supabase.rpc('obtener_permisos_ventas_usuario', { p_usuario_id: usuario.id }),
        ])
        if (permisosRes.error && ventasRes.error) throw permisosRes.error
        const base = permisosRes.data?.map(p => p.codigo) || []
        const ventas = ventasRes.data?.map(p => p.codigo) || []
        setPermisos([...new Set([...base, ...ventas])])
      }
    } catch (err) {
      logger.error('Error refrescando permisos:', err)
      setPermisosError(err.message || 'Error refrescando permisos')
    }
  }, [usuario?.id, usuario?.tipo])

  // Cargar roles comerciales una sola vez después de auth
  const refrescarRolesComerciales = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_roles_comerciales')
      .select('*, usuario:usuarios(id, nombre, email, avatar_url)')
      .eq('activo', true)
    setRolesComerciales(data || [])
  }, [user?.id])

  // Trigger: usuario.id (stable primitive) avoids re-firing on object reference changes
  useEffect(() => {
    if (!usuario?.id) return
    refrescarRolesComerciales()
  }, [usuario?.id, refrescarRolesComerciales])

  // PERF: useCallback stabilizes identity so useMemo(value) doesn't invalidate on every render
  const signInWithEmail = useCallback(async (email, password) => {
    isSigningIn.current = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data.user) {
        const usuarioData = await cargarUsuario(data.user.email, { esLoginFresco: true })
        if (usuarioData?.desactivado) {
          await supabase.auth.signOut()
          return { data: null, error: { message: 'CUENTA_DESACTIVADA' } }
        }
        // Registrar login en auditoría
        if (usuarioData?.id) {
          try {
            await supabase.rpc('registrar_auditoria', {
              p_usuario_id: usuarioData.id,
              p_accion: 'LOGIN',
              p_categoria: 'auth',
              p_descripcion: `Inicio de sesión: ${usuarioData.email}`,
            })
          } catch (e) {
            logger.error('Error registrando login en auditoría:', e)
          }
          logActividad('auth', 'login', `Inicio de sesión: ${usuarioData.email}`)
        }
      }
      return { data, error }
    } finally {
      isSigningIn.current = false
    }
  }, [cargarUsuario])

  // PERF: useCallback stabilizes identity; reads usuario via ref to avoid dep on object
  const usuarioRef = useRef(usuario)
  usuarioRef.current = usuario

  const signOut = useCallback(async () => {
    const usr = usuarioRef.current
    // Registrar logout en auditoría antes de cerrar sesión
    if (usr?.id) {
      try {
        await supabase.rpc('registrar_auditoria', {
          p_usuario_id: usr.id,
          p_accion: 'LOGOUT',
          p_categoria: 'auth',
          p_descripcion: `Cierre de sesión: ${usr.email}`,
        })
      } catch (e) {
        logger.error('Error registrando logout en auditoría:', e)
      }
      logActividad('auth', 'logout', `Cierre de sesión: ${usr.email}`)
    }
    setUser(null)
    setUsuario(null)
    setPermisos([])
    setPermisosLoaded(false)
    setPermisosError(null)
    setRolesComerciales([])
    invalidateAll()
    return supabase.auth.signOut()
  }, [])

  // PERF: stable callback avoids new function in useMemo value
  const refrescarUsuario = useCallback(
    () => user?.email && cargarUsuario(user.email),
    [user?.email, cargarUsuario]
  )

  // PERF: memoize Provider value — without this, every AuthProvider render
  // creates a new object and re-renders ALL useAuth() consumers
  const value = useMemo(() => ({
    user,
    usuario,
    permisos,
    permisosLoaded,
    permisosError,
    rolesComerciales,
    loading,
    tienePermiso,
    signInWithEmail,
    signOut,
    refrescarUsuario,
    refrescarPermisos,
    refrescarRolesComerciales,
  }), [user, usuario, permisos, permisosLoaded, permisosError, rolesComerciales, loading, tienePermiso,
       signInWithEmail, signOut, refrescarUsuario, refrescarPermisos, refrescarRolesComerciales])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
