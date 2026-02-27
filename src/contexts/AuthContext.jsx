import { logger } from '../lib/logger'
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [permisos, setPermisos] = useState([])
  const [loading, setLoading] = useState(true)
  const isSigningIn = useRef(false)

  const cargarUsuario = useCallback(async (email, { esLoginFresco = false } = {}) => {
    try {
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('*, rol:roles(id, nombre, nivel, color)')
        .eq('email', email)
        .single()

      if (usuarioError) {
        console.error('Error cargando usuario:', usuarioError)
        return null
      }

      if (!usuarioData.activo) {
        return { ...usuarioData, desactivado: true }
      }

      setUsuario(usuarioData)

      // Cargar permisos
      if (usuarioData.tipo === 'super_admin') {
        const { data: todosPermisos } = await supabase.from('permisos').select('codigo')
        setPermisos(todosPermisos?.map(p => p.codigo) || [])
      } else {
        const { data: permisosData } = await supabase.rpc('obtener_permisos_usuario', { p_usuario_id: usuarioData.id })
        setPermisos(permisosData?.map(p => p.codigo) || [])
      }

      // Actualizar ultimo acceso (fire-and-forget, no bloquea la carga)
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', usuarioData.id).then(() => {}, () => {})

      return usuarioData
    } catch (error) {
      console.error('Error en cargarUsuario:', error)
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
            console.warn('No se pudo cargar usuario, verificando sesión...')
            const { data: { user: validUser }, error: userError } = await supabase.auth.getUser()
            if (userError || !validUser) {
              console.warn('Sesión inválida, limpiando...')
              await supabase.auth.signOut()
              setUser(null)
            }
          }
        }
      }
      setLoading(false)
    }).catch(async (err) => {
      console.error('Error en getSession:', err)
      // Sesión corrupta (AbortError, etc.) — limpiar para evitar bucle infinito
      try {
        await supabase.auth.signOut()
      } catch (_) { /* ignore */ }
      if (mounted) {
        setUser(null)
        setUsuario(null)
        setPermisos([])
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
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [cargarUsuario])

  const tienePermiso = useCallback((permiso) => {
    if (usuario?.tipo === 'super_admin') return true
    return permisos.includes(permiso)
  }, [usuario, permisos])

  const signInWithEmail = async (email, password) => {
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
        }
      }
      return { data, error }
    } finally {
      isSigningIn.current = false
    }
  }

  const signOut = async () => {
    // Registrar logout en auditoría antes de cerrar sesión
    if (usuario?.id) {
      try {
        await supabase.rpc('registrar_auditoria', {
          p_usuario_id: usuario.id,
          p_accion: 'LOGOUT',
          p_categoria: 'auth',
          p_descripcion: `Cierre de sesión: ${usuario.email}`,
        })
      } catch (e) {
        logger.error('Error registrando logout en auditoría:', e)
      }
    }
    setUser(null)
    setUsuario(null)
    setPermisos([])
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user,
      usuario,
      permisos,
      loading,
      tienePermiso,
      signInWithEmail,
      signOut,
      refrescarUsuario: () => user?.email && cargarUsuario(user.email)
    }}>
      {children}
    </AuthContext.Provider>
  )
}
