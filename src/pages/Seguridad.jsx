import { logger } from '../lib/logger'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Seguridad() {
  const { usuario } = useAuth()
  const [factors, setFactors] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [unenrolling, setUnenrolling] = useState(false)
  const [unenrollCode, setUnenrollCode] = useState('')
  const [downloadingData, setDownloadingData] = useState(false)

  useEffect(() => {
    loadFactors()
  }, [])

  const loadFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      setFactors(data?.totp || [])
    } catch (e) {
      logger.error('Error loading MFA factors:', e)
    } finally {
      setLoading(false)
    }
  }

  const startEnroll = async () => {
    setEnrolling(true)
    setVerifyError('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Madrigal Portal TOTP'
      })
      if (error) throw error
      setEnrollData(data)
    } catch (e) {
      logger.error('Error enrolling MFA:', e)
      setVerifyError(e.message || 'Error al activar 2FA')
      setEnrolling(false)
    }
  }

  const verifyEnroll = async () => {
    if (verifyCode.length !== 6) {
      setVerifyError('Introduce el código de 6 dígitos')
      return
    }
    setVerifyError('')
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
          p_accion: 'MFA_ENROLLED',
          p_categoria: 'auth',
          p_descripcion: '2FA activado para la cuenta'
        })
      } catch (_) {}

      setEnrollData(null)
      setEnrolling(false)
      setVerifyCode('')
      await loadFactors()
    } catch (e) {
      logger.error('Error verifying MFA:', e)
      setVerifyError(e.message || 'Código incorrecto')
    }
  }

  const cancelEnroll = async () => {
    if (enrollData?.id) {
      try {
        await supabase.auth.mfa.unenroll({ factorId: enrollData.id })
      } catch (_) {}
    }
    setEnrollData(null)
    setEnrolling(false)
    setVerifyCode('')
    setVerifyError('')
  }

  const startUnenroll = () => {
    setUnenrolling(true)
    setUnenrollCode('')
    setVerifyError('')
  }

  const confirmUnenroll = async () => {
    const activeFactor = factors.find(f => f.status === 'verified')
    if (!activeFactor) return

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: activeFactor.id })
      if (error) throw error

      // Registrar en auditoría
      try {
        await supabase.rpc('registrar_auditoria', {
          p_usuario_id: usuario.id,
          p_accion: 'MFA_UNENROLLED',
          p_categoria: 'auth',
          p_descripcion: '2FA desactivado para la cuenta'
        })
      } catch (_) {}

      setUnenrolling(false)
      setUnenrollCode('')
      await loadFactors()
    } catch (e) {
      logger.error('Error unenrolling MFA:', e)
      setVerifyError(e.message || 'Error al desactivar 2FA')
    }
  }

  const handleCloseAllSessions = async () => {
    if (!confirm('Se cerrarán todas tus sesiones activas. Tendrás que volver a iniciar sesión.')) return
    try {
      await supabase.rpc('registrar_auditoria', {
        p_usuario_id: usuario.id,
        p_accion: 'LOGOUT',
        p_categoria: 'auth',
        p_descripcion: 'Cierre global de sesiones'
      })
    } catch (_) {}
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = '/login'
  }

  const handleDownloadMyData = async () => {
    setDownloadingData(true)
    try {
      const userId = usuario.id

      const [perfil, auditoria, permisos, sesiones] = await Promise.all([
        supabase.from('usuarios').select('id, email, nombre, tipo, activo, ultimo_acceso, created_at').eq('id', userId).single(),
        supabase.from('audit_log').select('accion, categoria, descripcion, created_at').eq('usuario_id', userId).order('created_at', { ascending: false }).limit(500),
        supabase.from('usuarios_permisos').select('permiso:permisos(modulo, codigo, descripcion), activo').eq('usuario_id', userId),
        supabase.from('login_attempts').select('ip, exitoso, created_at').eq('usuario_id', userId).order('created_at', { ascending: false }).limit(100)
      ])

      const data = {
        fecha_exportacion: new Date().toISOString(),
        nota: 'Exportación conforme al Art. 15 RGPD - Derecho de acceso',
        perfil: perfil.data || {},
        historial_actividad: auditoria.data || [],
        permisos_especificos: permisos.data || [],
        intentos_acceso: sesiones.data || []
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mis-datos-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      try {
        await supabase.rpc('registrar_auditoria', {
          p_usuario_id: userId,
          p_accion: 'GDPR_DATA_EXPORT',
          p_categoria: 'auth',
          p_descripcion: 'Usuario descargó sus datos personales (Art. 15 RGPD)'
        })
      } catch (_) {}
    } catch (e) {
      logger.error('Error downloading personal data:', e)
      alert('Error al descargar datos. Inténtalo de nuevo.')
    } finally {
      setDownloadingData(false)
    }
  }

  const verifiedFactors = factors.filter(f => f.status === 'verified')
  const has2FA = verifiedFactors.length > 0

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h1 className="h1" style={{ marginBottom: '8px' }}>Seguridad de la cuenta</h1>
      <p className="sub" style={{ marginBottom: '32px' }}>Configura la autenticación de dos factores y gestiona tus sesiones</p>

      {/* Sección 2FA */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Autenticación de dos factores (2FA)</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Añade una capa extra de seguridad a tu cuenta
            </p>
          </div>
          <div style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 500,
            background: has2FA ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: has2FA ? '#10b981' : '#ef4444'
          }}>
            {has2FA ? 'Activado' : 'Desactivado'}
          </div>
        </div>

        {verifyError && (
          <div className="alert error" style={{ marginBottom: '16px' }}>{verifyError}</div>
        )}

        {/* Flujo de enrollment */}
        {enrolling && enrollData ? (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Configurar 2FA</h3>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              1. Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, etc.)
            </p>

            {/* QR Code - rendered as image from Supabase TOTP URI */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '16px 0',
              padding: '16px',
              background: 'white',
              borderRadius: '8px',
              width: 'fit-content',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              <img
                src={enrollData.totp.qr_code}
                alt="QR Code para 2FA"
                style={{ width: '200px', height: '200px' }}
              />
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Si no puedes escanear el QR, introduce este código manualmente:
            </p>
            <div style={{
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '14px',
              wordBreak: 'break-all',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              {enrollData.totp.secret}
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              2. Introduce el código de 6 dígitos que muestra la app:
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'var(--bg-input, rgba(255,255,255,0.05))',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '18px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  fontFamily: 'monospace'
                }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && verifyEnroll()}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelEnroll} className="btn" style={{ flex: 1 }}>Cancelar</button>
              <button
                onClick={verifyEnroll}
                className="btn primary"
                style={{ flex: 1 }}
                disabled={verifyCode.length !== 6}
              >
                Verificar y activar
              </button>
            </div>
          </div>
        ) : unenrolling ? (
          <div style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#ef4444' }}>
              Desactivar 2FA
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Tu cuenta será menos segura sin 2FA.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setUnenrolling(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
              <button
                onClick={confirmUnenroll}
                className="btn"
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }}
              >
                Confirmar desactivación
              </button>
            </div>
          </div>
        ) : (
          <div>
            {has2FA ? (
              <div>
                <p style={{ fontSize: '14px', color: '#10b981', marginBottom: '12px' }}>
                  Tu cuenta está protegida con autenticación de dos factores.
                </p>
                <button onClick={startUnenroll} className="btn" style={{ color: '#ef4444' }}>
                  Desactivar 2FA
                </button>
              </div>
            ) : (
              <button onClick={startEnroll} className="btn primary">
                Activar 2FA
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sección Sesiones */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Gestión de sesiones</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Controla las sesiones activas de tu cuenta
        </p>

        <div style={{
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>Último acceso</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {usuario?.ultimo_acceso
                ? new Date(usuario.ultimo_acceso).toLocaleString('es-ES')
                : 'Sin registro'}
            </div>
          </div>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981'
          }} />
        </div>

        <button onClick={handleCloseAllSessions} className="btn" style={{ color: '#ef4444' }}>
          Cerrar todas las sesiones
        </button>
      </div>

      {/* GDPR - Derecho de acceso */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Tus datos personales (RGPD)</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Conforme al Art. 15 del RGPD, puedes descargar todos los datos que tenemos asociados a tu cuenta.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadMyData}
            className="btn primary"
            disabled={downloadingData}
          >
            {downloadingData ? 'Preparando...' : 'Descargar mis datos'}
          </button>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', fontSize: '14px', color: '#3b82f6', textDecoration: 'none' }}>
            Política de privacidad
          </a>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
          Para solicitar la eliminación de tus datos (Art. 17 RGPD), contacta al administrador del sistema.
        </p>
      </div>

      {/* Info de cuenta */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Información de la cuenta</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Email</span>
            <span style={{ fontSize: '14px' }}>{usuario?.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Rol</span>
            <span style={{ fontSize: '14px' }}>{usuario?.rol?.nombre || usuario?.tipo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Tipo</span>
            <span style={{ fontSize: '14px' }}>{usuario?.tipo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>2FA</span>
            <span style={{ fontSize: '14px', color: has2FA ? '#10b981' : '#ef4444' }}>
              {has2FA ? 'Activado' : 'Desactivado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
