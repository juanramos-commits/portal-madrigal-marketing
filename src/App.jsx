import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionRoute from './components/PermissionRoute'
import Layout from './components/Layout'

// Páginas públicas
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ActivarCuenta from './pages/ActivarCuenta'
import Configurar2FA from './pages/Configurar2FA'
import PoliticaPrivacidad from './pages/PoliticaPrivacidad'
import CookieConsent from './components/CookieConsent'

// Páginas protegidas
import Dashboard from './pages/Dashboard'
import ClienteDashboard from './pages/ClienteDashboard'
import TablaClientesAvanzada from './pages/TablaClientesAvanzada'
import ClienteDetalleAvanzado from './pages/ClienteDetalleAvanzado'
import Usuarios from './pages/Usuarios'
import Roles from './pages/Roles'
import AuditLog from './pages/AuditLog'
import SecurityAlerts from './pages/SecurityAlerts'
import SecurityDashboard from './pages/SecurityDashboard'
import Seguridad from './pages/Seguridad'

// Wrapper que redirige a configurar 2FA si es obligatorio
function Require2FAWrapper({ children }) {
  const { requiere2FA, loading } = useAuth()
  if (loading) return null
  if (requiere2FA) return <Navigate to="/configurar-2fa" replace />
  return children
}

// Redirige al dashboard correcto según tipo de usuario
function SmartRedirect() {
  const { usuario, loading } = useAuth()
  if (loading) return null
  if (usuario?.tipo === 'cliente') return <Navigate to="/mi-cuenta" replace />
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/activar-cuenta" element={<ActivarCuenta />} />
          <Route path="/privacidad" element={<PoliticaPrivacidad />} />
          <Route path="/configurar-2fa" element={
            <ProtectedRoute><Configurar2FA /></ProtectedRoute>
          } />

          {/* Rutas protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Require2FAWrapper>
                  <Layout />
                </Require2FAWrapper>
              </ProtectedRoute>
            }
          >
            <Route index element={<SmartRedirect />} />
            <Route path="dashboard" element={<PermissionRoute permiso="dashboard.ver"><Dashboard /></PermissionRoute>} />
            <Route path="mi-cuenta" element={<ClienteDashboard />} />
            <Route path="clientes" element={<PermissionRoute permiso="clientes.ver_lista"><TablaClientesAvanzada /></PermissionRoute>} />
            <Route path="clientes/:id" element={<PermissionRoute permiso="clientes.ver_detalle"><ClienteDetalleAvanzado /></PermissionRoute>} />
            <Route path="tareas" element={<PermissionRoute permiso="tareas.ver_propias"><PlaceholderPage title="Tareas" /></PermissionRoute>} />
            <Route path="sugerencias" element={<PermissionRoute permiso="sugerencias.ver_propias"><PlaceholderPage title="Sugerencias" /></PermissionRoute>} />

            {/* Admin */}
            <Route path="usuarios" element={<PermissionRoute permiso="usuarios.ver"><Usuarios /></PermissionRoute>} />
            <Route path="roles" element={<PermissionRoute permiso="roles.ver"><Roles /></PermissionRoute>} />
            <Route path="audit-log" element={<PermissionRoute permiso="sistema.logs"><AuditLog /></PermissionRoute>} />
            <Route path="alertas-seguridad" element={<PermissionRoute permiso="sistema.logs"><SecurityAlerts /></PermissionRoute>} />
            <Route path="seguridad-dashboard" element={<PermissionRoute permiso="sistema.configuracion"><SecurityDashboard /></PermissionRoute>} />
            <Route path="mi-seguridad" element={<Seguridad />} />
          </Route>

          {/* Ruta por defecto */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <CookieConsent />
      </BrowserRouter>
    </AuthProvider>
  )
}

// Componente temporal para páginas en desarrollo
function PlaceholderPage({ title }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <h1 className="h1">{title}</h1>
      <p className="sub">Esta sección está en desarrollo</p>
    </div>
  )
}

export default App
