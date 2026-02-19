import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    // Always show success to prevent email enumeration
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <img 
                src="/logo.png" 
                alt="Madrigal Marketing" 
                className="login-logo-img"
              />
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
                fontSize: '28px'
              }}>
                ✉️
              </div>
              <h2 style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: '12px'
              }}>
                Revisa tu correo
              </h2>
              <p style={{
                fontSize: '15px',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                marginBottom: '8px'
              }}>
                Si existe una cuenta con ese email, recibirás instrucciones para restablecer tu contraseña.
              </p>
            </div>

            <div style={{ 
              height: '1px', 
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
              margin: '24px 0'
            }} />

            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              lineHeight: 1.5
            }}>
              ¿No recibiste el correo? Revisa tu carpeta de spam o{' '}
              <button 
                onClick={() => setSent(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                intenta de nuevo
              </button>
            </p>

            <div className="login-footer">
              <Link to="/login" className="login-help">
                ← Volver al inicio de sesión
              </Link>
            </div>
          </div>

          <p className="login-brand">
            © 2026 Madrigal Marketing
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img 
              src="/logo.png" 
              alt="Madrigal Marketing" 
              className="login-logo-img"
            />
            <p className="login-subtitle">Recupera el acceso a tu cuenta</p>
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

            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              margin: '0',
              textAlign: 'center'
            }}>
              Te enviaremos un enlace para restablecer tu contraseña.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="login-button"
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                  Enviando...
                </>
              ) : (
                'Enviar enlace'
              )}
            </button>
          </form>

          <div className="login-footer">
            <Link to="/login" className="login-help">
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>

        <p className="login-brand">
          © 2026 Madrigal Marketing
        </p>
      </div>
    </div>
  )
}
