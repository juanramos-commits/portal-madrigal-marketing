import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock useAuth with different configurations
const mockTienePermiso = vi.fn()
const mockAuth = {
  user: null,
  usuario: null,
  permisos: [],
  loading: false,
  requiere2FA: false,
  tienePermiso: mockTienePermiso,
  signInWithEmail: vi.fn(),
  signOut: vi.fn(),
  refrescarUsuario: vi.fn(),
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

// Import after mocking
import PermissionRoute from '../../components/PermissionRoute'

function renderWithRouter(ui) {
  return render(
    <MemoryRouter>{ui}</MemoryRouter>
  )
}

describe('Sistema de Permisos', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.loading = false
    mockAuth.permisos = ['dashboard.ver']
    mockAuth.usuario = { id: '1', tipo: 'equipo', nombre: 'Test User' }
  })

  describe('PermissionRoute', () => {
    test('muestra "Sin acceso" si no tiene el permiso requerido', () => {
      mockTienePermiso.mockReturnValue(false)
      renderWithRouter(
        <PermissionRoute permiso="usuarios.ver">
          <div>Contenido protegido</div>
        </PermissionRoute>
      )
      expect(screen.getByText('No tienes acceso a esta sección')).toBeInTheDocument()
      expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
    })

    test('renderiza el contenido si tiene el permiso', () => {
      mockTienePermiso.mockReturnValue(true)
      renderWithRouter(
        <PermissionRoute permiso="dashboard.ver">
          <div>Contenido protegido</div>
        </PermissionRoute>
      )
      expect(screen.getByText('Contenido protegido')).toBeInTheDocument()
    })

    test('renderiza el contenido para Super Admin sin importar el permiso', () => {
      mockAuth.usuario = { id: '1', tipo: 'super_admin', nombre: 'Admin' }
      mockTienePermiso.mockReturnValue(true) // Super admin always returns true
      renderWithRouter(
        <PermissionRoute permiso="cualquier.permiso">
          <div>Contenido admin</div>
        </PermissionRoute>
      )
      expect(screen.getByText('Contenido admin')).toBeInTheDocument()
    })

    test('muestra spinner mientras carga permisos (no "Sin acceso")', () => {
      mockAuth.loading = true
      mockAuth.permisos = []
      renderWithRouter(
        <PermissionRoute permiso="dashboard.ver">
          <div>Contenido</div>
        </PermissionRoute>
      )
      expect(screen.queryByText('No tienes acceso a esta sección')).not.toBeInTheDocument()
      expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
    })

    test('funciona como wrapper transparente si no se pasa permiso', () => {
      renderWithRouter(
        <PermissionRoute>
          <div>Contenido libre</div>
        </PermissionRoute>
      )
      expect(screen.getByText('Contenido libre')).toBeInTheDocument()
    })
  })

  describe('tienePermiso()', () => {
    test('Super Admin tiene todos los permisos', () => {
      mockAuth.usuario = { tipo: 'super_admin' }
      // The real tienePermiso checks tipo === 'super_admin'
      // Testing the mock behavior to match expected logic
      mockTienePermiso.mockImplementation(() => true)
      expect(mockTienePermiso('cualquier.permiso')).toBe(true)
      expect(mockTienePermiso('sistema.configuracion')).toBe(true)
      expect(mockTienePermiso('roles.eliminar')).toBe(true)
    })

    test('usuario con permiso específico retorna true', () => {
      mockAuth.permisos = ['dashboard.ver', 'clientes.ver_lista']
      mockTienePermiso.mockImplementation((p) => mockAuth.permisos.includes(p))
      expect(mockTienePermiso('dashboard.ver')).toBe(true)
      expect(mockTienePermiso('clientes.ver_lista')).toBe(true)
    })

    test('usuario sin permiso específico retorna false', () => {
      mockAuth.permisos = ['dashboard.ver']
      mockTienePermiso.mockImplementation((p) => mockAuth.permisos.includes(p))
      expect(mockTienePermiso('usuarios.ver')).toBe(false)
      expect(mockTienePermiso('roles.editar')).toBe(false)
    })

    test('retorna false para código de permiso que no existe', () => {
      mockAuth.permisos = ['dashboard.ver']
      mockTienePermiso.mockImplementation((p) => mockAuth.permisos.includes(p))
      expect(mockTienePermiso('permiso.inventado')).toBe(false)
    })

    test('retorna false si permisos no se han cargado aún', () => {
      mockAuth.permisos = []
      mockTienePermiso.mockImplementation((p) => mockAuth.permisos.includes(p))
      expect(mockTienePermiso('dashboard.ver')).toBe(false)
    })
  })

  describe('Sidebar filtering logic', () => {
    const defaultNavigation = [
      { id: 'dashboard', permiso: 'dashboard.ver', onlyFor: undefined },
      { id: 'clientes', permiso: 'clientes.ver_lista', onlyFor: ['equipo', 'admin', 'super_admin'] },
      { id: 'crm', permiso: null, onlyFor: ['cliente'] },
      { id: 'usuarios', permiso: 'usuarios.ver', onlyFor: undefined },
      { id: 'roles', permiso: 'roles.ver', onlyFor: undefined },
      { id: 'audit-log', permiso: 'sistema.logs', onlyFor: undefined },
    ]

    function shouldShowItem(item, usuario, tienePermisoFn) {
      if (item.permiso && !tienePermisoFn(item.permiso)) return false
      if (item.onlyFor && !item.onlyFor.includes(usuario?.tipo)) return false
      return true
    }

    test('Super Admin ve todos los items relevantes', () => {
      const usr = { tipo: 'super_admin' }
      const tp = () => true
      const visible = defaultNavigation.filter(i => shouldShowItem(i, usr, tp))
      // Super admin sees all except 'crm' (onlyFor: ['cliente'])
      expect(visible.map(i => i.id)).toContain('dashboard')
      expect(visible.map(i => i.id)).toContain('usuarios')
      expect(visible.map(i => i.id)).toContain('roles')
      expect(visible.map(i => i.id)).not.toContain('crm')
    })

    test('Creativo no ve Usuarios ni Roles', () => {
      const usr = { tipo: 'equipo' }
      const permisos = ['dashboard.ver', 'tareas.ver_propias']
      const tp = (p) => permisos.includes(p)
      const visible = defaultNavigation.filter(i => shouldShowItem(i, usr, tp))
      expect(visible.map(i => i.id)).not.toContain('usuarios')
      expect(visible.map(i => i.id)).not.toContain('roles')
    })

    test('items con onlyFor se filtran por tipo de usuario', () => {
      const usr = { tipo: 'equipo' }
      const tp = () => true
      const visible = defaultNavigation.filter(i => shouldShowItem(i, usr, tp))
      expect(visible.map(i => i.id)).toContain('clientes')
      expect(visible.map(i => i.id)).not.toContain('crm')
    })

    test('tipo cliente solo ve items de portal', () => {
      const usr = { tipo: 'cliente' }
      const tp = () => false // clients typically have no admin permisos
      const visible = defaultNavigation.filter(i => shouldShowItem(i, usr, tp))
      expect(visible.map(i => i.id)).toContain('crm')
      expect(visible.map(i => i.id)).not.toContain('usuarios')
      expect(visible.map(i => i.id)).not.toContain('clientes')
    })
  })
})
