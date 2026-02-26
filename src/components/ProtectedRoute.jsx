import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, usuario, loading, refrescarUsuario } = useAuth()

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
            No se pudo cargar tu cuenta
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            marginBottom: '16px',
            lineHeight: 1.5
          }}>
            Hubo un problema al cargar los datos de tu cuenta. Puede ser un error temporal de conexión.
          </p>
          <button
            onClick={() => refrescarUsuario()}
            style={{
              background: '#6c5ce7',
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px'
            }}
          >
            Reintentar
          </button>
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
