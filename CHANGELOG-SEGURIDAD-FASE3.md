# CHANGELOG - Fase 3: 2FA, Monitorización, Backups y Portal Cliente

## Fecha: 2026-02-19

---

## Archivos creados

### Páginas
- `src/pages/Seguridad.jsx` — Página de seguridad personal (2FA, sesiones, info cuenta)
- `src/pages/Configurar2FA.jsx` — Configuración obligatoria de 2FA para roles de alto nivel
- `src/pages/SecurityAlerts.jsx` — Gestión de alertas de seguridad con filtros y resolución
- `src/pages/SecurityDashboard.jsx` — Dashboard de seguridad con métricas, gráficos, checklist y exportación
- `src/pages/ClienteDashboard.jsx` — Dashboard personalizado para usuarios tipo cliente

### Componentes
- `src/components/PasswordStrengthMeter.jsx` — Indicador visual de fortaleza de contraseña

### Utilidades
- `src/lib/passwordValidation.js` — Validación robusta de contraseñas (8+ chars, mayúscula, minúscula, número, especial)

### SQL
- `sql/007-alertas-seguridad-fase3.sql` — security_alerts table, generar_alerta_seguridad(), fn_alert_cambio_rol() trigger
- `sql/008-login-attempts-fase3.sql` — login_attempts table, cuenta_bloqueada(), limpiar_datos_temporales()

### Documentación
- `docs/SECURITY.md` — Arquitectura de seguridad completa (10 secciones)
- `docs/DEVELOPER-SECURITY-CHECKLIST.md` — Checklist para onboarding de developers
- `BACKUP-POLICY.md` — Política de backups y retención de datos

## Archivos modificados

- `src/pages/Login.jsx` — 2FA verification flow, login attempts tracking, account lockout
- `src/contexts/AuthContext.jsx` — requiere2FA state, MFA check for high-level roles
- `src/App.jsx` — New routes (configurar-2fa, alertas-seguridad, seguridad-dashboard, mi-seguridad, mi-cuenta), SmartRedirect, Require2FAWrapper
- `src/components/Layout.jsx` — New sidebar items (Alertas de Seguridad, Seguridad, Mi Seguridad), new icons (ShieldAlert, Lock, BarChart)
- `src/pages/ActivarCuenta.jsx` — Password strength validation + meter
- `src/pages/ResetPassword.jsx` — Password strength validation + meter
- `package.json` — Added papaparse, jszip, file-saver

## SQL ejecutado en Supabase

### security_alerts table
- 4 columnas de clasificación (tipo, severidad, titulo, descripcion)
- 3 columnas de relación (usuario_afectado_id, usuario_origen_id, datos JSONB)
- 4 columnas de resolución (resuelta, resuelta_por, resuelta_at, notas_resolucion)
- 4 índices
- RLS con políticas SELECT y UPDATE (requiere sistema.logs)

### login_attempts table
- Tracking de email, exitoso, ip_address, user_agent
- Índice en email + created_at
- RLS: INSERT abierto (pre-auth), SELECT solo sistema.logs

### Funciones PostgreSQL creadas
- `generar_alerta_seguridad()` — SECURITY DEFINER, genera alertas con todos los datos
- `fn_alert_cambio_rol()` — Trigger automático que genera alertas en cambios de rol, desactivación y cambio de tipo
- `cuenta_bloqueada()` — Verifica si hay 10+ intentos fallidos en 30 min
- `limpiar_datos_temporales()` — Limpieza de login_attempts (90d), rate_limits (7d), alerts resueltas (6m)

### Trigger creado
- `alert_cambio_rol` ON usuarios AFTER UPDATE

### Permiso creado
- `sistema.backup` — Exportar datos del sistema

## Estado de 2FA

**Implementado completo:**
- Enrollment con QR code y código secreto manual
- Verificación TOTP en flujo de login
- Obligatorio para roles nivel >= 90 y super_admin (redirección a /configurar-2fa)
- Desactivación desde página /mi-seguridad
- Timeout de 5 minutos en pantalla MFA
- 3 intentos MFA -> bloqueo 15 minutos
- Eventos auditados: MFA_ENROLLED, MFA_UNENROLLED, MFA_VERIFIED, MFA_FAILED, MFA_FORCED

**Nota:** Depende de que Supabase Auth tenga TOTP habilitado en el proyecto. Si no está habilitado, activar en Dashboard > Authentication > Multi-Factor Authentication.

