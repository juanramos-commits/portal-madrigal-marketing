import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionRoute from './components/PermissionRoute'
import Layout from './components/Layout'
import { preloadRoute } from './config/routePreloads'

// Wraps ErrorBoundary so it resets on navigation (route change)
function LocationAwareErrorBoundary({ children }) {
  const location = useLocation()
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
}

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
const VentasEnlaces = lazy(() => import('./pages/ventas/VentasEnlaces'))
const ReservarCita = lazy(() => import('./pages/ReservarCita'))

// Páginas de Email Marketing
const EmailDashboard = lazy(() => import('./pages/ventas/EmailDashboard'))
const EmailCampaigns = lazy(() => import('./pages/ventas/EmailCampaigns'))
const EmailCampaignEditor = lazy(() => import('./pages/ventas/EmailCampaignEditor'))
const EmailTemplates = lazy(() => import('./pages/ventas/EmailTemplates'))
const EmailContacts = lazy(() => import('./pages/ventas/EmailContacts'))
const EmailSegments = lazy(() => import('./pages/ventas/EmailSegments'))
const EmailAutomations = lazy(() => import('./pages/ventas/EmailAutomations'))
const EmailAnalytics = lazy(() => import('./pages/ventas/EmailAnalytics'))
const EmailSettings = lazy(() => import('./pages/ventas/EmailSettings'))
const EmailPreferences = lazy(() => import('./components/ventas/email/PreferencesForm'))

// Páginas de Outreach
const OutreachDashboard = lazy(() => import('./pages/ventas/OutreachDashboard'))
const OutreachDomains = lazy(() => import('./pages/ventas/OutreachDomains'))
const OutreachInboxes = lazy(() => import('./pages/ventas/OutreachInboxes'))
const OutreachLists = lazy(() => import('./pages/ventas/OutreachLists'))
const OutreachListDetail = lazy(() => import('./pages/ventas/OutreachListDetail'))
const OutreachCampaigns = lazy(() => import('./pages/ventas/OutreachCampaigns'))
const OutreachCampaignEditor = lazy(() => import('./pages/ventas/OutreachCampaignEditor'))
const OutreachReplies = lazy(() => import('./pages/ventas/OutreachReplies'))
const OutreachAnalytics = lazy(() => import('./pages/ventas/OutreachAnalytics'))
const OutreachSettings = lazy(() => import('./pages/ventas/OutreachSettings'))

// Páginas de Agentes IA
const AgentesIA = lazy(() => import('./pages/ventas/AgentesIA'))

// Páginas generales
const Notificaciones = lazy(() => import('./pages/Notificaciones'))
const CRM = lazy(() => import('./pages/CRM'))
const PaquetesClientes = lazy(() => import('./pages/PaquetesClientes'))
const Facturas = lazy(() => import('./pages/documentacion/Facturas'))
const Contrato = lazy(() => import('./pages/documentacion/Contrato'))
const Reuniones = lazy(() => import('./pages/Reuniones'))
const Archivos = lazy(() => import('./pages/Archivos'))
const Madrigalito = lazy(() => import('./pages/Madrigalito'))

// Spinner de carga para Suspense — estilos inline para que sea visible antes del CSS externo
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0', minHeight: '100vh' }}>
      <div style={{
        width: 28, height: 28,
        border: '2.5px solid rgba(255,255,255,.08)',
        borderTopColor: '#2ee59d',
        borderRadius: '50%',
        animation: 'spin .8s linear infinite',
      }} />
    </div>
  )
}

