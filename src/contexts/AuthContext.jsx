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
  const [requiere2FA, setRequiere2FA] = useState(false)

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

      // Verificar expiración de sesión (24h desde último acceso)
      const SESION_MAX_HORAS = 24
      if (usuarioData.ultimo_acceso) {
        const horasDesdeUltimoAcceso = (Date.now() - new Date(usuarioData.ultimo_acceso).getTime()) / (1000 * 60 * 60)
        if (horasDesdeUltimoAcceso > SESION_MAX_HORAS) {
          logger.log('Sesión expirada por inactividad')
          await supabase.auth.signOut()
          return null
        }
      }

      // Verificar si el rol requiere 2FA (nivel >= 90)
      const rolNivel = usuarioData.rol?.nivel || 0
      if (rolNivel >= 90 || usuarioData.tipo === 'super_admin') {
        try {
          const { data: factors } = await supabase.auth.mfa.listFactors()
          const tiene2FA = factors?.totp?.some(f => f.status === 'verified')
          if (!tiene2FA) {
            setRequiere2FA(true)
          } else {
            setRequiere2FA(false)
          }
        } catch (e) {
          logger.error('Error checking MFA status:', e)
          setRequiere2FA(false)
        }
      } else {
        setRequiere2FA(false)
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
        setRequiere2FA(false)
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
        setRequiere2FA(false)
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
    setRequiere2FA(false)
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user,
      usuario,
      permisos,
      loading,
      requiere2FA,
      tienePermiso,
      signInWithEmail,
      signOut,
      refrescarUsuario: () => user?.email && cargarUsuario(user.email)
    }}>
      {children}
    </AuthContext.Provider>
  )
}