## Alertas configuradas

| Tipo | Severidad | Trigger |
|------|-----------|---------|
| cambio_rol_critico | alta/critica | Automático (trigger BD) |
| usuario_desactivado | media | Automático (trigger BD) |
| cambio_tipo_usuario | critica | Automático (trigger BD) |
| login_fallido_multiple | alta | Frontend (Login.jsx, 5+ intentos) |

## Sistema de bloqueo de cuenta

- **Server-side:** 10 intentos fallidos en 30 min -> `cuenta_bloqueada()` retorna true
- **Client-side:** 5 intentos fallidos -> bloqueo local 15 min + alerta de seguridad
- **MFA:** 3 intentos fallidos -> sign out + bloqueo 15 min

## Exportación de datos (Backup)

- Formato: ZIP con CSVs + metadata.json
- Contenido: clientes, usuarios, roles, permisos, audit_log (5000 últimos)
- Requiere: permiso `sistema.backup`
- Registrado en audit_log como acción EXPORT
- Librerías: papaparse, jszip, file-saver

## Portal de cliente

- Dashboard dedicado en `/mi-cuenta`
- Redirección automática para tipo='cliente' via SmartRedirect
- Métricas propias: campañas activas, leads del mes, facturas pendientes
- Info de cuenta (read-only)
- RLS existente ya filtra por cliente_id

## Estado del checklist de seguridad (post-Fase 3)

- [x] RLS en todas las tablas
- [x] PermissionRoute en todas las rutas
- [x] tienePermiso() en toda la UI
- [x] Sidebar filtrado por permisos
- [x] Credenciales en .env
- [x] Console.logs controlados via logger
- [x] Sistema de auditoría con triggers
- [x] Edge Functions para operaciones críticas
- [x] Anti-escalación de privilegios (RLS RESTRICTIVE)
- [x] Rate limiting
- [x] Headers de seguridad
- [x] Expiración de sesión (24h)
- [x] 2FA/MFA con TOTP
- [x] 2FA obligatorio para admins
- [x] Alertas de seguridad automáticas
- [x] Bloqueo de cuenta por intentos fallidos
- [x] Validación robusta de contraseñas
- [x] Dashboard de seguridad
- [x] Exportación de datos
- [x] Portal de cliente separado
- [x] Documentación de seguridad

## TODO pendientes menores

- [ ] Notificación por email de alertas críticas (requiere configurar servicio email: Resend, Postmark, etc.)
- [ ] Programar pg_cron para `limpiar_datos_temporales()` (requiere extensión pg_cron activa)
- [ ] Instalar Recharts para gráficos más avanzados en el dashboard de seguridad
- [ ] Verificar que TOTP está habilitado en Supabase Dashboard > Auth > MFA
- [ ] Considerar backup de archivos/storage además de datos de BD

## Comparativa: ANTES vs AHORA

| Aspecto | Pre-Fase 1 | Post-Fase 3 |
|---------|-----------|-------------|
| Credenciales | Hardcoded en código | .env con variables de entorno |
| RLS | Deshabilitado | 79+ políticas en todas las tablas |
| Permisos | Sin sistema | 93 permisos en 18 módulos |
| Rutas | Sin protección | PermissionRoute + ProtectedRoute |
| UI | Sin filtrado | tienePermiso() + sidebar filtrado |
| Auditoría | Inexistente | audit_log + triggers automáticos |
| Operaciones críticas | SQL directo | Edge Functions con validaciones |
| Escalación | Posible | RESTRICTIVE policy + Edge Functions |
| Rate limiting | Sin | DB-backed counter |
| Headers | Sin | CSP, X-Frame-Options, etc. |
| Contraseñas | Mín 6 chars | 8+ chars, mayúscula, minúscula, número, especial |
| 2FA | Inexistente | TOTP con QR, obligatorio para admins |
| Alertas | Inexistentes | Automáticas con triggers y frontend |
| Bloqueo cuenta | Sin | 10 intentos/30min server, 5 intentos client |
| Sesiones | Sin control | 24h expiración, cierre global |
| Monitorización | Sin | Dashboard con métricas y gráficos |
| Backup | Solo Supabase | + Exportación manual CSV/ZIP |
| Portal cliente | Mezclado | Dashboard dedicado, RLS aislado |
| Documentación | Sin | SECURITY.md + Developer Checklist |
