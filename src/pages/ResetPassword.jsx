import { logger } from '../lib/logger'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('ResetPassword auth event:', event)
      
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true)
        setCheckingSession(false)
      }
    })

    const timeout = setTimeout(() => {
      setCheckingSession(false)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      logger.error('Error updating password:', updateError)
      setError('Error al actualizar la contraseña. Inténtalo de nuevo.')
      setLoading(false)
    } else {
      // Cerrar sesión completamente antes de redirigir
      await supabase.auth.signOut()
      setSuccess(true)
      setLoading(false)
    }
  }

  // Redirigir manualmente al login (sin usar navigate para evitar conflictos de estado)
  const irAlLogin = () => {
    window.location.href = '/login'
  }

  if (checkingSession) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <img src="/logo.png" alt="Madrigal Marketing" className="login-logo-img" />
            </div>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
              <p style={{ color: 'var(--text-muted)' }}>Verificando enlace...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <img src="/logo.png" alt="Madrigal Marketing" className="login-logo-img" />
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(255, 107, 107, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: '28px'
              }}>⚠️</div>
              <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
                Enlace inválido o expirado
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                El enlace de recuperación no es válido o ha expirado.<br />Por favor, solicita uno nuevo.
              </p>
            </div>
            <Link to="/forgot-password" className="login-button" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '24px' }}>
              Solicitar nuevo enlace
            </Link>
          </div>
          <p className="login-brand">© 2026 Madrigal Marketing</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <img src="/logo.png" alt="Madrigal Marketing" className="login-logo-img" />
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(46, 229, 157, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: '28px',
                color: 'var(--success)'
              }}>✓</div>
              <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
                ¡Contraseña actualizada!
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                Tu contraseña ha sido cambiada correctamente.
              </p>
              <button onClick={irAlLogin} className="login-button">
                Ir al inicio de sesión
              </button>
            </div>
          </div>
          <p className="login-brand">© 2026 Madrigal Marketing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/logo.png" alt="Madrigal Marketing" className="login-logo-img" />
            <p className="login-subtitle">Crea tu nueva contraseña</p>
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
              <label className="field-label">Nueva Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="field">
              <label className="field-label">Confirmar Contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="login-input"
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0', textAlign: 'center' }}>
              La contraseña debe tener al menos 6 caracteres.
            </p>

            <button type="submit" disabled={loading} className="login-button">
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                  Guardando...
                </>
              ) : (
                'Guardar nueva contraseña'
              )}
            </button>
          </form>
        </div>
        <p className="login-brand">© 2026 Madrigal Marketing</p>
      </div>
    </div>
  )
}
