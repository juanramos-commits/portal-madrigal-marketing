import { logger } from '../lib/logger'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNotificacionesBadge } from '../hooks/useNotificacionesBadge'
import NotificacionesBadge from './ventas/NotificacionesBadge'

// Modifier para restringir movimiento vertical
const restrictToVerticalAxis = ({ transform }) => ({
  ...transform,
  x: 0,
})

const Icons = {
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Tasks: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Users: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  UserCheck: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
    </svg>
  ),
  Package: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  FileText: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  File: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Folder: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Target: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Shield: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  UserCog: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><circle cx="18" cy="16" r="3"/><path d="M18 13v1"/><path d="M18 19v1"/><path d="m21 16-1 .5"/><path d="m15.5 18.5-1 .5"/><path d="m15 16 1 .5"/><path d="m20.5 18.5 1 .5"/>
    </svg>
  ),
  Messages: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  GripVertical: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
    </svg>
  ),
  ScrollText: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2"/>
    </svg>
  ),
  ShieldAlert: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Lock: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  ShoppingCart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  Wallet: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  BookOpen: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  DollarSign: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}

function SortableMenuItem({ item, isActive, onNavigate }) {
  const [isHovered, setIsHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = item.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`nav-item ${isActive ? 'active' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}
      >
        <div
          onClick={() => onNavigate(item.href)}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}
        >
          <Icon />
          <span className="nav-label">{item.name}</span>
        </div>
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            opacity: isHovered ? 0.6 : 0,
            transition: 'opacity 0.2s',
            padding: '4px'
          }}
        >
          <Icons.GripVertical />
        </div>
      </div>
    </div>
  )
}

function SortableDocMenuItem({ item, isActive, onClick }) {
  const [isHovered, setIsHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = item.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`nav-item ${isActive ? 'active' : ''}`}
        style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}
      >
        <div
          onClick={onClick}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}
        >
          <Icon />
          <span className="nav-label">{item.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onClick={onClick}
            style={{ transform: item.isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', cursor: 'pointer' }}
          >
            <Icons.ChevronDown />
          </div>
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              opacity: isHovered ? 0.6 : 0,
              transition: 'opacity 0.2s',
              padding: '4px'
            }}
          >
            <Icons.GripVertical />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { usuario, permisos, signOut, tienePermiso } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [ventasMenuOpen, setVentasMenuOpen] = useState(() => location.pathname.startsWith('/ventas'))
  const [porOrganizarMenuOpen, setPorOrganizarMenuOpen] = useState(() => !location.pathname.startsWith('/ventas') && location.pathname !== '/')
  const [menuItems, setMenuItems] = useState([])
  const saveTimeoutRef = useRef(null)

  const { contador: notifContador } = useNotificacionesBadge()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const defaultNavigation = [
    { id: 'ventas', name: 'Ventas', href: '/ventas', icon: Icons.ShoppingCart, permiso: null, type: 'submenu', children: [
      { name: 'Dashboard', href: '/ventas/dashboard', icon: Icons.TrendingUp, permiso: 'ventas.dashboard.ver' },
      { name: 'Notificaciones', href: '/ventas/notificaciones', icon: Icons.Bell, permiso: 'ventas.notificaciones.ver' },
      { name: 'CRM', href: '/ventas/crm', icon: Icons.UserCheck, permiso: 'ventas.crm.ver' },
      { name: 'Ventas', href: '/ventas/ventas', icon: Icons.DollarSign, permiso: 'ventas.ventas.ver' },
      { name: 'Biblioteca', href: '/ventas/biblioteca', icon: Icons.BookOpen, permiso: 'ventas.biblioteca.ver' },
      { name: 'Wallet', href: '/ventas/wallet', icon: Icons.Wallet, permiso: 'ventas.wallet.ver' },
      { name: 'Calendario', href: '/ventas/calendario', icon: Icons.Calendar, permiso: 'ventas.calendario.ver' },
      { name: 'Ajustes', href: '/ventas/ajustes', icon: Icons.Settings, permiso: 'ventas.ajustes.ver' },
    ]},
    { id: 'por-organizar', name: 'Por organizar', href: '/por-organizar', icon: Icons.Folder, permiso: null, type: 'submenu', children: [
      { name: 'Dashboard', href: '/dashboard', icon: Icons.Dashboard, permiso: 'dashboard.ver' },
      { name: 'Notificaciones', href: '/notificaciones', icon: Icons.Bell, permiso: 'dashboard.ver' },
      { name: 'Tareas', href: '/tareas', icon: Icons.Tasks, permiso: 'tareas.ver_propias' },
      { name: 'Clientes', href: '/clientes', icon: Icons.Users, permiso: 'clientes.ver_lista' },
      { name: 'CRM', href: '/crm', icon: Icons.UserCheck, permiso: 'crm.ver' },
      { name: 'Paquetes de Clientes', href: '/paquetes-clientes', icon: Icons.Package, permiso: 'paquetes.ver' },
      { name: 'Facturas', href: '/documentacion/facturas', icon: Icons.File, permiso: 'documentacion.ver' },
      { name: 'Contrato', href: '/documentacion/contrato', icon: Icons.File, permiso: 'documentacion.ver' },
      { name: 'Reuniones', href: '/reuniones', icon: Icons.Calendar, permiso: 'reuniones.ver' },
      { name: 'Archivos', href: '/archivos', icon: Icons.Folder, permiso: 'archivos.ver' },
      { name: 'Madrigalito', href: '/madrigalito', icon: Icons.Target, permiso: 'madrigalito.ver' },
      { name: 'Usuarios', href: '/usuarios', icon: Icons.UserCog, permiso: 'usuarios.ver' },
      { name: 'Roles', href: '/roles', icon: Icons.Shield, permiso: 'roles.ver' },
      { name: 'Sugerencias', href: '/sugerencias', icon: Icons.Messages, permiso: 'sugerencias.ver_propias' },
      { name: 'Registro de Actividad', href: '/audit-log', icon: Icons.ScrollText, permiso: 'sistema.logs' },
      { name: 'Alertas de Seguridad', href: '/alertas-seguridad', icon: Icons.ShieldAlert, permiso: 'sistema.logs' },
      { name: 'Seguridad', href: '/seguridad-dashboard', icon: Icons.BarChart, permiso: 'sistema.configuracion' },
      { name: 'Mi Seguridad', href: '/mi-seguridad', icon: Icons.Lock, permiso: 'dashboard.ver' },
    ]}
  ]

  useEffect(() => {
    if (usuario?.id) {
      loadMenuOrder()
    }
  }, [usuario?.id])

  const loadMenuOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios_menu_order')
        .select('menu_order')
        .eq('usuario_id', usuario.id)
        .maybeSingle()

      if (error) {
        logger.error('Error loading menu order:', error)
        setMenuItems(defaultNavigation.filter(shouldShowItem))
        return
      }

      if (data?.menu_order) {
        const savedOrder = data.menu_order
        const orderedItems = savedOrder
          .map(id => defaultNavigation.find(item => item.id === id))
          .filter(item => item && shouldShowItem(item))

        const newItems = defaultNavigation.filter(
          item => !savedOrder.includes(item.id) && shouldShowItem(item)
        )

        setMenuItems([...orderedItems, ...newItems])
      } else {
        setMenuItems(defaultNavigation.filter(shouldShowItem))
      }
    } catch (error) {
      logger.error('Error loading menu order:', error)
      setMenuItems(defaultNavigation.filter(shouldShowItem))
    }
  }

  const saveMenuOrder = async (newOrder) => {
    try {
      const menuOrder = newOrder.map(item => item.id)

      // Primero eliminar el registro existente
      await supabase
        .from('usuarios_menu_order')
        .delete()
        .eq('usuario_id', usuario.id)

      // Luego insertar el nuevo
      const { error } = await supabase
        .from('usuarios_menu_order')
        .insert({
          usuario_id: usuario.id,
          menu_order: menuOrder
        })

      if (error) {
        logger.error('Error saving menu order:', error)
      }
    } catch (error) {
      logger.error('Error saving menu order:', error)
    }
  }

  const debouncedSave = (newOrder) => {
    // Cancelar guardado anterior si existe
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Guardar después de 1 segundo de inactividad
    saveTimeoutRef.current = setTimeout(() => {
      saveMenuOrder(newOrder)
    }, 1000)
  }

  const shouldShowItem = (item) => {
    if (item.permiso && !tienePermiso(item.permiso)) return false
    if (item.onlyFor && !item.onlyFor.includes(usuario?.tipo)) return false
    return true
  }

  const getVisibleChildren = (item) => {
    if (!item.children) return []
    return item.children.filter(child => {
      if (!child.permiso) return true
      return tienePermiso(child.permiso)
    })
  }

  const visibleSections = useMemo(() => {
    return menuItems
      .filter(item => {
        if (!shouldShowItem(item)) return false
        if (item.type === 'submenu') {
          return getVisibleChildren(item).length > 0
        }
        return true
      })
      .map(item => {
        if (item.type === 'submenu') {
          return { ...item, children: getVisibleChildren(item) }
        }
        return item
      })
  }, [menuItems, usuario, permisos])

  const sectionCount = visibleSections.filter(item => item.type === 'submenu').length
  const shouldFlatten = sectionCount === 1

  const flattenedItems = useMemo(() => {
    if (!shouldFlatten) return null
    const section = visibleSections.find(item => item.type === 'submenu')
    if (!section) return null
    return section.children
  }, [shouldFlatten, visibleSections])

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        debouncedSave(newOrder)
        return newOrder
      })
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const isActive = (href) => location.pathname === href || location.pathname.startsWith(href + '/')
  const getInitial = () => usuario?.nombre?.[0]?.toUpperCase() || usuario?.email?.[0]?.toUpperCase() || 'U'
  const getAvatarColor = () => {
    switch (usuario?.tipo) {
      case 'super_admin': return '#EF4444'
      case 'admin': return '#F59E0B'
      case 'equipo': return usuario?.rol?.color || '#3B82F6'
      case 'cliente': return '#10B981'
      default: return 'rgba(255,255,255,0.1)'
    }
  }

  const formatTipoUsuario = (tipo) => {
    const tipos = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'equipo': 'Equipo',
      'cliente': 'Cliente'
    }
    return tipos[tipo] || tipo
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/logo.png" alt="Madrigal" />
        </div>

        <nav className="nav">
          {shouldFlatten && flattenedItems ? (
            flattenedItems.map(child => {
              const Icon = child.icon
              return (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`nav-item ${isActive(child.href) ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <Icon />
                  <span className="nav-label" style={{ flex: 1 }}>{child.name}</span>
                  {child.href === '/ventas/notificaciones' && <NotificacionesBadge contador={notifContador} />}
                </Link>
              )
            })
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={visibleSections.map(item => item.id)} strategy={verticalListSortingStrategy}>
                {visibleSections.map((item) => {
                  if (item.type === 'submenu') {
                    const isOpen = item.id === 'ventas' ? ventasMenuOpen
                      : item.id === 'por-organizar' ? porOrganizarMenuOpen
                      : false
                    const toggleOpen = item.id === 'ventas' ? () => setVentasMenuOpen(!ventasMenuOpen)
                      : item.id === 'por-organizar' ? () => setPorOrganizarMenuOpen(!porOrganizarMenuOpen)
                      : () => {}

                    return (
                      <div key={item.id}>
                        <SortableDocMenuItem
                          item={{ ...item, isOpen }}
                          isActive={false}
                          onClick={toggleOpen}
                        />
                        {isOpen && item.children && (
                          <div style={{ paddingLeft: '32px', marginTop: '2px' }}>
                            {item.children.map(child => (
                              <Link key={child.href} to={child.href} className={`nav-item ${isActive(child.href) ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <child.icon />
                                <span className="nav-label" style={{ flex: 1 }}>{child.name}</span>
                                {child.href === '/ventas/notificaciones' && <NotificacionesBadge contador={notifContador} />}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <SortableMenuItem
                      key={item.id}
                      item={item}
                      isActive={isActive(item.href)}
                      onNavigate={(href) => {
                        setMobileMenuOpen(false)
                        navigate(href)
                      }}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" style={{ background: getAvatarColor() }}>
              {getInitial()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{usuario?.nombre || 'Usuario'}</div>
              <div className="sidebar-user-email">{usuario?.rol?.nombre || formatTipoUsuario(usuario?.tipo) || ''}</div>
            </div>
          </div>
          <button onClick={handleSignOut} className="nav-item" style={{ marginTop: '8px', color: 'var(--error)' }}>
            <Icons.LogOut />
            <span className="nav-label">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <div className={`sidebar-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={() => setMobileMenuOpen(false)} />

      <div className="main">
        <div className="page">
          <Outlet />
        </div>
      </div>

      <button
        className="mobile-menu-btn-float"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px',
          borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none', boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
          display: 'none', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 40, color: 'white'
        }}
      >
        <Icons.Menu />
      </button>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn-float { display: flex !important; }
          .app-shell:has(.crm-filters-overlay, .ui-modal-overlay, .crm-sheet-overlay, .vv-filters-overlay) > .mobile-menu-btn-float { display: none !important; }
        }
      `}</style>
    </div>
  )
}
