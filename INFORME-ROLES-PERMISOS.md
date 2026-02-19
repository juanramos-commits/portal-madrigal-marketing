# INFORME DE AUDITORIA: Sistema de Roles y Permisos
## app.madrigalmarketing.es - Portal Interno Madrigal Marketing

**Fecha:** 19 de febrero de 2026
**Tipo:** Investigacion y auditoria de seguridad
**Estado:** Solo lectura - Sin modificaciones al codigo

---

## 1. RESUMEN EJECUTIVO

El portal interno de Madrigal Marketing tiene una **base solida** de sistema de permisos: roles con niveles jerarquicos, permisos granulares por modulo, override por usuario, y una funcion RPC server-side para resolver permisos. Sin embargo, existen **vulnerabilidades criticas de seguridad**: las politicas RLS solo cubren 2-4 tablas de las ~15+ existentes, no hay proteccion de rutas por rol/permiso (solo por autenticacion), el filtrado de datos por responsable se hace unicamente en frontend, y la anon key de Supabase esta hardcodeada en el codigo fuente.

---

## 2. ARQUITECTURA ACTUAL

### 2.1 Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| Framework | React 19.2 + Vite 7.2 |
| Router | React Router DOM 7.12 |
| Estilos | Tailwind CSS 3.4 + CSS custom properties |
| Backend/BD | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Estado global | React Context (AuthContext) |
| Drag & Drop | @dnd-kit |
| Iconos | lucide-react + SVGs inline |
| Despliegue | No hay CI/CD complejo (solo auto-merge.yml) |

### 2.2 Estructura de Carpetas

```
portal-madrigal-marketing/
├── src/
│   ├── App.jsx                          # Rutas principales
│   ├── contexts/
│   │   └── AuthContext.jsx              # Auth + permisos + sesion
│   ├── components/
│   │   ├── Layout.jsx                   # Sidebar + navegacion condicional
│   │   ├── ProtectedRoute.jsx           # Guardia de rutas (solo auth)
│   │   └── BusquedaMasiva.jsx           # Componente de busqueda
│   ├── lib/
│   │   └── supabase.js                  # Cliente Supabase (URL + anon key)
│   └── pages/
│       ├── Login.jsx                    # Pagina de login
│       ├── ForgotPassword.jsx           # Recuperacion de contrasena
│       ├── ResetPassword.jsx            # Reset de contrasena
│       ├── ActivarCuenta.jsx            # Activacion de cuenta invitada
│       ├── Dashboard.jsx                # Dashboard principal
│       ├── TablaClientesAvanzada.jsx    # Lista de clientes (activa)
│       ├── ClienteDetalleAvanzado.jsx   # Detalle de cliente (~1700 lineas)
│       ├── ClienteDetalle.jsx           # Detalle antiguo (no en rutas)
│       ├── Clientes.jsx                 # Lista antigua (no en rutas)
│       ├── Usuarios.jsx                 # Gestion de usuarios
│       └── Roles.jsx                    # Gestion de roles y permisos
├── sql/
│   └── 002-sistema-usuarios-permisos.sql # Esquema de BD completo
├── supabase/
│   └── .temp/                           # Metadata de Supabase CLI
└── .github/workflows/
    └── auto-merge.yml
```

### 2.3 Diagrama de Flujo Auth -> Permisos -> Acceso

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Usuario    │────>│   Supabase Auth  │────>│  onAuthChange   │
│  (Login)     │     │  signInWithPwd   │     │  (AuthContext)  │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                                       v
                                              ┌────────────────┐
                                              │ cargarUsuario() │
                                              │ SELECT usuarios │
                                              │ WHERE email=X   │
                                              └────────┬───────┘
                                                       │
                                          ┌────────────┴────────────┐
                                          │                         │
                                          v                         v
                                  ┌──────────────┐       ┌──────────────────┐
                                  │ super_admin? │       │ RPC:             │
                                  │ -> ALL perms │       │ obtener_permisos │
                                  └──────────────┘       │ _usuario()       │
                                                         └────────┬─────────┘
                                                                  │
                                                                  v
                                                      ┌───────────────────┐
                                                      │ setPermisos([...])│
                                                      │ Array de codigos  │
                                                      └─────────┬─────────┘
                                                                 │
                                              ┌──────────────────┴──────────────┐
                                              │                                 │
                                              v                                 v
                                    ┌──────────────────┐             ┌────────────────┐
                                    │  ProtectedRoute  │             │  Layout.jsx    │
                                    │  Solo verifica:  │             │  Sidebar:      │
                                    │  - user != null  │             │  shouldShowItem│
                                    │  - usuario !=null│             │  tienePermiso()│
                                    │  NO verifica rol │             └────────────────┘
                                    └──────────────────┘
                                              │
                                              v
                                    ┌──────────────────┐
                                    │  Paginas/Comps   │
                                    │  tienePermiso()  │
                                    │  Solo oculta UI  │
                                    │  NO bloquea data │
                                    └──────────────────┘
