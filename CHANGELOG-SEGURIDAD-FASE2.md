# CHANGELOG - Seguridad Fase 2

**Fecha:** 2026-02-19
**Objetivo:** Seguridad avanzada, auditoria, Edge Functions, hardening, catalogo de permisos completo

---

## Archivos Creados

| Archivo | Descripcion |
|---|---|
| `src/pages/AuditLog.jsx` | Pagina de visualizacion de logs de auditoria con filtros, paginacion y diff |
| `supabase/functions/eliminar-usuario/index.ts` | Edge Function: eliminar usuario con validacion de jerarquia |
| `supabase/functions/cambiar-rol-usuario/index.ts` | Edge Function: cambiar rol con validacion de nivel |
| `supabase/functions/eliminar-cliente/index.ts` | Edge Function: eliminar cliente con cascada |
| `supabase/functions/cambiar-permisos-rol/index.ts` | Edge Function: cambiar permisos de un rol |
| `sql/005-auditoria-fase2.sql` | SQL consolidado del sistema de auditoria |
| `sql/006-hardening-fase2.sql` | SQL consolidado de hardening y permisos nuevos |
| `public/_headers` | Headers de seguridad para Cloudflare Pages |

## Archivos Modificados

| Archivo | Cambios |
|---|---|
| `src/contexts/AuthContext.jsx` | Login/logout registrados en audit_log + expiracion de sesion 24h |
| `src/App.jsx` | Ruta `/audit-log` con PermissionRoute `sistema.logs` |
| `src/components/Layout.jsx` | Item "Registro de Actividad" en sidebar + icono ScrollText |
| `src/pages/Usuarios.jsx` | Edge Functions para eliminar/cambiar rol + filtro jerarquia en selector + MODULOS ampliados |
| `src/pages/Roles.jsx` | Edge Function para cambiar permisos + MODULOS ampliados |
| `src/pages/ClienteDetalleAvanzado.jsx` | Edge Function para eliminar cliente |

---

## SQL Ejecutado en Supabase

### PASO 1: Sistema de Auditoria

**1A: Tabla `audit_log`** - OK
- 16 columnas: usuario, accion, categoria, descripcion, datos antes/despues, campos modificados
- 7 indices para consultas frecuentes
- RLS activado: solo `sistema.logs` puede leer

**1B: Funcion `registrar_auditoria()`** - OK
- SECURITY DEFINER
- Resuelve email/nombre/rol del usuario automaticamente

**1C: Trigger `fn_audit_trigger()`** - OK
- EXCEPTION WHEN OTHERS: si falla la auditoria, la operacion original NO se bloquea
- Detecta campos modificados automaticamente con `jsonb_each`
- 5 triggers aplicados: usuarios, roles, roles_permisos, usuarios_permisos, clientes
- 14 event triggers totales (INSERT/UPDATE/DELETE por tabla)

**Permiso `sistema.logs`** creado y asignado a Directivo Comercial y Directivo Clientes

### PASO 3A-3B: Anti-escalacion

**Funcion `get_user_protected_fields()`** - OK
- SECURITY DEFINER STABLE para evitar recursion con RLS

**Politica RESTRICTIVE `usuarios_no_auto_escalation`** - OK
- Un usuario NO puede cambiar su propio `tipo`, `rol_id` o `activo`
- Politica AS RESTRICTIVE: se aplica como AND con las demas politicas (no OR)

### PASO 3C: Rate Limiting

**Tabla `rate_limits`** - OK
- Indice compuesto: (usuario_id, accion, created_at)
- RLS activado

**Funcion `check_rate_limit()`** - OK
- Parametros: max 10/hora, 50/dia (configurable)
- Registra la accion automaticamente si pasa el check

**Funcion `limpiar_rate_limits()`** - OK
- Elimina registros > 7 dias (para usar como cron job)

### PASO 4: Catalogo de Permisos

**21 permisos nuevos creados:**

| Modulo | Permisos |
|---|---|
| notificaciones | ver, ver_todas, configurar |
| archivos | ver_todos, subir, editar, eliminar |
| documentacion | crear, editar, eliminar |
| madrigalito | usar, configurar |
| paquetes | ver, crear, editar, eliminar |
| notas | ver, crear, editar, eliminar |
| historial | ver |

**Total catalogo:** 93 permisos en 18 modulos

