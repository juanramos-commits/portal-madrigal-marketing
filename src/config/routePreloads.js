// Map of route paths to their dynamic import functions.
// Calling a preload function triggers Vite to fetch the chunk without rendering.
// The import paths MUST match the lazy() calls in App.jsx exactly.

const preloads = {
  // Ventas module
  '/ventas/dashboard': () => import('../pages/ventas/VentasDashboard'),
  '/ventas/crm': () => import('../pages/ventas/VentasCRM'),
  '/ventas/ventas': () => import('../pages/ventas/VentasVentas'),
  '/ventas/wallet': () => import('../pages/ventas/VentasWallet'),
  '/ventas/calendario': () => import('../pages/ventas/Calendario'),
  '/ventas/biblioteca': () => import('../pages/ventas/VentasBiblioteca'),
  '/ventas/notificaciones': () => import('../pages/ventas/VentasNotificaciones'),
  '/ventas/ajustes': () => import('../pages/ventas/VentasAjustes'),
  '/ventas/enlaces': () => import('../pages/ventas/VentasEnlaces'),
  '/ventas/email': () => import('../pages/ventas/EmailDashboard'),
  '/cold-email': () => import('../pages/ventas/ColdEmail'),
  // Admin / general
  '/dashboard': () => import('../pages/Dashboard'),
  '/clientes': () => import('../pages/TablaClientesAvanzada'),
  '/usuarios': () => import('../pages/Usuarios'),
  '/roles': () => import('../pages/Roles'),
  '/notificaciones': () => import('../pages/Notificaciones'),
  '/audit-log': () => import('../pages/AuditLog'),
  '/mi-seguridad': () => import('../pages/Seguridad'),
}

// Set of already-preloaded paths to avoid duplicate fetches
const preloaded = new Set()

/**
 * Preload a route's chunk if it hasn't been loaded yet.
 * Safe to call multiple times — each path is fetched at most once.
 */
export function preloadRoute(path) {
  if (preloaded.has(path)) return
  const loader = preloads[path]
  if (loader) {
    preloaded.add(path)
    loader()
  }
}

/**
 * Preload multiple routes at once.
 */
export function preloadRoutes(paths) {
  paths.forEach(preloadRoute)
}