```

---

## 3. INVENTARIO DE ARCHIVOS RELEVANTES

### 3.1 Autenticacion y Permisos

| Archivo | Funcion | Lineas clave |
|---|---|---|
| `src/lib/supabase.js` | Cliente Supabase. URL y anon key **hardcodeadas** | L1-7 |
| `src/contexts/AuthContext.jsx` | Provider de auth. Carga usuario, permisos, expone `tienePermiso()` | L1-141 |
| `src/components/ProtectedRoute.jsx` | Guardia de rutas. Solo verifica autenticacion, **NO** verifica permisos | L1-81 |

### 3.2 Navegacion y Layout

| Archivo | Funcion | Lineas clave |
|---|---|---|
| `src/App.jsx` | Definicion de rutas. Sin proteccion por rol | L1-69 |
| `src/components/Layout.jsx` | Sidebar con filtrado condicional via `shouldShowItem()` | L214-468 |

### 3.3 Paginas con comprobacion de permisos

| Archivo | Permisos verificados | Tipo de verificacion |
|---|---|---|
| `src/pages/Roles.jsx` | `roles.crear`, `roles.editar`, `roles.eliminar` | Oculta botones UI |
| `src/pages/Usuarios.jsx` | `usuarios.crear`, `usuarios.editar`, `usuarios.activar_desactivar`, `usuarios.eliminar` | Oculta botones UI |
| `src/pages/TablaClientesAvanzada.jsx` | `clientes.crear` | Oculta boton "Nuevo Cliente" |
| `src/pages/ClienteDetalle.jsx` | Varios (archivo antiguo, no en rutas activas) | Oculta tabs y campos |
| `src/pages/ClienteDetalleAvanzado.jsx` | Importa `tienePermiso` pero **no lo usa** en el template | Solo lo importa |
| `src/pages/Dashboard.jsx` | Importa `tienePermiso` pero **no lo usa** | Solo lo importa |

### 3.4 Base de Datos

| Archivo | Funcion |
|---|---|
| `sql/002-sistema-usuarios-permisos.sql` | Esquema completo: tablas, roles, permisos, RLS, funciones RPC |

---

## 4. ANALISIS DETALLADO POR FASE

### 4.1 Base de Datos (FASE 1.2)

#### Tablas del sistema de permisos:

**`usuarios`** (tabla principal de usuarios)
```
- id UUID PK
- email VARCHAR
- nombre VARCHAR
- activo BOOLEAN
- tipo VARCHAR(20) CHECK ('super_admin','admin','equipo','cliente')
- rol_id UUID FK -> roles(id)
- cliente_id UUID FK -> clientes(id)  -- para usuarios tipo cliente
- ultimo_acceso TIMESTAMPTZ
- invitado_por UUID FK -> usuarios(id)
- fecha_invitacion TIMESTAMPTZ
- created_at TIMESTAMPTZ
```

**`roles`**
```
- id UUID PK
- nombre VARCHAR(100) UNIQUE
- descripcion TEXT
- nivel INTEGER (0-100)
- color VARCHAR(7)
- es_sistema BOOLEAN
- created_at, updated_at TIMESTAMPTZ
```

**`permisos`**
```
- id UUID PK
- codigo VARCHAR(100) UNIQUE  -- ej: 'clientes.ver_lista'
- modulo VARCHAR(50)           -- ej: 'clientes'
- nombre VARCHAR(100)
- descripcion TEXT
- orden INTEGER
- created_at TIMESTAMPTZ
```

**`roles_permisos`** (N:M entre roles y permisos)
```
- rol_id UUID FK -> roles(id) CASCADE
- permiso_id UUID FK -> permisos(id) CASCADE
- PK(rol_id, permiso_id)
```

**`usuarios_permisos`** (override individual por usuario)
```
- id UUID PK
- usuario_id UUID FK -> usuarios(id) CASCADE
- permiso_id UUID FK -> permisos(id) CASCADE
- permitido BOOLEAN  -- true=permitir, false=denegar
- asignado_por UUID FK -> usuarios(id)
- UNIQUE(usuario_id, permiso_id)
```

**`usuarios_menu_order`** (orden personalizado del sidebar)
```
- usuario_id UUID
- menu_order JSONB (array de IDs)
```

#### Funciones RPC:

1. **`obtener_permisos_usuario(p_usuario_id)`** - `SECURITY DEFINER`
   - Super admin: retorna TODOS los permisos
   - Otros: combina permisos del rol + overrides del usuario
   - Usa FULL OUTER JOIN para priorizar overrides sobre permisos de rol

2. **`tiene_permiso(p_usuario_id, p_codigo)`** - `SECURITY DEFINER`
   - Verifica un permiso especifico para un usuario
   - **NO se usa en ningun lugar del frontend** (oportunidad desaprovechada para RLS)

3. **`asignar_permisos_rol(p_rol_nombre, p_codigos[])`**
   - Funcion auxiliar para seed de permisos

#### Roles predefinidos (7):

| Rol | Nivel | es_sistema | Permisos asignados |
|---|---|---|---|
| Super Admin | 100 | Si | TODOS (via tipo='super_admin') |
| Directivo Comercial | 90 | Si | 29 permisos |
| Directivo Clientes | 90 | Si | 31 permisos |
| Contable | 70 | Si | 11 permisos |
| Media Buyer | 60 | Si | 18 permisos |
| Comercial | 60 | Si | 14 permisos |
| Creativo | 50 | Si | 9 permisos |

### 4.2 Autenticacion y Sesion (FASE 1.3)

- **Metodo:** Supabase Auth con email/password (`signInWithPassword`)
- **Flujo post-login:**
  1. `onAuthStateChange` detecta `SIGNED_IN`
  2. `cargarUsuario(email)` consulta tabla `usuarios` con JOIN a `roles`
  3. Si `activo === false`, se desconecta al usuario
  4. Si `tipo === 'super_admin'`, carga TODOS los permisos
  5. Si no, llama a RPC `obtener_permisos_usuario()`
  6. Permisos se almacenan en **React Context** (`useState`)
- **Almacenamiento:** Solo React Context (no localStorage para permisos)
- **Token:** Gestionado por Supabase Auth internamente (sessionStorage)
- **Invitacion:** Via Edge Function `super-worker` que recibe token del usuario actual

### 4.3 Proteccion de Rutas (FASE 1.4)

#### Rutas definidas en App.jsx:

| Ruta | Componente | Proteccion |
|---|---|---|
| `/login` | Login | Publica |
| `/forgot-password` | ForgotPassword | Publica |
| `/reset-password` | ResetPassword | Publica |
| `/activar-cuenta` | ActivarCuenta | Publica |
| `/` | Redirect a `/dashboard` | ProtectedRoute (solo auth) |
| `/dashboard` | Dashboard | ProtectedRoute (solo auth) |
| `/clientes` | TablaClientesAvanzada | ProtectedRoute (solo auth) |
| `/clientes/:id` | ClienteDetalleAvanzado | ProtectedRoute (solo auth) |
| `/tareas` | PlaceholderPage | ProtectedRoute (solo auth) |
| `/sugerencias` | PlaceholderPage | ProtectedRoute (solo auth) |
| `/usuarios` | Usuarios | ProtectedRoute (solo auth) |
| `/roles` | Roles | ProtectedRoute (solo auth) |
| `*` | Redirect a `/dashboard` | Ninguna |

**HALLAZGO CRITICO:** `ProtectedRoute` solo verifica:
1. Que exista `user` (sesion de Supabase Auth)
2. Que exista `usuario` (registro en tabla `usuarios`)

**NO verifica** permisos ni roles. Cualquier usuario autenticado puede acceder a `/usuarios` y `/roles` directamente por URL.

### 4.4 Sidebar y Navegacion (FASE 1.5)

El sidebar en `Layout.jsx` **SI filtra condicionalmente**:

```javascript
const shouldShowItem = (item) => {
  if (item.permiso && !tienePermiso(item.permiso)) return false
  if (item.onlyFor && !item.onlyFor.includes(usuario?.tipo)) return false
  return true
}
```

Items del sidebar con sus restricciones:

| Item | Permiso requerido | onlyFor |
|---|---|---|
| Dashboard | `dashboard.ver` | - |
| Notificaciones | ninguno | - |
| Tareas | `tareas.ver_propias` | - |
| Clientes | `clientes.ver_lista` | equipo, admin, super_admin |
| CRM | ninguno | cliente |
| Paquetes de Clientes | `clientes.ver_lista` | - |
| Documentacion | ninguno | - |
| Reuniones | ninguno | - |
| Archivos | ninguno | - |
| Madrigalito | ninguno | - |
| Usuarios | `usuarios.ver` | - |
| Roles | `roles.ver` | - |
| Sugerencias | `sugerencias.ver_propias` | - |

**HALLAZGO:** 7 de 13 items del sidebar NO tienen restriccion de permiso (Notificaciones, CRM, Documentacion, Reuniones, Archivos, Madrigalito). Cualquier usuario autenticado los ve.

### 4.5 Permisos a Nivel de Componente (FASE 1.6)

| Componente | Que protege | Que NO protege |
|---|---|---|
| Roles.jsx | Boton "Crear Rol", botones editar/eliminar | Acceso a la pagina, lectura de todos los roles |
| Usuarios.jsx | Boton "Invitar", selector de rol, botones permisos/toggle/eliminar | Acceso a la pagina, lectura de TODOS los usuarios |
| TablaClientesAvanzada.jsx | Boton "Nuevo Cliente" | Lectura de todos los clientes, acceso a detalle |
| ClienteDetalleAvanzado.jsx | **NADA** - importa `tienePermiso` pero no lo usa | Todo: editar, eliminar, ver datos sensibles |
| Dashboard.jsx | **NADA** - importa `tienePermiso` pero no lo usa | Todo: ve todas las stats |

---

## 5. AUDITORIA DE SEGURIDAD (FASE 2)

### 5.1 Row Level Security (RLS)

#### Tablas con RLS activado (segun el SQL):

| Tabla | RLS | Politica |
|---|---|---|
| `clientes` | Activado | super_admin/admin/equipo ven todo; cliente solo su registro |
| `leads` | Activado | super_admin/admin/equipo ven todo; cliente solo sus leads |
| `campanas` | Activado (en SQL) | No se define politica en el archivo |
| `facturas` | Activado (en SQL) | No se define politica en el archivo |

#### Tablas SIN RLS (estimacion basada en el codigo):

| Tabla | Datos sensibles | Riesgo |
|---|---|---|
| `usuarios` | Email, nombre, tipo, rol, ultimo acceso | ALTO |
| `roles` | Estructura de roles | MEDIO |
| `permisos` | Catalogo de permisos | BAJO |
| `roles_permisos` | Mapeo rol-permiso | MEDIO |
| `usuarios_permisos` | Override de permisos | ALTO |
| `tareas` | Tareas del equipo | MEDIO |
| `reuniones` | Reuniones con clientes | MEDIO |
| `cliente_historial` | Historial de cambios | MEDIO |
| `cliente_notas` | Notas internas | ALTO |
| `clientes_facturacion` | Datos fiscales (CIF, direccion) | ALTO |
| `clientes_branding` | Info de marca | BAJO |
| `clientes_urls` | URLs y redes sociales | BAJO |
| `clientes_info_adicional` | IDs Discord, Chatwoot, Drive | MEDIO |
| `clientes_lanzamiento` | Datos de lanzamiento | BAJO |
| `clientes_socios` | Socios del cliente | MEDIO |
| `paquetes_leads` | Paquetes de leads | MEDIO |
| `usuarios_menu_order` | Orden de menu | BAJO |

### 5.2 Politicas RLS Existentes - Analisis

**Politica `clientes_policy`:**
```sql
USING (
  -- Equipo interno ve todo
  EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid()::uuid
          AND tipo IN ('super_admin', 'admin', 'equipo'))
  OR
  -- Cliente solo su registro
  EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid()::uuid
          AND tipo = 'cliente' AND cliente_id = clientes.id)
)
```

**Problemas detectados:**
- Solo usa `USING` (aplica a SELECT y WHERE de UPDATE/DELETE)
- **NO tiene `WITH CHECK`** para INSERT/UPDATE, lo que significa que las restricciones no se aplican al escribir datos
- Todos los usuarios tipo `equipo` ven TODOS los clientes, sin filtro por responsable asignado
- El permiso `clientes.ver_solo_asignados` existe en el catalogo pero **NO se implementa en RLS**

**Politica `leads_policy`:** Misma estructura, mismos problemas.

**`campanas` y `facturas`:** Se activa RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) pero **NO se crean politicas**, lo que significa que **NADIE puede acceder a estas tablas** (RLS activado sin politicas = acceso denegado por defecto).

### 5.3 Aislamiento de Datos

| Pregunta | Respuesta | Riesgo |
|---|---|---|
| Un Comercial puede ver clientes de otro Comercial? | **SI** - RLS permite a todo `tipo=equipo` ver todo | ALTO |
| Los datos se filtran en backend? | **NO** - Solo en frontend (ocultar sidebar) | CRITICO |
| Se puede manipular desde DevTools? | **SI** - Las queries Supabase se ejecutan desde el browser | CRITICO |
| Un usuario puede leer la tabla `usuarios`? | **SI** - No hay RLS en `usuarios` | ALTO |

### 5.4 API y Endpoints

- **Supabase client directo desde frontend:** SI, en `src/lib/supabase.js`
- **Edge Functions:** Solo `super-worker` (invitacion de usuarios)
  - Usa `access_token` del usuario + `apikey` (anon key)
  - No se puede auditar la funcion (no esta en el repo, esta en Supabase Dashboard)
- **Validacion server-side de permisos en operaciones CRUD:** **NO EXISTE**
  - Todas las operaciones (crear, editar, eliminar clientes/tareas/reuniones/etc) se hacen directamente con el Supabase client del frontend
  - No hay middleware, Edge Functions, ni RLS que valide permisos

### 5.5 Vulnerabilidades Detectadas

| # | Vulnerabilidad | Severidad | Descripcion |
|---|---|---|---|
| V1 | Acceso a rutas protegidas por URL directa | CRITICO | Cualquier usuario autenticado puede navegar a `/usuarios`, `/roles`, `/clientes` independientemente de sus permisos |
| V2 | Sin RLS en tabla `usuarios` | CRITICO | Cualquier usuario puede leer/modificar registros de otros usuarios directamente via Supabase client |
| V3 | Filtrado de datos solo en frontend | CRITICO | Las queries a Supabase no filtran por responsable/asignado. Desde DevTools se pueden ejecutar queries sin restricciones |
| V4 | Sin `WITH CHECK` en politicas RLS | ALTO | Las politicas existentes no restringen INSERT/UPDATE, solo lectura |
| V5 | RLS activado sin politicas en `campanas` y `facturas` | ALTO | Si RLS esta activado pero no hay politicas, puede bloquear todo acceso o tener comportamiento inesperado |
| V6 | Credenciales hardcodeadas | ALTO | URL y anon key de Supabase en `supabase.js` (en el bundle del frontend). Nota: la anon key es publica por diseno en Supabase, pero la URL facilita ataques directos |
| V7 | Sin validacion server-side de permisos | CRITICO | Operaciones como `eliminarCliente`, `eliminarRol`, `cambiarRol` se ejecutan directamente desde el frontend sin verificacion en BD |
| V8 | `tienePermiso` no usado en ClienteDetalleAvanzado | ALTO | La pagina principal de detalle del cliente importa `tienePermiso` pero no lo usa - cualquier usuario puede editar/eliminar |
| V9 | `console.log` con datos sensibles | BAJO | 40+ `console.log/error` en produccion, incluyendo eventos de auth y errores con datos |
| V10 | Password de portal visible en tabla de clientes | MEDIO | Campo `password_portal` accesible sin restriccion de permiso en TablaClientesAvanzada |
| V11 | Eliminacion de clientes sin confirmacion server-side | ALTO | `eliminarCliente` en ClienteDetalleAvanzado solo tiene `confirm()` en JS, no validacion en BD |
| V12 | Sin logs de auditoria | MEDIO | No existe tabla de auditoria para acciones administrativas (cambio de roles, eliminacion de usuarios, etc). Solo existe `cliente_historial` para cambios en datos de clientes |

---

## 6. ANALISIS DE GAPS (FASE 3)

### 6.1 Estado Actual vs Estado Deseado

| Aspecto | Estado Actual | Estado Deseado | Gap |
|---|---|---|---|
| Roles predefinidos | 7 roles con niveles (OK) | 7 roles con niveles | Completo |
| Catalogo de permisos en BD | 58 permisos en 11 modulos (OK) | Permisos granulares | Completo |
| Asignacion de permisos a roles | Implementado via `roles_permisos` (OK) | Cada rol con permisos especificos | Completo |
| Override por usuario | Implementado via `usuarios_permisos` (OK) | Dar/quitar permisos individuales | Completo |
| Funcion de resolucion de permisos | `obtener_permisos_usuario` RPC (OK) | Logica server-side | Completo |
| UI de gestion de roles | Pagina `/roles` con CRUD + permisos (OK) | Panel de administracion | Completo |
| UI de permisos por usuario | Modal en `/usuarios` (OK) | Panel de permisos individuales | Completo |
| RLS en todas las tablas | Solo 2-4 tablas de ~15+ | TODAS las tablas con RLS | CRITICO |
| Politicas RLS con WITH CHECK | Ninguna politica tiene WITH CHECK | INSERT/UPDATE protegidos | CRITICO |
| Proteccion de rutas por permiso | Solo autenticacion | Middleware que bloquea por permiso | CRITICO |
| Sidebar condicional | Parcial (6/13 items sin permiso) | Todos los items con permiso | IMPORTANTE |
| Botones/acciones condicionales | Parcial (3/6 paginas) | Todas las paginas | IMPORTANTE |
| Validacion server-side | Inexistente | Toda operacion critica validada | CRITICO |
| Logs de auditoria admin | Solo `cliente_historial` | Registro de TODAS las acciones admin | IMPORTANTE |
| Separacion de datos por equipo | Inexistente | Filtrado por responsable en RLS | CRITICO |
| Variables de entorno | Hardcodeadas | Archivo `.env` con Vite | MEJORA |

### 6.2 Catalogo de Permisos - Estado

#### Permisos que YA existen en BD (58 permisos):

**Dashboard (3):** `dashboard.ver`, `dashboard.ver_metricas_globales`, `dashboard.ver_metricas_equipo`

**Clientes (10):** `clientes.ver_lista`, `clientes.ver_detalle`, `clientes.crear`, `clientes.editar`, `clientes.editar_facturacion`, `clientes.editar_branding`, `clientes.asignar_responsable`, `clientes.ver_solo_asignados`, `clientes.exportar`, `clientes.eliminar`

**Leads (8):** `leads.ver`, `leads.crear`, `leads.editar`, `leads.eliminar`, `leads.cambiar_estado`, `leads.ver_solo_asignados`, `leads.exportar`, `leads.importar`

**Campanas (6):** `campanas.ver`, `campanas.crear`, `campanas.editar`, `campanas.eliminar`, `campanas.ver_metricas`, `campanas.ver_solo_asignadas`

**Tareas (7):** `tareas.ver_todas`, `tareas.ver_propias`, `tareas.crear`, `tareas.editar`, `tareas.eliminar`, `tareas.asignar`, `tareas.completar`

**Sugerencias (6):** `sugerencias.ver_todas`, `sugerencias.ver_propias`, `sugerencias.crear`, `sugerencias.editar`, `sugerencias.eliminar`, `sugerencias.responder`

**Reuniones (5):** `reuniones.ver`, `reuniones.crear`, `reuniones.editar`, `reuniones.eliminar`, `reuniones.ver_transcripciones`

**Facturacion (7):** `facturacion.ver`, `facturacion.crear`, `facturacion.editar`, `facturacion.eliminar`, `facturacion.marcar_pagada`, `facturacion.ver_informes`, `facturacion.exportar`

**Usuarios (7):** `usuarios.ver`, `usuarios.crear`, `usuarios.editar`, `usuarios.eliminar`, `usuarios.cambiar_password`, `usuarios.activar_desactivar`, `usuarios.ver_actividad`

**Roles (4):** `roles.ver`, `roles.crear`, `roles.editar`, `roles.eliminar`

**Sistema (4):** `sistema.configuracion`, `sistema.webhooks`, `sistema.logs`, `sistema.backup`

#### Permisos que FALTAN (sugeridos segun los modulos del sidebar):

```
# Notificaciones (modulo sin permisos)
notificaciones.ver
notificaciones.configurar
notificaciones.ver_todas          # admin ve notificaciones de todos

