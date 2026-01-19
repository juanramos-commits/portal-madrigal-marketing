import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ActivarCuenta() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      await new Promise(r => setTimeout(r, 1000))
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) {
        if (session?.user) {
          setReady(true)
          setEmail(session.user.email || '')
        }
        setChecking(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && session?.user) {
        setReady(true)
        setEmail(session.user.email || '')
        setChecking(false)
      }
    })

    checkSession()
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }

    await supabase.auth.signOut()
    setLoading(false)
    setSuccess(true)
  }

  if (checking) {
    return (
      <div className="login-page"><div className="login-container"><div className="login-card">
        <div className="login-header"><img src="/logo.png" alt="Madrigal" className="login-logo-img" /></div>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-muted)' }}>Verificando...</p>
        </div>
      </div></div></div>
    )
  }

  if (!ready) {
    return (
      <div className="login-page"><div className="login-container"><div className="login-card">
        <div className="login-header"><img src="/logo.png" alt="Madrigal" className="login-logo-img" /></div>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(255,107,107,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px' }}>⚠️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>Enlace inválido</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>El enlace ha expirado o ya fue usado.<br/>Contacta con tu administrador.</p>
          <button onClick={() => window.location.href = '/login'} className="login-button">Ir al login</button>
        </div>
      </div><p className="login-brand">© 2026 Madrigal Marketing</p></div></div>
    )
  }

  if (success) {
    return (
      <div className="login-page"><div className="login-container"><div className="login-card">
        <div className="login-header"><img src="/logo.png" alt="Madrigal" className="login-logo-img" /></div>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(46,229,157,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px', color: 'var(--success)' }}>✓</div>
          <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>¡Cuenta activada!</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '24px' }}>Ya puedes iniciar sesión.</p>
          <button onClick={() => window.location.href = '/login'} className="login-button">Ir al login</button>
        </div>
      </div><p className="login-brand">© 2026 Madrigal Marketing</p></div></div>
    )
  }

  return (
    <div className="login-page"><div className="login-container"><div className="login-card">
      <div className="login-header">
        <img src="/logo.png" alt="Madrigal" className="login-logo-img" />
        <p className="login-subtitle">Activa tu cuenta</p>
      </div>

      {email && (
        <div style={{ textAlign: 'center', padding: '12px 16px', background: 'rgba(46,229,157,0.1)', borderRadius: '8px', marginBottom: '24px', border: '1px solid rgba(46,229,157,0.2)' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Configurando cuenta para</p>
          <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 500 }}>{email}</p>
        </div>
      )}

      {error && <div className="alert error" style={{ marginBottom: '24px' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="field">
          <label className="field-label">Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="login-input" placeholder="••••••••" required disabled={loading} minLength={6} />
        </div>
        <div className="field">
          <label className="field-label">Confirmar</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="login-input" placeholder="••••••••" required disabled={loading} minLength={6} />
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Mínimo 6 caracteres</p>
        <button type="submit" disabled={loading} className="login-button">{loading ? 'Activando...' : 'Activar cuenta'}</button>
      </form>
    </div><p className="login-brand">© 2026 Madrigal Marketing</p></div></div>
  )
}
