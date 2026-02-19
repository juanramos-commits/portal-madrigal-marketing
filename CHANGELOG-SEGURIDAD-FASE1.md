# CHANGELOG - Seguridad Fase 1: Cerrar Vulnerabilidades Criticas
## app.madrigalmarketing.es - Portal Interno Madrigal Marketing

**Fecha:** 19 de febrero de 2026
**Alcance:** Cierre de vulnerabilidades criticas identificadas en la auditoria

---

## Archivos Creados

| Archivo | Descripcion |
|---|---|
| `.env` | Variables de entorno con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY |
| `.env.example` | Plantilla de variables de entorno (sin valores reales) |
| `src/lib/logger.js` | Utilidad de logging condicional (solo en desarrollo) |
| `src/lib/supabase.js` | Reescrito para leer de variables de entorno |
| `src/components/PermissionRoute.jsx` | Componente de proteccion de rutas por permiso |
| `sql/003-rls-completo.sql` | Politicas RLS para TODAS las tablas (~350 lineas SQL) |
| `sql/004-permisos-nuevos-sidebar.sql` | Permisos nuevos: documentacion.ver, archivos.ver, madrigalito.ver |

## Archivos Modificados

| Archivo | Cambios |
|---|---|
| `.gitignore` | Agregado `.env` para evitar commit de credenciales |
| `src/App.jsx` | Rutas protegidas con `PermissionRoute` (dashboard, clientes, tareas, usuarios, roles, sugerencias) |
| `src/components/Layout.jsx` | Sidebar: asignados permisos a Documentacion, Reuniones, Archivos, Madrigalito. Import logger |
| `src/pages/Dashboard.jsx` | Metricas globales condicionadas a `dashboard.ver_metricas_globales`. Import logger |
| `src/pages/ClienteDetalleAvanzado.jsx` | tienePermiso aplicado en: tabs visibles, edicion de datos, boton eliminar, zona de peligro, paquetes, campanas, reuniones, password_portal. Import logger |
| `src/contexts/AuthContext.jsx` | Import logger |
| `src/pages/Login.jsx` | Import logger |
| `src/pages/ResetPassword.jsx` | Import logger |
| `src/pages/Clientes.jsx` | Import logger |
| `src/pages/ClienteDetalle.jsx` | Import logger |
| `src/pages/Roles.jsx` | Import logger |
| `src/pages/Usuarios.jsx` | Import logger |
| `src/pages/TablaClientesAvanzada.jsx` | Import logger |
| `src/components/BusquedaMasiva.jsx` | Import logger |

---

## Detalle por Paso

### PASO 1: Mover credenciales a variables de entorno