// Redirige al primer dashboard accesible según permisos del usuario
function SmartRedirect() {
  const { usuario, permisos, permisosLoaded, permisosError, tienePermiso, loading, refrescarPermisos } = useAuth()
  if (loading) return <PageLoader />
  if (usuario?.tipo === 'cliente') return <Navigate to="/mi-cuenta" replace />

  // Esperar a que los permisos estén cargados antes de decidir
  if (usuario && usuario.tipo !== 'super_admin' && !permisosLoaded) return <PageLoader />

  // Si hubo error cargando permisos, mostrar mensaje con retry
  if (permisosError && permisos.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
          <p style={{ color: '#ef4444', fontSize: 16, marginBottom: 16 }}>Error cargando permisos. Verifica tu conexión.</p>
          <button
            onClick={() => refrescarPermisos()}
            style={{ padding: '10px 24px', background: '#2ee59d', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (tienePermiso('ventas.dashboard.ver')) {
    preloadRoute('/ventas/dashboard')
    return <Navigate to="/ventas/dashboard" replace />
  }
  if (tienePermiso('dashboard.ver')) {
    preloadRoute('/dashboard')
    return <Navigate to="/dashboard" replace />
  }
  return <Navigate to="/mi-seguridad" replace />
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <LocationAwareErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/activar-cuenta" element={<ActivarCuenta />} />
          <Route path="/privacidad" element={<PoliticaPrivacidad />} />
          <Route path="/reservar/:slug" element={<ReservarCita />} />
          <Route path="/preferencias-email/:token" element={<EmailPreferences />} />

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
            <Route path="ventas/dashboard" element={<PermissionRoute permiso="ventas.dashboard.ver"><VentasDashboard /></PermissionRoute>} />
            <Route path="ventas/notificaciones" element={<PermissionRoute permiso="ventas.notificaciones.ver"><VentasNotificaciones /></PermissionRoute>} />
            <Route path="ventas/crm" element={<PermissionRoute permiso="ventas.crm.ver"><VentasCRM /></PermissionRoute>} />
            <Route path="ventas/crm/lead/:id" element={<PermissionRoute permiso="ventas.crm.ver"><CRMLeadDetalle /></PermissionRoute>} />
            <Route path="ventas/ventas" element={<PermissionRoute permiso="ventas.ventas.ver"><VentasVentas /></PermissionRoute>} />
            <Route path="ventas/biblioteca" element={<PermissionRoute permiso="ventas.biblioteca.ver"><VentasBiblioteca /></PermissionRoute>} />
            <Route path="ventas/wallet" element={<PermissionRoute permiso="ventas.wallet.ver"><VentasWallet /></PermissionRoute>} />
            <Route path="ventas/calendario" element={<PermissionRoute permiso="ventas.calendario.ver"><VentasCalendario /></PermissionRoute>} />
            <Route path="ventas/ajustes" element={<PermissionRoute permiso="ventas.ajustes.ver"><VentasAjustes /></PermissionRoute>} />
            <Route path="ventas/enlaces" element={<PermissionRoute permiso="ventas.enlaces.ver"><VentasEnlaces /></PermissionRoute>} />
            <Route path="ventas/email" element={<PermissionRoute permiso="ventas.email.ver"><EmailDashboard /></PermissionRoute>} />
            <Route path="ventas/email/campanas" element={<PermissionRoute permiso="ventas.email.campanas.ver"><EmailCampaigns /></PermissionRoute>} />
            <Route path="ventas/email/campanas/:id" element={<PermissionRoute permiso="ventas.email.campanas.crear"><EmailCampaignEditor /></PermissionRoute>} />
            <Route path="ventas/email/plantillas" element={<PermissionRoute permiso="ventas.email.plantillas.ver"><EmailTemplates /></PermissionRoute>} />
            <Route path="ventas/email/contactos" element={<PermissionRoute permiso="ventas.email.contactos.ver"><EmailContacts /></PermissionRoute>} />
            <Route path="ventas/email/segmentos" element={<PermissionRoute permiso="ventas.email.segmentos.ver"><EmailSegments /></PermissionRoute>} />
            <Route path="ventas/email/automaciones" element={<PermissionRoute permiso="ventas.email.automaciones.ver"><EmailAutomations /></PermissionRoute>} />
            <Route path="ventas/email/analytics" element={<PermissionRoute permiso="ventas.email.analytics.ver"><EmailAnalytics /></PermissionRoute>} />
            <Route path="ventas/email/ajustes" element={<PermissionRoute permiso="ventas.email.ajustes.ver"><EmailSettings /></PermissionRoute>} />
            <Route path="ventas/agentes-ia" element={<PermissionRoute permiso="ventas.agentes_ia.ver"><AgentesIA /></PermissionRoute>} />
            <Route path="ventas/outreach" element={<PermissionRoute permiso="ventas.outreach.ver"><OutreachDashboard /></PermissionRoute>} />
            <Route path="ventas/outreach/dominios" element={<PermissionRoute permiso="ventas.outreach.dominios.ver"><OutreachDomains /></PermissionRoute>} />
            <Route path="ventas/outreach/inboxes" element={<PermissionRoute permiso="ventas.outreach.inboxes.ver"><OutreachInboxes /></PermissionRoute>} />
            <Route path="ventas/outreach/listas" element={<PermissionRoute permiso="ventas.outreach.listas.ver"><OutreachLists /></PermissionRoute>} />
            <Route path="ventas/outreach/listas/:id" element={<PermissionRoute permiso="ventas.outreach.listas.ver"><OutreachListDetail /></PermissionRoute>} />
            <Route path="ventas/outreach/campanas" element={<PermissionRoute permiso="ventas.outreach.campanas.ver"><OutreachCampaigns /></PermissionRoute>} />
            <Route path="ventas/outreach/campanas/:id" element={<PermissionRoute permiso="ventas.outreach.campanas.crear"><OutreachCampaignEditor /></PermissionRoute>} />
            <Route path="ventas/outreach/respuestas" element={<PermissionRoute permiso="ventas.outreach.respuestas.ver"><OutreachReplies /></PermissionRoute>} />
            <Route path="ventas/outreach/analytics" element={<PermissionRoute permiso="ventas.outreach.analytics.ver"><OutreachAnalytics /></PermissionRoute>} />
            <Route path="ventas/outreach/ajustes" element={<PermissionRoute permiso="ventas.outreach.ajustes.ver"><OutreachSettings /></PermissionRoute>} />

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
        </LocationAwareErrorBoundary>
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
