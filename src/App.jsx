import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionRoute from './components/PermissionRoute'
import Layout from './components/Layout'

// Páginas públicas
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ActivarCuenta = lazy(() => import('./pages/ActivarCuenta'))
const PoliticaPrivacidad = lazy(() => import('./pages/PoliticaPrivacidad'))

// Páginas protegidas
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ClienteDashboard = lazy(() => import('./pages/ClienteDashboard'))
const TablaClientesAvanzada = lazy(() => import('./pages/TablaClientesAvanzada'))
const ClienteDetalleAvanzado = lazy(() => import('./pages/ClienteDetalleAvanzado'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Roles = lazy(() => import('./pages/Roles'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const SecurityAlerts = lazy(() => import('./pages/SecurityAlerts'))
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'))
const Seguridad = lazy(() => import('./pages/Seguridad'))

// Páginas de Ventas
const VentasDashboard = lazy(() => import('./pages/ventas/VentasDashboard'))
const VentasNotificaciones = lazy(() => import('./pages/ventas/VentasNotificaciones'))
const VentasCRM = lazy(() => import('./pages/ventas/VentasCRM'))
const CRMLeadDetalle = lazy(() => import('./components/ventas/CRMLeadDetalle'))
const VentasBiblioteca = lazy(() => import('./pages/ventas/VentasBiblioteca'))
const VentasWallet = lazy(() => import('./pages/ventas/VentasWallet'))
const VentasVentas = lazy(() => import('./pages/ventas/VentasVentas'))
const VentasCalendario = lazy(() => import('./pages/ventas/Calendario'))
const VentasAjustes = lazy(() => import('./pages/ventas/VentasAjustes'))

// Páginas generales
const Notificaciones = lazy(() => import('./pages/Notificaciones'))
const CRM = lazy(() => import('./pages/CRM'))
const PaquetesClientes = lazy(() => import('./pages/PaquetesClientes'))
const Facturas = lazy(() => import('./pages/documentacion/Facturas'))
const Contrato = lazy(() => import('./pages/documentacion/Contrato'))
const Reuniones = lazy(() => import('./pages/Reuniones'))
const Archivos = lazy(() => import('./pages/Archivos'))
const Madrigalito = lazy(() => import('./pages/Madrigalito'))

// Spinner de carga para Suspense
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
      <div className="spinner"></div>
    </div>
  )
}

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
        <Suspense fallback={<PageLoader />}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
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
