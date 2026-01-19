import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, usuario, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!usuario) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '24px'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
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
          }}>
            ⚠️
          </div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '8px'
          }}>
            Acceso no autorizado
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            marginBottom: '16px',
            lineHeight: 1.5
          }}>
            Tu cuenta de email no está registrada en el sistema. Contacta con el administrador para obtener acceso.
          </p>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            opacity: 0.7
          }}>
            Email: {user.email}
          </p>
        </div>
      </div>
    )
  }

  return children
}
