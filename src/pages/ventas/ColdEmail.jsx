import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import '../../styles/cold-email.css'

const navItems = [
  { label: 'Dashboard', path: '/cold-email', icon: 'chart', end: true },
  { label: 'Contactos', path: '/cold-email/contactos', icon: 'users', permiso: 'cold_email.contactos.ver' },
  { label: 'Secuencias', path: '/cold-email/secuencias', icon: 'sequence', permiso: 'cold_email.secuencias.ver' },
  { label: 'Respuestas', path: '/cold-email/respuestas', icon: 'inbox', permiso: 'cold_email.respuestas.ver' },
  { label: 'Envíos', path: '/cold-email/envios', icon: 'send', permiso: 'cold_email.envios.ver' },
  { label: 'Plantillas', path: '/cold-email/plantillas', icon: 'template', permiso: 'cold_email.plantillas.ver' },
  { label: 'Config', path: '/cold-email/config', icon: 'settings', permiso: 'cold_email.config.ver' },
]

const icons = {
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  sequence: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
    </svg>
  ),
  inbox: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/>
    </svg>
  ),
  template: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
}

export default function ColdEmail() {
  const { tienePermiso } = useAuth()
  const location = useLocation()

  return (
    <div className="ce-shell">
      <nav className="ce-sidebar">
        <div className="ce-sidebar-header">
          <h2 className="ce-sidebar-title">Cold Email</h2>
        </div>
        <ul className="ce-sidebar-nav">
          {navItems.map(item => {
            if (item.permiso && !tienePermiso(item.permiso)) return null
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `ce-sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="ce-sidebar-icon">{icons[item.icon]}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <main className="ce-content">
        <Outlet />
      </main>
    </div>
  )
}
