import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PermissionRoute({ permiso, children }) {
  const { tienePermiso, permisos, loading } = useAuth()
  const navigate = useNavigate()

  // Si no se especifica permiso, funciona como wrapper transparente
  if (!permiso) return children

  // Mientras se cargan los permisos, mostrar spinner (NO la página de sin acceso)
  if (loading || permisos.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px'
      }}>
        <div className="spinner" />
      </div>
    )
  }

  // Si tiene el permiso, renderizar normalmente
  if (tienePermiso(permiso)) return children

  // Si NO tiene el permiso, mostrar página "Sin acceso"
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '24px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '8px'
        }}>
          No tienes acceso a esta sección
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-muted)',
          marginBottom: '24px',
          lineHeight: 1.5
        }}>
          Contacta con tu administrador si necesitas acceso
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn primary"
        >
          Volver al Dashboard
        </button>
      </div>
    </div>
  )
}
