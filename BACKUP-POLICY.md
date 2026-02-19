# Política de Backups - Portal Madrigal Marketing

## Backups automáticos (Supabase)

- Supabase Pro incluye backups automáticos diarios con retención de 7 días
- Point-in-time recovery (PITR) disponible en planes superiores
- Los backups incluyen toda la base de datos PostgreSQL

## Exportación manual desde la app

El Super Admin puede exportar datos desde el Dashboard de Seguridad (`/seguridad-dashboard`):

### Contenido de la exportación (ZIP)
- `clientes.csv` — Todos los clientes
- `usuarios.csv` — Todos los usuarios (sin contraseñas, solo datos básicos)
- `roles.csv` — Roles con sus permisos asignados
- `permisos.csv` — Catálogo completo de permisos
- `audit_log.csv` — Últimos 5000 registros del log de auditoría
- `metadata.json` — Fecha, usuario exportador, conteos

### Requisitos
- Permiso: `sistema.backup`
- Cada exportación queda registrada en el audit_log

## Retención de datos

| Datos | Retención |
|-------|-----------|
| audit_log | 1 año |
| login_attempts | 90 días |
| rate_limits | 7 días |
| security_alerts (resueltas) | 6 meses |
| Datos de negocio (clientes, campañas) | Indefinida |

## Limpieza automática

La función `limpiar_datos_temporales()` se encarga de eliminar datos expirados.
Se recomienda programar con `pg_cron`:
```sql
SELECT cron.schedule('limpiar-datos-temporales', '0 3 * * *', 'SELECT limpiar_datos_temporales()');
```

## Responsabilidades

- **Verificación mensual de backups**: Super Admin
- **Exportación manual**: Cuando sea necesario, desde la interfaz
- **Monitorización**: Revisar alertas de seguridad y audit log regularmente
