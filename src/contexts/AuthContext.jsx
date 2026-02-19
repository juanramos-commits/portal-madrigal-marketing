import { logger } from '../lib/logger'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [permisos, setPermisos] = useState([])
  const [loading, setLoading] = useState(true)

  const cargarUsuario = useCallback(async (email) => {
    try {
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('*, rol:roles(id, nombre, nivel, color)')
        .eq('email', email)
        .single()

      if (usuarioError) {
        logger.error('Error cargando usuario:', usuarioError)
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

      // Actualizar último acceso
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', usuarioData.id)

      return usuarioData
    } catch (error) {
      logger.error('Error en cargarUsuario:', error)
      return null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      logger.log('Auth event:', event)

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUsuario(null)
        setPermisos([])
        setLoading(false)
        return
      }

      if (session?.user) {
        setUser(session.user)
        // No cargar usuario en páginas de auth
        const isAuthPage = ['/activar-cuenta', '/reset-password'].some(p => window.location.pathname.includes(p))
        if (!isAuthPage) {
          await cargarUsuario(session.user.email)
        }
      } else {
        setUser(null)
        setUsuario(null)
        setPermisos([])
      }
      setLoading(false)
    })

    // Obtener sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        const isAuthPage = ['/activar-cuenta', '/reset-password'].some(p => window.location.pathname.includes(p))
        if (!isAuthPage) {
          await cargarUsuario(session.user.email)
        }
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      const usuarioData = await cargarUsuario(data.user.email)
      if (usuarioData?.desactivado) {
        await supabase.auth.signOut()
        return { data: null, error: { message: 'CUENTA_DESACTIVADA' } }
      }
    }
    return { data, error }
  }

  const signOut = async () => {
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
