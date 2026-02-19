import { logger } from '../lib/logger'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mfaStep, setMfaStep] = useState(false)
  const [factorId, setFactorId] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaAttempts, setMfaAttempts] = useState(0)
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [bloqueoHasta, setBloqueoHasta] = useState(null)
  const navigate = useNavigate()
  const { signInWithEmail } = useAuth()
  const mfaTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (mfaTimeoutRef.current) clearTimeout(mfaTimeoutRef.current)
    }
  }, [])

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

      // Verificar si tiene MFA
      try {
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        const totpFactors = factorsData?.totp?.filter(f => f.status === 'verified') || []

        if (totpFactors.length > 0) {
          setFactorId(totpFactors[0].id)
          setMfaStep(true)
          setLoading(false)

          // Timeout de 5 minutos para MFA
          mfaTimeoutRef.current = setTimeout(() => {
            setMfaStep(false)
            setError('Tiempo de verificación agotado. Inicia sesión de nuevo.')
            supabase.auth.signOut()
          }, 5 * 60 * 1000)
          return
        }
      } catch (e) {
        logger.error('Error checking MFA:', e)
      }

      navigate('/dashboard')
    } else {
      setLoading(false)
    }
  }

  const handleMfaVerify = async () => {
    if (mfaCode.length !== 6) {
      setMfaError('Introduce el código de 6 dígitos')
      return
    }

    setLoading(true)
    setMfaError('')

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: mfaCode
      })

      if (verifyError) throw verifyError

      if (mfaTimeoutRef.current) clearTimeout(mfaTimeoutRef.current)

      // Registrar MFA exitoso
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: usr } = await supabase.from('usuarios').select('id').eq('email', user.email).single()
          if (usr) {
            await supabase.rpc('registrar_auditoria', {
              p_usuario_id: usr.id,
              p_accion: 'MFA_VERIFIED',
              p_categoria: 'auth',
              p_descripcion: 'Verificación 2FA exitosa en login'
            })
          }
        }
      } catch (_) {}

      navigate('/dashboard')
    } catch (e) {
      logger.error('MFA verify error:', e)
      const newAttempts = mfaAttempts + 1
      setMfaAttempts(newAttempts)

      // Registrar fallo MFA
      try {
        await supabase.rpc('registrar_auditoria', {
          p_usuario_id: null,
          p_accion: 'MFA_FAILED',
          p_categoria: 'auth',
          p_descripcion: `Intento fallido de 2FA (intento ${newAttempts})`
        })
      } catch (_) {}

      if (newAttempts >= 3) {
        if (mfaTimeoutRef.current) clearTimeout(mfaTimeoutRef.current)
        await supabase.auth.signOut()
        setMfaStep(false)
        setMfaCode('')
        setMfaAttempts(0)
        setBloqueoHasta(Date.now() + 15 * 60 * 1000)
        setError('3 intentos de 2FA fallidos. Espera 15 minutos.')
        setLoading(false)
        return
      }

      setMfaError(`Código incorrecto. ${3 - newAttempts} intento${3 - newAttempts > 1 ? 's' : ''} restante${3 - newAttempts > 1 ? 's' : ''}.`)
      setMfaCode('')
      setLoading(false)
    }
  }

  // Pantalla de MFA
  if (mfaStep) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <img src="/logo.png" alt="Madrigal Marketing" className="login-logo-img" style={{ width: '280px', marginBottom: '4px' }} />
              <p className="login-subtitle">Verificación de dos factores</p>
            </div>

            {mfaError && (
              <div className="alert error" style={{ marginBottom: '24px' }}>
                {mfaError}
              </div>
            )}

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '20px' }}>
              Introduce el código de tu app de autenticación
            </p>

            <div className="field">
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="login-input"
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '24px', fontFamily: 'monospace' }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleMfaVerify()}
                disabled={loading}
              />
            </div>

            <button
              onClick={handleMfaVerify}
              disabled={loading || mfaCode.length !== 6}
              className="login-button"
              style={{ marginTop: '16px' }}
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>

            <button
              onClick={() => {
                if (mfaTimeoutRef.current) clearTimeout(mfaTimeoutRef.current)
                supabase.auth.signOut()
                setMfaStep(false)
                setMfaCode('')
              }}
              style={{
                marginTop: '12px', background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px',
                width: '100%', textAlign: 'center'
              }}
            >
              Cancelar e iniciar sesión de nuevo
            </button>
          </div>
          <p className="login-brand">&copy; 2026 Madrigal Marketing</p>
        </div>
      </div>
    )
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
