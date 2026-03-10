import { logger } from '../lib/logger'
import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase, smartRpc } from '../lib/supabase'
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

  // Fast path: single RPC returns user + permissions in 1 round-trip
  // Fallback: 3-query flow if the RPC doesn't exist yet (pre-migration)
  const cargarUsuario = useCallback(async (email, { esLoginFresco = false, _retry = 0 } = {}) => {
    try {
      // Try the fast single-RPC path first
      const { data: rpcResult, error: rpcError } = await supabase.rpc('obtener_usuario_completo', { p_email: email })

      let usuarioData = null

      if (!rpcError && rpcResult?.usuario) {
        // Fast path succeeded — 1 round-trip for user + permisos
        usuarioData = rpcResult.usuario
        if (!usuarioData.activo) {
          return { ...usuarioData, desactivado: true }
        }
        setUsuario(usuarioData)
        setPermisosError(null)
        setPermisos(rpcResult.permisos || [])
        setPermisosLoaded(true)
      } else {
        // Fallback: legacy 3-query flow (RPC not deployed yet)
        if (rpcError) logger.warn('obtener_usuario_completo not available, using fallback:', rpcError.message)

        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('*, rol:roles(id, nombre, nivel, color)')
          .eq('email', email)
          .single()

        if (userError) {
          logger.error('Error cargando usuario:', userError)
          if (_retry < 3) {
            await new Promise(r => setTimeout(r, 1000 * (_retry + 1)))
            return cargarUsuario(email, { esLoginFresco, _retry: _retry + 1 })
          }
          return null
        }

        usuarioData = userData
        if (!usuarioData.activo) {
          return { ...usuarioData, desactivado: true }
        }
        setUsuario(usuarioData)

        // Load permissions (legacy flow)
        setPermisosError(null)
        try {
          if (usuarioData.tipo === 'super_admin') {
            const { data: todosPermisos, error: permErr } = await supabase.from('permisos').select('codigo')
            if (permErr) throw permErr
            setPermisos(todosPermisos?.map(p => p.codigo) || [])
          } else {
            const [permisosRes, ventasRes] = await Promise.all([
              supabase.rpc('obtener_permisos_usuario', { p_usuario_id: usuarioData.id }),
              supabase.rpc('obtener_permisos_ventas_usuario', { p_usuario_id: usuarioData.id }),
            ])
            if (permisosRes.error && ventasRes.error) throw permisosRes.error
            const base = permisosRes.data?.map(p => p.codigo) || []
            const ventas = ventasRes.data?.map(p => p.codigo) || []
            setPermisos([...new Set([...base, ...ventas])])
          }
          setPermisosLoaded(true)
        } catch (permError) {
          logger.error('Error crítico cargando permisos:', permError)
          setPermisosError(permError.message || 'Error cargando permisos')
          setPermisosLoaded(true)
        }
      }

      // Load roles comerciales in background (non-blocking)
      supabase
        .from('ventas_roles_comerciales')
        .select('*, usuario:usuarios(id, nombre, email, avatar_url)')
        .eq('activo', true)
        .then(({ data }) => setRolesComerciales(data || []))
        .catch(() => {})

      // Actualizar ultimo acceso solo en login fresco
      if (esLoginFresco && usuarioData?.id) {
        supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', usuarioData.id).then(
          ({ error }) => { if (error) logger.error('Error actualizando ultimo_acceso:', error) },
          (err) => logger.error('Error de red actualizando ultimo_acceso:', err)
        )
      }

      return usuarioData
    } catch (error) {
      logger.error('Error en cargarUsuario:', error)
      if (_retry < 3) {
        await new Promise(r => setTimeout(r, 1000 * (_retry + 1)))
        return cargarUsuario(email, { esLoginFresco, _retry: _retry + 1 })
      }
      return null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const isAuthPage = () => ['/activar-cuenta', '/reset-password'].some(p => window.location.pathname.startsWith(p))

    // ── STEP 1: Read cached session from localStorage (instant, no network) ──
    // This avoids blocking on getSession() which can hang 20s+ if the token
    // refresh network request is slow (navigator.locks + fetchWithRetry timeout).
    let cachedUser = null
    try {
      const raw = localStorage.getItem('madrigal-auth')
      if (raw) {
        const parsed = JSON.parse(raw)
        const session = parsed?.session || parsed
        if (session?.user?.email && session?.access_token) {
          cachedUser = session.user
        }
      }
    } catch (_) { /* corrupted localStorage */ }

    if (cachedUser && !isAuthPage()) {
      // ── FAST PATH: Use smartRpc (direct fetch with cached token) ──
      // smartRpc bypasses supabase-js session lock — no getSession(), no navigator.locks wait.
      smartRpc('obtener_usuario_completo', { p_email: cachedUser.email })
        .then((rpcResult) => {
          if (!mounted) return
          if (rpcResult?.usuario) {
            const usuarioData = rpcResult.usuario
            if (!usuarioData.activo) {
              logger.warn('Cuenta desactivada, cerrando sesión...')
              supabase.auth.signOut().catch(() => {})
              setUser(null)
              setUsuario(null)
              setLoading(false)
              return
            }
            setUser(cachedUser)
            setUsuario(usuarioData)
            setPermisosError(null)
            setPermisos(rpcResult.permisos || [])
            setPermisosLoaded(true)
            setLoading(false)
          } else {
            throw new Error('RPC returned no usuario')
          }
        })
        .catch((err) => {
          if (!mounted) return
          logger.warn('Fast path failed:', err?.message, '— falling back to getSession()')
          setUser(cachedUser)
          Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('FALLBACK_TIMEOUT')), 10000)),
          ]).then(async ({ data: { session } }) => {
            if (!mounted) return
    
            if (session?.user) {
              setUser(session.user)
              try {
                const resultado = await cargarUsuario(session.user.email)
                if (resultado?.desactivado) {
                  await supabase.auth.signOut()
                  if (mounted) { setUser(null); setUsuario(null) }
                }
              } catch (loadErr) {
                logger.error('Fallback cargarUsuario failed:', loadErr?.message)
              }
            } else {
              localStorage.removeItem('madrigal-auth')
              setUser(null)
              setUsuario(null)
            }
            if (mounted) setLoading(false)
          }).catch(() => {
            if (mounted) {
              localStorage.removeItem('madrigal-auth')
              setUser(null)
              setUsuario(null)
              setLoading(false)
            }
          })
        })

      // Background: let supabase-js initialize (token refresh) — marks ready when done
      supabase.auth.getSession().then(({ data: { session } }) => {


        if (!mounted) return
        if (session?.user) {
          setUser(session.user) // update with fresh token data
        } else {
          // Token refresh failed — session expired
          logger.warn('Background getSession: session expired')
          setUser(null)
          setUsuario(null)
          setLoading(false)
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login'
          }
        }
        // Load roles comerciales now that supabase-js is ready
        supabase
          .from('ventas_roles_comerciales')
          .select('*, usuario:usuarios(id, nombre, email, avatar_url)')
          .eq('activo', true)
          .then(({ data }) => mounted && setRolesComerciales(data || []))
          .catch(() => {})
      }).catch((err) => {
        logger.error('Background getSession error:', err?.message)

      })
    } else {
      // ── SLOW PATH: No cached session or auth page ──
      const AUTH_TIMEOUT = 8000
      Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT)),
      ]).then(async ({ data: { session } }) => {
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          if (!isAuthPage()) {
            try {
              const resultado = await cargarUsuario(session.user.email)
              if (resultado?.desactivado) {
                await supabase.auth.signOut()
                if (mounted) { setUser(null); setUsuario(null) }
              }
            } catch (loadErr) {
              logger.error('Error cargando usuario:', loadErr?.message)
            }
          }
        }
        if (mounted) setLoading(false)
      }).catch((err) => {
        logger.error('getSession error:', err?.message)

        localStorage.removeItem('madrigal-auth')
        localStorage.removeItem('sb-ootncgtcvwnrskqtamak-auth-token')
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
    }

    // ── STEP 2: Listen for auth changes (token refresh, sign out, etc.) ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      logger.log('Auth event:', event)

      // Skip INITIAL_SESSION — we handle it above with localStorage fast path
      if (event === 'INITIAL_SESSION') return

      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user)
        } else {
          logger.warn('TOKEN_REFRESHED sin sesión — token expirado, forzando re-login...')
          localStorage.removeItem('madrigal-auth')
          localStorage.removeItem('sb-ootncgtcvwnrskqtamak-auth-token')
          setUser(null)
          setUsuario(null)
          setPermisos([])
          setPermisosLoaded(false)
          setPermisosError(null)
          setRolesComerciales([])
          window.location.href = '/login'
        }
        return
      }

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUsuario(null)
        setPermisos([])
        setPermisosLoaded(false)
        setPermisosError(null)
        setRolesComerciales([])
        setLoading(false)
        localStorage.removeItem('madrigal-auth')
        localStorage.removeItem('sb-ootncgtcvwnrskqtamak-auth-token')
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
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

  // rolesComerciales now loaded inside cargarUsuario (no separate effect needed)

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
