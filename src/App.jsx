import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionRoute from './components/PermissionRoute'
import Layout from './components/Layout'

// Páginas públicas
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ActivarCuenta from './pages/ActivarCuenta'
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

// Páginas de Ventas
import VentasDashboard from './pages/ventas/VentasDashboard'
import VentasNotificaciones from './pages/ventas/VentasNotificaciones'
import VentasCRM from './pages/ventas/VentasCRM'
import CRMLeadDetalle from './components/ventas/CRMLeadDetalle'
import VentasBiblioteca from './pages/ventas/VentasBiblioteca'
import VentasWallet from './pages/ventas/VentasWallet'
import VentasVentas from './pages/ventas/VentasVentas'
import VentasCalendario from './pages/ventas/Calendario'
import VentasAjustes from './pages/ventas/VentasAjustes'

// Páginas generales
import Notificaciones from './pages/Notificaciones'
import CRM from './pages/CRM'
import PaquetesClientes from './pages/PaquetesClientes'
import Facturas from './pages/documentacion/Facturas'
import Contrato from './pages/documentacion/Contrato'
import Reuniones from './pages/Reuniones'
import Archivos from './pages/Archivos'
import Madrigalito from './pages/Madrigalito'

// Redirige al primer dashboard accesible según permisos del usuario
function SmartRedirect() {
  const { usuario, tienePermiso, loading } = useAuth()
  if (loading) return null
  if (usuario?.tipo === 'cliente') return <Navigate to="/mi-cuenta" replace />
  if (tienePermiso('ventas.ver_dashboard')) return <Navigate to="/ventas/dashboard" replace />
  if (tienePermiso('dashboard.ver')) return <Navigate to="/dashboard" replace />
  return <Navigate to="/mi-seguridad" replace />
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/activar-cuenta" element={<ActivarCuenta />} />
          <Route path="/privacidad" element={<PoliticaPrivacidad />} />

          {/* Rutas protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SmartRedirect />} />
            <Route path="dashboard" element={<PermissionRoute permiso="dashboard.ver"><Dashboard /></PermissionRoute>} />
            <Route path="mi-cuenta" element={<ClienteDashboard />} />
            <Route path="clientes" element={<PermissionRoute permiso="clientes.ver_lista"><TablaClientesAvanzada /></PermissionRoute>} />
            <Route path="clientes/:id" element={<PermissionRoute permiso="clientes.ver_detalle"><ClienteDetalleAvanzado /></PermissionRoute>} />
            <Route path="ventas/dashboard" element={<PermissionRoute permiso="ventas.ver_dashboard"><VentasDashboard /></PermissionRoute>} />
            <Route path="ventas/notificaciones" element={<PermissionRoute permiso="ventas.ver_notificaciones"><VentasNotificaciones /></PermissionRoute>} />
            <Route path="ventas/crm" element={<PermissionRoute permiso="ventas.ver_crm"><VentasCRM /></PermissionRoute>} />
            <Route path="ventas/crm/lead/:id" element={<PermissionRoute permiso="ventas.ver_crm"><CRMLeadDetalle /></PermissionRoute>} />
            <Route path="ventas/ventas" element={<PermissionRoute permiso="ventas.ver_ventas"><VentasVentas /></PermissionRoute>} />
            <Route path="ventas/biblioteca" element={<PermissionRoute permiso="ventas.ver_biblioteca"><VentasBiblioteca /></PermissionRoute>} />
            <Route path="ventas/wallet" element={<PermissionRoute permiso="ventas.ver_wallet"><VentasWallet /></PermissionRoute>} />
            <Route path="ventas/calendario" element={<PermissionRoute permiso="ventas.ver_calendario"><VentasCalendario /></PermissionRoute>} />
            <Route path="ventas/ajustes" element={<PermissionRoute permiso="ventas.ver_ajustes"><VentasAjustes /></PermissionRoute>} />

            {/* Generales */}
            <Route path="notificaciones" element={<Notificaciones />} />
            <Route path="crm" element={<PermissionRoute permiso="crm.ver"><CRM /></PermissionRoute>} />
            <Route path="paquetes-clientes" element={<PermissionRoute permiso="paquetes.ver"><PaquetesClientes /></PermissionRoute>} />
            <Route path="documentacion/facturas" element={<PermissionRoute permiso="documentacion.ver"><Facturas /></PermissionRoute>} />
            <Route path="documentacion/contrato" element={<PermissionRoute permiso="documentacion.ver"><Contrato /></PermissionRoute>} />
            <Route path="reuniones" element={<PermissionRoute permiso="reuniones.ver"><Reuniones /></PermissionRoute>} />
            <Route path="archivos" element={<PermissionRoute permiso="archivos.ver"><Archivos /></PermissionRoute>} />
            <Route path="madrigalito" element={<PermissionRoute permiso="madrigalito.ver"><Madrigalito /></PermissionRoute>} />
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
      </ToastProvider>
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