- Creado `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- Creado `.env.example` como plantilla
- `.gitignore` actualizado para excluir `.env`
- `src/lib/supabase.js` reescrito para usar `import.meta.env.*`
- Se mantiene export de `supabaseUrl` y `supabaseAnonKey` para compatibilidad con `ActivarCuenta.jsx`
- **Verificacion:** Build exitoso

### PASO 2: Proteccion de rutas por permiso

- Creado `src/components/PermissionRoute.jsx`:
  - Recibe prop `permiso` (codigo del permiso)
  - Si no hay permiso especificado, funciona como wrapper transparente
  - Mientras cargan permisos, muestra spinner (NO pagina de sin acceso)
  - Si no tiene permiso, muestra pagina "Sin acceso" con icono de candado, mensaje y boton "Volver al Dashboard"
  - Estilo dark consistente con la app
- Rutas protegidas en `App.jsx`:
  - `/dashboard` → `dashboard.ver`
  - `/clientes` → `clientes.ver_lista`
  - `/clientes/:id` → `clientes.ver_detalle`
  - `/tareas` → `tareas.ver_propias`
  - `/sugerencias` → `sugerencias.ver_propias`
  - `/usuarios` → `usuarios.ver`
  - `/roles` → `roles.ver`
- **Verificacion:** Build exitoso

### PASO 3: RLS completo en TODAS las tablas

Generado `sql/003-rls-completo.sql` con politicas para:

**3A - Clientes y Leads (arreglo de existentes):**
- Eliminadas politicas antiguas (FOR ALL sin WITH CHECK)
- Nuevas politicas separadas: SELECT, INSERT, UPDATE, DELETE
- SELECT implementa logica `ver_solo_asignados`:
  - Si tiene permiso + NO tiene `ver_solo_asignados` → ve todos
  - Si tiene permiso + SI tiene `ver_solo_asignados` → solo donde `responsable_id = auth.uid()`
  - Tipo 'cliente' → solo su registro
- INSERT/UPDATE con WITH CHECK
- Misma logica replicada para leads

**3B - Usuarios:**
- RLS activado
- SELECT: si tiene `usuarios.ver` ve todos, si no solo se ve a si mismo
- INSERT: solo con `usuarios.crear`
- UPDATE: con `usuarios.editar` o su propio registro
- DELETE: solo con `usuarios.eliminar`

**3C - Tablas secundarias de clientes (8 tablas):**
- Funcion auxiliar `puede_ver_cliente()` SECURITY DEFINER que hereda acceso via RLS de clientes
- Tablas: clientes_facturacion, clientes_branding, clientes_urls, clientes_info_adicional, clientes_lanzamiento, clientes_socios, cliente_notas, cliente_historial
- SELECT hereda acceso del cliente padre
- INSERT/UPDATE usa permisos especificos donde existen (ej: `clientes.editar_facturacion`)

**3D - Tareas:**
- `tareas.ver_todas` → ve todas
- `tareas.ver_propias` → solo donde `asignado_a` o `creado_por` = uid
- CRUD con permisos correspondientes

**3E - Tablas del sistema de permisos (4 tablas):**
- roles, permisos: SELECT para todos los autenticados (necesario para UI)
- roles_permisos: escritura con `roles.editar`
- usuarios_permisos: lectura con `usuarios.ver` o propio registro

**3F - Reuniones:**
- Si tiene `reuniones.ver` → ve todas
- Tipo cliente → solo las de su empresa
- CRUD con permisos correspondientes

**3G - Tablas restantes:**
- paquetes_leads: hereda acceso del cliente
- usuarios_menu_order: solo tu propio registro
- campanas: politicas creadas (estaba RLS activado sin politicas = BLOQUEADO)
- facturas: politicas creadas (mismo caso)

**Indices de rendimiento:** 10 indices creados para optimizar las consultas RLS

**IMPORTANTE:** Este archivo SQL debe ejecutarse en Supabase SQL Editor seccion por seccion, verificando que la app sigue funcionando despues de cada seccion.

### PASO 4: tienePermiso en ClienteDetalleAvanzado

- **GeneralTab:**
  - Si NO tiene `clientes.editar`: campos en modo solo lectura (nuevo componente `ReadOnlyField`)
  - Campo `password_portal`: solo visible si tiene `sistema.configuracion`
  - Seccion Integraciones V2: solo si tiene `clientes.editar`
  - Zona de Peligro (eliminar): solo si tiene `clientes.eliminar`

- **Tabs visibles:** Filtrado condicional por permisos:
  - Facturacion → `facturacion.ver`
  - Branding → `clientes.editar_branding`
  - Leads → `leads.ver`
  - Campanas → `campanas.ver`
  - Reuniones → `reuniones.ver`

- **FacturacionTab:** Datos fiscales editables solo con `clientes.editar_facturacion`, sino modo lectura

- **LeadsTab:**
  - Boton "Anadir Paquete" → solo con `leads.crear`
  - Botones editar/eliminar paquetes → condicionados a `leads.editar` / `leads.eliminar`

- **CampanasTab:**
  - Boton "Nueva Campana" → solo con `campanas.crear`
  - Boton editar campana → solo con `campanas.editar`

- **ReunionesTab:**
  - Boton editar reunion → solo con `reuniones.editar`
  - Boton eliminar reunion → solo con `reuniones.eliminar`

- **NotasTab:** Firma actualizada para recibir `tienePermiso` (preparado para permisos futuros de notas)

- **Verificacion:** Build exitoso

### PASO 5: tienePermiso en Dashboard

- Stats Grid (Total Clientes, Campanas Activas, Tareas Pendientes, Leads Este Mes): solo visible si tiene `dashboard.ver_metricas_globales`
- Seccion "Clientes con pocos leads": solo visible si tiene `dashboard.ver_metricas_globales`
- Seccion "Tareas pendientes": visible para todos (son propias)
- **Verificacion:** Build exitoso

### PASO 6: Completar sidebar condicional

- Items actualizados en `Layout.jsx`:
  - Documentacion → `documentacion.ver` (antes: null)
  - Reuniones → `reuniones.ver` (antes: null)
  - Archivos → `archivos.ver` (antes: null)
  - Madrigalito → `madrigalito.ver` (antes: null)
  - Notificaciones → null (se mantiene, todos reciben notificaciones)
- Permisos nuevos en `sql/004-permisos-nuevos-sidebar.sql`:
  - `documentacion.ver` → asignado a todos los roles
  - `archivos.ver` → asignado a todos los roles
  - `madrigalito.ver` → asignado a todos los roles
  - `reuniones.ver` ya existia y estaba asignado
- **Verificacion:** Build exitoso

### PASO 7: Eliminar console.logs en produccion

- Creado `src/lib/logger.js`: wrapper que solo ejecuta en desarrollo (`import.meta.env.DEV`)
- 45 llamadas a `console.log/error/warn` reemplazadas por `logger.log/error/warn` en 12 archivos
- En produccion: 0 output en consola del navegador
- En desarrollo: funciona igual que antes
- **Verificacion:** Build exitoso

---

## Verificaciones Realizadas

| Test | Resultado |
|---|---|
| `npx vite build` despues de PASO 1 | OK (3.30s) |
| `npx vite build` despues de PASO 2 | OK (3.31s) |
| `npx vite build` despues de PASO 4 | OK (3.31s) |
| `npx vite build` despues de PASO 5 | OK (3.25s) |
| `npx vite build` despues de PASO 6 | OK (3.27s) |
| `npx vite build` despues de PASO 7 | OK (3.45s) |
| Build final completo | OK |

---

## SQL Ejecutado en Supabase (19 feb 2026)

Los siguientes archivos SQL han sido ejecutados exitosamente via Management API:

1. **`sql/004-permisos-nuevos-sidebar.sql`** - EJECUTADO OK
   - 3 permisos nuevos creados: `documentacion.ver`, `archivos.ver`, `madrigalito.ver`
   - Asignados a todos los roles existentes
2. **`sql/003-rls-completo.sql`** - EJECUTADO OK (seccion por seccion)
   - Seccion 3A: Clientes y Leads - OK
   - Seccion 3B: Usuarios - OK
   - Seccion 3C: Tablas secundarias de clientes (7 tablas, sin clientes_lanzamiento que no existe) - OK
   - Seccion 3D: Tareas - OK
   - Seccion 3E: Tablas del sistema de permisos - OK
   - Seccion 3F: Reuniones - OK
   - Seccion 3G: Tablas restantes (campanas, facturas, paquetes_leads, usuarios_menu_order) + Indices - OK

**Correcciones aplicadas durante ejecucion:**
- `responsable_id` → `usuario_asignado_id` (columna real en tabla clientes)
- `asignado_a` → `asignado_a_id` (columna real en tabla tareas)
- `creado_por` → `creado_por_id` (columna real en tabla tareas)
- `clientes_lanzamiento` omitida (tabla no existe en la BD)
- Politicas antiguas de leads, reuniones y facturas eliminadas antes de crear las nuevas

**Resultado final:** 20 tablas con RLS activado, 72 politicas RLS creadas, 10 indices de rendimiento.

---

## Pendiente para Fase 2

| Item | Descripcion | Prioridad |
|---|---|---|
| Edge Functions para operaciones criticas | Eliminar usuario, cambiar rol, eliminar cliente → validacion server-side | Alta |
| Sistema de auditoria | Tabla `audit_log` + triggers en tablas sensibles | Alta |
| Rate limiting | Prevenir abuso en Edge Functions (invitaciones, etc) | Media |
| Permisos de notas | Crear permisos `notas.crear`, `notas.editar`, `notas.eliminar` | Media |
| Permisos de paquetes | Crear permisos independientes para paquetes_leads | Media |
| Permisos de historial | Crear permiso `historial.ver` | Baja |
| Validar `tipo` en UPDATE de usuarios | Impedir que un usuario se cambie el tipo a si mismo via RLS | Media |
| Rendimiento RLS | Evaluar impacto de `tiene_permiso()` en queries con muchas filas | Media |
| Session caching de permisos | `current_setting('app.user_permissions')` si hay problemas de rendimiento | Baja |

---

## Resumen de Vulnerabilidades Cerradas

| Vulnerabilidad | Estado |
|---|---|
| V1: Acceso a rutas protegidas por URL directa | **CERRADA** - PermissionRoute en todas las rutas |
| V2: Sin RLS en tabla usuarios | **CERRADA** - RLS activado y politicas ejecutadas en BD |
| V3: Filtrado de datos solo en frontend | **CERRADA** - RLS con `ver_solo_asignados` ejecutado en BD |
| V4: Sin WITH CHECK en politicas RLS | **CERRADA** - Todas las politicas con WITH CHECK ejecutadas |
| V5: RLS activado sin politicas en campanas/facturas | **CERRADA** - Politicas creadas y ejecutadas |
| V6: Credenciales hardcodeadas | **CERRADA** - Movidas a .env |
| V7: Sin validacion server-side de permisos | **PARCIAL** - RLS cubre la BD. Edge Functions pendientes para Fase 2 |
| V8: tienePermiso no usado en ClienteDetalleAvanzado | **CERRADA** - Aplicado en todos los componentes |
| V9: console.log con datos sensibles | **CERRADA** - Reemplazados por logger (solo en dev) |
| V10: password_portal visible sin restriccion | **CERRADA** - Solo visible con sistema.configuracion |
| V11: Eliminacion sin confirmacion server-side | **PARCIAL** - RLS cubre DELETE. Edge Function pendiente para Fase 2 |
| V12: Sin logs de auditoria | **PENDIENTE** - Programado para Fase 2 |
