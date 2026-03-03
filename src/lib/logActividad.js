import { supabase } from './supabase'

/**
 * Registra actividad en ventas_log_global (fire-and-forget).
 * Nunca bloquea la UI ni lanza errores.
 *
 * @param {'auth'|'crm'|'ventas'|'wallet'|'ajustes'|'calendario'|'biblioteca'} modulo
 * @param {string} accion - login, logout, crear, editar, eliminar, aprobar, rechazar, cambio_etapa, asignar, devolucion...
 * @param {string} descripcion - Texto legible para el log
 * @param {{ entidad?: string, entidad_id?: string, datos?: object }} [opts]
 */
export function logActividad(modulo, accion, descripcion, opts = {}) {
  ;(async () => {
    try {
      await supabase.rpc('ventas_log', {
        p_modulo: modulo,
        p_accion: accion,
        p_descripcion: descripcion,
        p_entidad: opts.entidad || null,
        p_entidad_id: opts.entidad_id || null,
        p_datos: opts.datos || {},
      })
    } catch {
      // Fire-and-forget: logging never breaks the app
    }
  })()
}
