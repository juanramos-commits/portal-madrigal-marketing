import { logger } from '../lib/logger'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [bloqueoHasta, setBloqueoHasta] = useState(null)
  const navigate = useNavigate()
  const { signInWithEmail } = useAuth()

  const registrarIntento = async (emailAddr, exitoso) => {
    try {
      await supabase.from('login_attempts').insert({
        email: emailAddr,
        exitoso
      })
    } catch (_) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Verificar bloqueo local
    if (bloqueoHasta && Date.now() < bloqueoHasta) {
      const mins = Math.ceil((bloqueoHasta - Date.now()) / 60000)
      setError(`Demasiados intentos. Espera ${mins} minuto${mins > 1 ? 's' : ''}.`)
      return
    }

    setLoading(true)
    setError('')

    // Verificar bloqueo en servidor
    try {
      const { data: bloqueada } = await supabase.rpc('cuenta_bloqueada', { p_email: email })
      if (bloqueada) {
        setError('Cuenta temporalmente bloqueada. Intenta de nuevo en 30 minutos.')
        setLoading(false)
        return
      }
    } catch (_) {}

    const { data, error: authError } = await signInWithEmail(email, password)

    if (authError) {
      logger.error('Auth error:', authError)
      await registrarIntento(email, false)

      const nuevosIntentos = intentosFallidos + 1
      setIntentosFallidos(nuevosIntentos)

      if (nuevosIntentos >= 5) {
        // Generar alerta de seguridad
        try {
          await supabase.rpc('generar_alerta_seguridad', {
            p_tipo: 'login_fallido_multiple',
            p_severidad: 'alta',
            p_titulo: `${nuevosIntentos}+ intentos de login fallidos para ${email}`,
            p_descripcion: `Se han detectado ${nuevosIntentos} intentos fallidos de login`,
            p_datos: JSON.stringify({ email, intentos: nuevosIntentos })
          })
        } catch (_) {}

        setBloqueoHasta(Date.now() + 15 * 60 * 1000)
        setError('Demasiados intentos fallidos. Espera 15 minutos.')
        setLoading(false)
        return
      }

      if (authError.message === 'CUENTA_DESACTIVADA') {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      } else {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      }
      setLoading(false)
      return
    }

    if (data?.user) {
      await registrarIntento(email, true)
      setIntentosFallidos(0)
      navigate('/')
    } else {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/logo.png" alt="Madrigal Marketing" className="login-logo-img" style={{ width: '280px', marginBottom: '4px' }} />
            <p className="login-subtitle">Accede a tu portal de gestión</p>
          </div>

          {error && (
            <div className="alert error" style={{ marginBottom: '24px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 6v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label className="field-label">Correo Electrónico</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                placeholder="tu@email.com"
                required
                disabled={loading}
              />
            </div>

            <div className="field">
              <label className="field-label">Contraseña</label>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button type="submit" disabled={loading} className="login-button">
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="login-footer">
            <Link to="/forgot-password" className="login-help">¿Olvidaste tu contraseña?</Link>
          </div>
        </div>
        <p className="login-brand">&copy; 2026 Madrigal Marketing</p>
      </div>
    </div>
  )
}
