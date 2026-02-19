# Arquitectura de Seguridad - Portal Madrigal Marketing

## 1. Visión general

El portal opera con un modelo de seguridad en 4 capas:

```
┌─────────────────────────────────────────┐
│  CAPA 1: Frontend (React)               │
│  - tienePermiso() oculta UI             │
│  - PermissionRoute bloquea rutas        │
│  - Sidebar filtrado por permisos        │
├─────────────────────────────────────────┤
│  CAPA 2: Row Level Security (Postgres)  │
│  - 79+ políticas RLS en todas tablas    │
│  - RESTRICTIVE anti-escalación          │
│  - tiene_permiso() SECURITY DEFINER     │
├─────────────────────────────────────────┤
│  CAPA 3: Edge Functions (Deno)          │
│  - Operaciones destructivas controladas │
│  - Validaciones de jerarquía            │
│  - Bloqueo de escalación               │
├─────────────────────────────────────────┤
│  CAPA 4: Auditoría y Monitorización     │
│  - audit_log con triggers automáticos   │
│  - security_alerts automáticas          │
│  - login_attempts tracking              │
│  - Rate limiting                        │
└─────────────────────────────────────────┘
```

## 2. Modelo de permisos

### Jerarquía de roles
- **Super Admin** (tipo=super_admin): Acceso total, bypass de permisos
- **Directivo Comercial/Clientes** (nivel=90): Gestión completa + administración
- **Contable** (nivel=70): Facturación y datos financieros
- **Media Buyer** (nivel=50): Campañas y publicidad
- **Comercial** (nivel=50): Clientes y ventas
- **Creativo** (nivel=30): Contenido y diseño

### Sistema roles -> permisos -> overrides
1. Cada rol tiene permisos asignados en `roles_permisos`
2. Se pueden asignar permisos adicionales por usuario en `usuarios_permisos` (override positivo)
3. La función `obtener_permisos_usuario()` combina ambos
4. `tiene_permiso()` es SECURITY DEFINER para evitar recursión RLS

### Catálogo de permisos (~93 permisos en 18 módulos)
| Módulo | Ejemplo de permisos |
|--------|-------------------|
| dashboard | dashboard.ver |
| clientes | clientes.ver_lista, clientes.ver_detalle, clientes.crear, clientes.editar, clientes.eliminar |
| usuarios | usuarios.ver, usuarios.crear, usuarios.editar, usuarios.eliminar, usuarios.cambiar_rol |
| roles | roles.ver, roles.crear, roles.editar, roles.eliminar |
| tareas | tareas.ver_propias, tareas.ver_todas, tareas.crear, tareas.editar |
| reuniones | reuniones.ver, reuniones.crear, reuniones.editar |
| sugerencias | sugerencias.ver_propias, sugerencias.ver_todas, sugerencias.crear |
| sistema | sistema.configuracion, sistema.logs, sistema.backup |
| ... | (ver tabla permisos en BD para listado completo) |

## 3. Políticas RLS

Todas las tablas públicas tienen RLS habilitado. Tipos de políticas:

- **SELECT**: Filtrado basado en `tiene_permiso()` y relaciones del usuario
- **INSERT**: Validación de permisos de creación
- **UPDATE**: Solo propietario o con permiso de edición
- **DELETE**: Solo vía Edge Functions (no directo)
- **RESTRICTIVE (anti-escalación)**: Impide que usuarios modifiquen su propio tipo, rol_id o activo

## 4. Edge Functions

| Función | Protecciones |
|---------|-------------|
| `eliminar-usuario` | Self-delete block, Super Admin protection, hierarchy check, soft delete |
| `cambiar-rol-usuario` | Super Admin protection, level validation |
| `eliminar-cliente` | Assignment check, dependency warnings, cascade delete |
| `cambiar-permisos-rol` | Super Admin protection, hierarchy check |

## 5. MFA / 2FA

- Implementado con Supabase Auth TOTP nativo
- Obligatorio para roles con nivel >= 90 y Super Admin
- Flujo: enroll -> QR code -> verify -> activado
- Usuarios de alto nivel son redirigidos a `/configurar-2fa` hasta que activen 2FA
- Eventos auditados: MFA_ENROLLED, MFA_UNENROLLED, MFA_VERIFIED, MFA_FAILED, MFA_FORCED

## 6. Sistema de alertas

Alertas automáticas generadas por triggers:
- `cambio_rol_critico`: Cambios de rol en usuarios de nivel >= 70
- `usuario_desactivado`: Desactivación de usuarios
- `cambio_tipo_usuario`: Cambios en el tipo de usuario
- `login_fallido_multiple`: 5+ intentos fallidos desde frontend

Severidades: `critica`, `alta`, `media`, `baja`

## 7. Gestión de sesiones

- Expiración automática tras 24h de inactividad
- Bloqueo de cuenta tras 10 intentos fallidos en 30 minutos
- Bloqueo local (frontend) tras 5 intentos fallidos por 15 minutos
- Timeout de 5 minutos en pantalla de verificación MFA
- Cierre global de sesiones disponible en `/mi-seguridad`

## 8. Política de backups

Ver [BACKUP-POLICY.md](../BACKUP-POLICY.md)

## 9. Procedimiento ante incidentes

1. **Detección**: Revisar alertas en `/alertas-seguridad`
2. **Contención**: Desactivar usuario comprometido (sin eliminar, para preservar auditoría)
3. **Investigación**: Revisar audit_log filtrado por usuario y fechas
4. **Remediación**: Cambiar contraseñas, revocar sesiones, ajustar permisos
5. **Documentación**: Resolver alerta con notas detalladas

## 10. Contactos de seguridad

- Responsable principal: Super Admin (configurado en Supabase)
- Revisión de alertas: Diaria
- Revisión de backups: Mensual