# Archivos (modulo sin permisos)
archivos.ver
archivos.subir
archivos.eliminar
archivos.ver_todos                # vs solo los propios/de sus clientes

# Madrigalito (modulo sin permisos)
madrigalito.ver
madrigalito.configurar
madrigalito.usar

# Documentacion (modulo sin permisos)
documentacion.ver
documentacion.ver_facturas
documentacion.ver_contratos
documentacion.crear
documentacion.editar
documentacion.eliminar

# Paquetes de clientes (usa clientes.ver_lista pero deberia ser independiente)
paquetes.ver
paquetes.crear
paquetes.editar
paquetes.eliminar

# Notas de cliente (sin permisos propios)
notas.ver
notas.crear
notas.editar
notas.eliminar

# Historial (sin permisos propios)
historial.ver
```

---

## 7. ESTADO DE SEGURIDAD - CHECKLIST

| Check | Estado | Detalle |
|---|---|---|
| Autenticacion funcional | OK | Supabase Auth con email/password |
| Bloqueo de usuarios desactivados | OK | Se verifica `activo` en login |
| Roles con niveles jerarquicos | OK | 7 roles, niveles 50-100 |
| Catalogo de permisos granulares | OK | 58 permisos en 11 modulos |
| Override de permisos por usuario | OK | Tabla `usuarios_permisos` con permitido/denegado |
| Funcion server-side de permisos | OK | RPC `obtener_permisos_usuario` SECURITY DEFINER |
| Sidebar condicional por permisos | PARCIAL | 7/13 items sin restriccion |
| Botones condicionales por permisos | PARCIAL | Solo en Roles, Usuarios, TablaClientes |
| RLS en tabla `clientes` | OK (incompleto) | Falta WITH CHECK, falta filtro por responsable |
| RLS en tabla `leads` | OK (incompleto) | Falta WITH CHECK |
| RLS en tabla `usuarios` | FALTA | Cualquier usuario lee todos los usuarios |
| RLS en tabla `roles` | FALTA | - |
| RLS en tabla `permisos` | FALTA | - |
| RLS en tablas de clientes (facturacion, branding, etc) | FALTA | - |
| RLS en tabla `tareas` | FALTA | - |
| RLS en tabla `reuniones` | FALTA | - |
| Proteccion de rutas por permiso | FALTA | Solo autenticacion, no permisos |
| Validacion server-side de CRUD | FALTA | Todo el CRUD va directo desde frontend |
| Separacion de datos por responsable | FALTA | `ver_solo_asignados` no se implementa |
| Service_role key en frontend | OK | No se encontro |
| Variables de entorno | FALTA | Hardcodeadas en `supabase.js` |
| Logs de auditoria admin | FALTA | Solo existe `cliente_historial` |
| Proteccion CSRF | OK | Supabase maneja tokens automaticamente |
| Password hashing | OK | Supabase Auth lo gestiona |
| Minimo 6 caracteres en password | OK | Validacion en ActivarCuenta y ResetPassword |

---

## 8. GAPS ORDENADOS POR CRITICIDAD

### CRITICO (riesgo de acceso no autorizado a datos)

| # | Gap | Impacto | Esfuerzo |
|---|---|---|---|
| G1 | Sin proteccion de rutas por permiso | Cualquier usuario accede a /usuarios, /roles | Medio |
| G2 | Sin RLS en tabla `usuarios` | Cualquier usuario puede leer/modificar otros usuarios | Medio |
| G3 | Sin validacion server-side de operaciones CRUD | Un usuario puede ejecutar `DELETE FROM clientes` desde DevTools | Alto |
| G4 | Filtrado de datos por responsable solo en frontend | Un Comercial ve datos de clientes de otro Comercial | Alto |
| G5 | Sin RLS en tablas sensibles (facturacion, notas, historial) | Datos financieros y privados sin proteccion | Alto |
| G6 | RLS activado sin politicas en `campanas` y `facturas` | Posible bloqueo total o acceso sin restricciones | Medio |

### IMPORTANTE (funcionalidad de permisos incompleta)

| # | Gap | Impacto | Esfuerzo |
|---|---|---|---|
| G7 | `tienePermiso` no usado en ClienteDetalleAvanzado | Cualquier usuario puede editar/eliminar clientes | Bajo |
| G8 | `tienePermiso` no usado en Dashboard | Todos ven las mismas metricas | Bajo |
| G9 | 7/13 items del sidebar sin restriccion de permisos | Usuarios ven modulos a los que no deberian acceder | Bajo |
| G10 | Sin `WITH CHECK` en politicas RLS existentes | INSERT/UPDATE sin restriccion | Medio |
| G11 | Sin permisos para modulos Notificaciones, Archivos, Madrigalito, Documentacion | Modulos sin control de acceso | Bajo |
| G12 | Sin logs de auditoria para acciones administrativas | No hay trazabilidad de quien hizo que | Medio |

### MEJORA (buenas practicas)

| # | Gap | Impacto | Esfuerzo |
|---|---|---|---|
| G13 | Credenciales hardcodeadas (mover a .env) | Buena practica, no es vulnerable per se | Bajo |
| G14 | 40+ console.log en produccion | Info de debug expuesta | Bajo |
| G15 | Campo `password_portal` visible sin restriccion | Dato sensible visible | Bajo |

---

## 9. RECOMENDACION DE ARQUITECTURA TARGET

### 9.1 Principio: Defensa en Profundidad

```
┌─────────────────────────────────────────────────────────┐
│                    CAPA 1: FRONTEND                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ ProtectedRoute│  │  Sidebar     │  │ Componentes   │  │
│  │ + verificar  │  │  condicional │  │ condicionales │  │
│  │   permiso    │  │  (YA existe) │  │ tienePermiso()│  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                         UX Only                          │
│        (ocultar UI, no es barrera de seguridad)          │
└─────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────┐
│                 CAPA 2: ROW LEVEL SECURITY               │
│                    (Barrera real)                         │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ TODAS las tablas con RLS activado                   │ │
│  │ Politicas con USING + WITH CHECK                    │ │
│  │ Funcion tiene_permiso() reutilizada en politicas    │ │
│  │ Filtro por responsable/asignado donde aplique       │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────┐
│            CAPA 3: FUNCIONES SERVER-SIDE                 │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Edge Functions para operaciones criticas            │ │
│  │ (eliminar usuario, cambiar roles, exportar datos)   │ │
│  │ Con validacion de permisos server-side              │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────┐
│               CAPA 4: AUDITORIA                          │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Tabla audit_log con trigger en tablas sensibles     │ │
│  │ Registro automatico de quien, que, cuando           │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Modelo de RLS Propuesto

