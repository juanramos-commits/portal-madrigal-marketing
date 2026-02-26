import { logger } from '../lib/logger'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Seguridad() {
  const { usuario } = useAuth()
  const [downloadingData, setDownloadingData] = useState(false)

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

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      <h1 className="h1" style={{ marginBottom: '8px' }}>Seguridad de la cuenta</h1>
      <p className="sub" style={{ marginBottom: '32px' }}>Gestiona tus sesiones y datos personales</p>

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
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Tipo</span>
            <span style={{ fontSize: '14px' }}>{usuario?.tipo}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
