import { logger } from '../lib/logger'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Configurar2FA() {
  const { usuario } = useAuth()
  const [enrollData, setEnrollData] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    startEnroll()
  }, [])

  const startEnroll = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Madrigal Portal TOTP'
      })
      if (error) throw error
      setEnrollData(data)
    } catch (e) {
      logger.error('Error enrolling MFA:', e)
      setError(e.message || 'Error al iniciar configuración 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError('Introduce el código de 6 dígitos')
      return
    }
    setError('')
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.id
      })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeData.id,
        code: verifyCode
      })
      if (verifyError) throw verifyError

      // Registrar en auditoría
      try {
        await supabase.rpc('registrar_auditoria', {
          p_usuario_id: usuario.id,
          p_accion: 'MFA_FORCED',
          p_categoria: 'auth',
          p_descripcion: '2FA obligatorio activado para rol de nivel alto'
        })
      } catch (_) {}

      setSuccess(true)
    } catch (e) {
      logger.error('Error verifying MFA:', e)
      setError(e.message || 'Código incorrecto. Inténtalo de nuevo.')
    }
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <img src="/logo.png" alt="Madrigal" className="login-logo-img" />
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '64px', height: '64px',
                background: 'rgba(16,185,129,0.1)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px', fontSize: '28px', color: '#10b981'
              }}>
                &#10003;
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>
                2FA Activado
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                Tu cuenta ahora tiene autenticación de dos factores.
              </p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="login-button"
              >
                Continuar al portal
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card" style={{ maxWidth: '440px' }}>
          <div className="login-header">
            <img src="/logo.png" alt="Madrigal" className="login-logo-img" style={{ width: '280px', marginBottom: '4px' }} />
          </div>

          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '14px',
            color: '#f59e0b',
            textAlign: 'center'
          }}>
            Tu rol requiere autenticación de dos factores. Configúrala para continuar.
          </div>

          {error && (
            <div className="alert error" style={{ marginBottom: '16px' }}>{error}</div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-muted)' }}>Preparando configuración...</p>
            </div>
          ) : enrollData ? (
            <div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center' }}>
                Escanea este código QR con tu app de autenticación
              </p>

              <div style={{
                display: 'flex', justifyContent: 'center',
                margin: '0 auto 16px',
                padding: '16px',
                background: 'white',
                borderRadius: '8px',
                width: 'fit-content'
              }}>
                <img
                  src={enrollData.totp.qr_code}
                  alt="QR Code 2FA"
                  style={{ width: '180px', height: '180px' }}
                />
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: 'center' }}>
                Código manual:
              </p>
              <div style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '13px',
                wordBreak: 'break-all',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {enrollData.totp.secret}
              </div>

              <div className="field">
                <label className="field-label">Código de verificación</label>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="login-input"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px', fontFamily: 'monospace' }}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
              </div>

              <button
                onClick={handleVerify}
                className="login-button"
                disabled={verifyCode.length !== 6}
                style={{ marginTop: '16px' }}
              >
                Verificar y activar 2FA
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--text-muted)' }}>Error al cargar configuración. Recarga la página.</p>
              <button onClick={() => window.location.reload()} className="login-button" style={{ marginTop: '16px' }}>
                Recargar
              </button>
            </div>
          )}
        </div>
        <p className="login-brand">&copy; 2026 Madrigal Marketing</p>
      </div>
    </div>
  )
}