```sql
-- Ejemplo de politica RLS robusta para clientes
CREATE POLICY clientes_select ON clientes FOR SELECT USING (
  -- Super admin ve todo
  tiene_permiso(auth.uid()::uuid, 'clientes.ver_lista')
  AND (
    -- Si NO tiene restriccion de solo asignados, ve todo
    NOT tiene_permiso(auth.uid()::uuid, 'clientes.ver_solo_asignados')
    OR
    -- Si tiene restriccion, solo ve los que tiene asignados
    clientes.responsable_id = auth.uid()::uuid
  )
);

CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.crear')
);

CREATE POLICY clientes_update ON clientes FOR UPDATE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.editar')
) WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.editar')
);

CREATE POLICY clientes_delete ON clientes FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.eliminar')
);
```

---

## 10. PLAN DE ACCION

### Fase 1: Cerrar vulnerabilidades criticas (Prioridad MAXIMA)

1. **Proteccion de rutas por permiso en frontend**
   - Crear componente `<PermissionRoute permiso="usuarios.ver">` que envuelva rutas sensibles
   - Aplicar en App.jsx a rutas `/usuarios`, `/roles`, `/clientes`, `/tareas`
   - Mostrar pagina "Sin acceso" si no tiene permiso

2. **RLS completo en todas las tablas**
   - Activar RLS en TODAS las tablas publicas
   - Crear politicas SELECT/INSERT/UPDATE/DELETE separadas
   - Usar `tiene_permiso()` en las politicas
   - Incluir `WITH CHECK` en INSERT y UPDATE
   - Anadir campo `responsable_id` donde falte

