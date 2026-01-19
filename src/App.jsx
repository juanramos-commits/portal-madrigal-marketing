import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Páginas públicas
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ActivarCuenta from './pages/ActivarCuenta'

// Páginas protegidas
import Dashboard from './pages/Dashboard'
import TablaClientesAvanzada from './pages/TablaClientesAvanzada'
import ClienteDetalleAvanzado from './pages/ClienteDetalleAvanzado'
import Usuarios from './pages/Usuarios'
import Roles from './pages/Roles'

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

          {/* Rutas protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<TablaClientesAvanzada />} />
            <Route path="clientes/:id" element={<ClienteDetalleAvanzado />} />
            <Route path="tareas" element={<PlaceholderPage title="Tareas" />} />
            <Route path="sugerencias" element={<PlaceholderPage title="Sugerencias" />} />
            
            {/* Admin */}
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="roles" element={<Roles />} />
          </Route>

          {/* Ruta por defecto */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
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
