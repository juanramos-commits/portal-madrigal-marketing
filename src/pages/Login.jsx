import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      console.error('Auth error:', authError)
      if (authError.message.includes('Invalid login credentials')) {
        setError('Email o contraseña incorrectos')
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    if (data.user) {
      window.location.href = '/dashboard'
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
        <p className="login-brand">© 2026 Madrigal Marketing</p>
      </div>
    </div>
  )
}