3. **Implementar `tienePermiso` en ClienteDetalleAvanzado**
   - Proteger botones de editar, eliminar, crear facturas/campanas/reuniones/paquetes/notas
   - Proteger tabs sensibles (facturacion, leads, campanas)

4. **Mover credenciales a variables de entorno**
   - Crear `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   - Actualizar `supabase.js`

### Fase 2: Completar funcionalidad de permisos

5. **Completar sidebar condicional**
   - Asignar permisos a items sin restriccion (Notificaciones, Documentacion, Reuniones, Archivos, Madrigalito)
   - Crear los permisos faltantes en BD

6. **Aplicar `tienePermiso` en Dashboard**
   - Metricas globales solo para quien tiene `dashboard.ver_metricas_globales`
   - Metricas de equipo solo para quien tiene `dashboard.ver_metricas_equipo`

7. **Implementar filtrado por responsable en RLS**
   - Usar `clientes.ver_solo_asignados` para filtrar en BD
   - Comercial solo ve sus clientes, Directivo ve los de su equipo

### Fase 3: Seguridad avanzada

8. **Edge Functions para operaciones criticas**
   - Eliminar usuario -> Edge Function con verificacion de rol
   - Cambiar rol de usuario -> Edge Function
   - Eliminar cliente -> Edge Function

9. **Sistema de auditoria**
   - Crear tabla `audit_log` (usuario_id, accion, tabla, registro_id, datos_antes, datos_despues, timestamp)
   - Crear trigger PostgreSQL para tablas sensibles
   - Pagina de visualizacion de logs para Super Admin

10. **Limpiar console.logs en produccion**
    - Eliminar o condicionar todos los `console.log`/`console.error`
    - Usar variable de entorno `VITE_DEBUG` para logs condicionales

### Fase 4: Mejoras adicionales

11. **Anadir permisos faltantes al catalogo**
    - Notificaciones, Archivos, Madrigalito, Documentacion, Paquetes, Notas, Historial

12. **Proteccion adicional del campo password_portal**
    - Solo visible para quien tenga permiso especifico

13. **Rate limiting en Edge Functions**
    - Prevenir abuso de invitaciones

---

## 11. CONCLUSION

El sistema tiene una **arquitectura de permisos bien disenada a nivel de base de datos** (roles jerarquicos, permisos granulares, overrides por usuario, funciones RPC). Sin embargo, la **implementacion en frontend y las politicas de seguridad estan incompletas**. La brecha principal es que la proteccion se aplica mayormente a nivel de UI (ocultar botones) pero **no se refuerza a nivel de base de datos (RLS)** ni a nivel de rutas.

**Prioridad inmediata:** Implementar RLS en todas las tablas y proteccion de rutas por permisos. Estas dos acciones eliminarian las vulnerabilidades criticas con un esfuerzo moderado.
