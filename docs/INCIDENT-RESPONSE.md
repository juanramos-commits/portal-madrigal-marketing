# Plan de Respuesta a Incidentes de Seguridad

**Portal Madrigal Marketing - app.madrigalmarketing.es**
**Versión:** 1.0
**Fecha:** 2026-02-19
**Clasificación:** Interno - Confidencial

---

## 1. Objetivo

Establecer un protocolo claro y accionable para la detección, contención, erradicación y recuperación ante incidentes de seguridad en el Portal Madrigal Marketing.

---

## 2. Equipo de Respuesta

| Rol | Responsabilidad | Contacto |
|-----|-----------------|----------|
| **Responsable de Seguridad** | Decisiones finales, comunicación con dirección | (configurar) |
| **Administrador de Sistema** | Acciones técnicas, contención | (configurar) |
| **DPO (Delegado de Protección de Datos)** | Notificación AEPD si aplica | (configurar) |

---

## 3. Clasificación de Incidentes

### Severidad CRÍTICA (respuesta < 1h)
- Acceso no autorizado a datos de clientes
- Compromiso de cuenta super_admin
- Exfiltración de datos confirmada
- RLS desactivado en producción
- Inyección SQL exitosa

### Severidad ALTA (respuesta < 4h)
- Múltiples intentos de escalación de privilegios
- Brute force masivo en autenticación
- Modificación no autorizada de roles/permisos
- Alertas críticas no resueltas en security_alerts

### Severidad MEDIA (respuesta < 24h)
- Cuenta de admin inactiva con acceso
- Intentos de acceso a rutas no autorizadas
- Anomalías en patrones de acceso
- Configuración de seguridad alterada

### Severidad BAJA (respuesta < 72h)
- Intentos de login fallidos aislados
- Errores de configuración menores
- Actualizaciones de seguridad pendientes

---

## 4. Procedimiento de Respuesta

### FASE 1: Detección e Identificación (0-30 min)

1. **Monitorizar fuentes de alertas:**
   - Dashboard de seguridad (`/seguridad-dashboard`)
   - Tabla `security_alerts` (alertas automáticas)
   - Tabla `audit_log` (acciones sospechosas)
   - Logs de Supabase (Auth, Database, Edge Functions)

2. **Confirmar el incidente:**
   - Verificar que no sea un falso positivo
   - Determinar alcance inicial
   - Clasificar severidad

3. **Registrar:**
   ```sql
   INSERT INTO security_alerts (tipo, severidad, titulo, descripcion)
   VALUES ('incidente', 'critica', 'Título del incidente', 'Descripción detallada');
   ```

### FASE 2: Contención (30 min - 2h)

**Contención inmediata:**

1. **Bloquear usuario comprometido:**
   ```sql
   UPDATE usuarios SET activo = false WHERE id = '<usuario_id>';
   ```

2. **Revocar todas las sesiones del usuario:**
   - Desde Supabase Dashboard → Authentication → Users → Revoke sessions

3. **Si es compromiso masivo - Modo emergencia:**
   ```sql
   -- Bloquear todos los usuarios excepto super_admins
   UPDATE usuarios SET activo = false
   WHERE tipo != 'super_admin';
   ```

4. **Preservar evidencia:**
   ```sql
   -- Exportar logs relevantes antes de cualquier acción
   SELECT * FROM audit_log
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at;

   SELECT * FROM security_alerts
   WHERE created_at > NOW() - INTERVAL '24 hours';

   SELECT * FROM login_attempts
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

### FASE 3: Erradicación (2h - 24h)

1. **Identificar causa raíz:**
   - Revisar audit_log para la secuencia de eventos
   - Verificar cambios en roles/permisos
   - Comprobar integridad RLS: `SELECT * FROM verificar_rls_tablas();`

2. **Eliminar acceso del atacante:**
   - Cambiar contraseñas comprometidas
   - Revocar API keys si corresponde
   - Actualizar .env si hay credenciales expuestas

3. **Parchear vulnerabilidad:**
   - Identificar vector de ataque
   - Aplicar fix
   - Verificar fix con pentest

### FASE 4: Recuperación (24h - 72h)

1. **Restaurar servicio:**
   - Reactivar cuentas legítimas una por una
   - Verificar integridad de datos
   - Ejecutar `verificar_integridad_seguridad()`

2. **Monitoreo intensivo:**
   - Revisar dashboard cada hora durante 48h
   - Verificar que no hay accesos residuales

3. **Reactivar usuarios:**
   ```sql
   -- Reactivar usuarios legítimos
   UPDATE usuarios SET activo = true WHERE id IN (...);
   ```

### FASE 5: Lecciones Aprendidas (72h - 1 semana)

1. **Documentar:**
   - Timeline completo del incidente
   - Acciones tomadas
   - Efectividad de la respuesta
   - Mejoras identificadas

2. **Actualizar:**
   - Este documento si es necesario
   - Políticas de seguridad
   - Configuración de alertas
   - Tests de seguridad

---

## 5. Notificación RGPD

### Cuándo notificar a la AEPD (Art. 33 RGPD)
- **Plazo:** 72 horas desde la detección
- **Condición:** Cuando la brecha suponga un riesgo para derechos y libertades de personas
- **Portal:** https://sedeagpd.gob.es

### Cuándo notificar a los afectados (Art. 34 RGPD)
- Cuando la brecha suponga un **alto riesgo** para derechos y libertades
- Comunicación directa, clara y en lenguaje sencillo

### Plantilla de notificación AEPD:
1. Naturaleza de la violación
2. Datos del DPO
3. Consecuencias probables
4. Medidas adoptadas
5. Número aproximado de afectados
6. Categorías de datos afectados

---

## 6. Contactos de Emergencia

| Recurso | Contacto |
|---------|----------|
| Supabase Support | support@supabase.io |
| Cloudflare Support | Panel de Cloudflare |
| AEPD (notificación brechas) | https://sedeagpd.gob.es |
| INCIBE-CERT | incidencias@incibe-cert.es / 017 |

---

## 7. Botón de Emergencia (Kill Switch)

El Dashboard de Seguridad incluye un botón de emergencia que:
1. Desactiva todos los usuarios excepto super_admin
2. Registra la acción en audit_log
3. Genera una alerta de seguridad crítica

**Ubicación:** `/seguridad-dashboard` → "Modo Emergencia"

**Para revertir:** Un super_admin debe reactivar manualmente cada usuario verificando su legitimidad.

---

## 8. Checklist Post-Incidente

- [ ] Incidente documentado completamente
- [ ] Causa raíz identificada
- [ ] Vulnerabilidad parcheada
- [ ] Evidencia preservada
- [ ] AEPD notificada (si aplica)
- [ ] Usuarios afectados notificados (si aplica)
- [ ] Tests de seguridad actualizados
- [ ] Plan de respuesta actualizado
- [ ] Lecciones aprendidas compartidas con equipo