**Asignacion a roles:**
- Directivo Comercial/Clientes: acceso amplio (20 permisos nuevos + sistema.logs)
- Contable: acceso limitado (7 permisos nuevos)
- Media Buyer: acceso intermedio (9 permisos nuevos)
- Comercial: acceso basico (6 permisos nuevos)
- Creativo: acceso minimo (4 permisos nuevos)

---

## Edge Functions Creadas

| Funcion | Endpoint | Validaciones |
|---|---|---|
| `eliminar-usuario` | `/functions/v1/eliminar-usuario` | Permiso, auto-eliminacion, jerarquia, soft delete |
| `cambiar-rol-usuario` | `/functions/v1/cambiar-rol-usuario` | Permiso, Super Admin, nivel del nuevo rol |
| `eliminar-cliente` | `/functions/v1/eliminar-cliente` | Permiso, asignacion, dependencias, cascada |
| `cambiar-permisos-rol` | `/functions/v1/cambiar-permisos-rol` | Permiso, Super Admin, nivel de rol |

**NOTA:** Las Edge Functions deben desplegarse con `supabase functions deploy <nombre>`. El service_role_key debe configurarse como secret en Supabase.

---

## Problemas Encontrados y Soluciones

1. **Anti-escalacion RLS**: Las politicas RLS no tienen acceso a `OLD` y `NEW` como los triggers. Solucion: crear funcion SECURITY DEFINER `get_user_protected_fields()` y usar subquery en WITH CHECK.

2. **Recursion RLS en subquery**: Al consultar la tabla `usuarios` dentro de una politica de la misma tabla, se produce recursion. Solucion: la funcion helper es SECURITY DEFINER (bypassa RLS para la subquery interna).

3. **Edge Functions no desplegadas**: Las funciones se crearon como archivos locales. Requieren `supabase functions deploy` desde un entorno con el CLI de Supabase instalado y configurado.

---

## Estado de Seguridad Final (Checklist)

| Control | Estado |
|---|---|
| Credenciales en .env | CERRADO (Fase 1) |
| PermissionRoute en todas las rutas | CERRADO (Fase 1) |
| RLS en TODAS las tablas principales | CERRADO (Fase 1) - 20 tablas, 72 politicas |
| WITH CHECK en INSERT/UPDATE | CERRADO (Fase 1) |
| tienePermiso en UI | CERRADO (Fase 1) |
| Console.logs limpios | CERRADO (Fase 1) |
| Sistema de auditoria | CERRADO (Fase 2) - audit_log + 5 triggers |
| Registro login/logout | CERRADO (Fase 2) |
| Pagina visualizacion logs | CERRADO (Fase 2) - /audit-log |
| Edge Functions operaciones criticas | CREADAS (Fase 2) - pendiente deploy |
| Frontend usa Edge Functions | CERRADO (Fase 2) |
| Anti-escalacion de privilegios | CERRADO (Fase 2) - RLS RESTRICTIVE |
| Validacion jerarquia en UI | CERRADO (Fase 2) - selector de roles filtrado |
| Rate limiting | CERRADO (Fase 2) - tabla + funcion |
| Security headers | CERRADO (Fase 2) - public/_headers |
| Expiracion de sesion | CERRADO (Fase 2) - 24h inactividad |
| Catalogo permisos completo | CERRADO (Fase 2) - 93 permisos, 18 modulos |
| Permisos asignados a roles | CERRADO (Fase 2) |

---

## Pendiente para Fase 3

| Item | Descripcion | Prioridad |
|---|---|---|
| Deploy Edge Functions | `supabase functions deploy` en entorno con CLI | Alta |
| 2FA (Autenticacion de dos factores) | Activar MFA en Supabase Auth | Alta |
| Backups automaticos | Configurar backups de la BD en Supabase | Alta |
| Monitorizacion | Alertas cuando se detectan patrones sospechosos | Media |
| Cron job limpiar rate_limits | Programar `limpiar_rate_limits()` cada semana | Media |
| Cron job limpiar audit_log | Archivar logs > 90 dias para rendimiento | Baja |
| Alertas por email | Notificar a admin cuando hay login fallido repetido | Media |
| CSP mas estricto | Eliminar 'unsafe-inline' y 'unsafe-eval' cuando sea posible | Baja |
| Audit log: IP y User-Agent | Capturar desde el frontend via header custom | Baja |
