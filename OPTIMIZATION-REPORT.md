# Query Optimization Report

**Fecha:** 2026-03-10

---

## Resumen

| Métrica | Antes | Después | Reducción |
|---------|-------|---------|-----------|
| Queries totales al cargar CRM (kanban) | ~23 | ~6 | **-74%** |
| Queries `ventas_lead_pipeline` | 14 (1 por etapa) | 1 (todas las etapas) | **-93%** |
| Queries `ventas_roles_comerciales` (useVentas) | 3 | 1 | **-67%** |
| Queries `ventas_ventas` (contadores) | 5 | 1 | **-80%** |
| Conexiones HTTP simultáneas máximas | ~23 | ~6 | **Bajo el límite de 6/dominio** |

---

## Problema 1 (CRÍTICO): 14 queries → 1 para kanban leads

### Archivos modificados
- `src/hooks/useVentasCRM.js`

### Cambios

**`buildLeadQuery`** (línea ~148):
- Cuando `etapaId` es null (query unificada), no añade `{ count: 'exact' }` para ahorrar overhead de conteo en PostgreSQL.
- Cuando `etapaId` está presente (cargarMasLeads), mantiene `{ count: 'exact' }` para paginación.

**`cargarDatosIniciales`** (línea ~431):
- ANTES: `Promise.all(etapasData.map(etapa => buildLeadQuery(..., etapa.id).range(0, 19)))` → 14 queries paralelas
- DESPUÉS: 1 query `buildLeadQuery(pipeline.id, pipeline.nombre).order('fecha_entrada', { ascending: false }).limit(500)`, agrupación por `etapa_id` en frontend

**`cargarPipelineCompleto`** (línea ~268):
- Mismo cambio que `cargarDatosIniciales`: 1 query + agrupación frontend
- Eliminado el intento de RPC `ventas_contar_leads_por_etapa` (ya innecesario, los counts se derivan de los datos)

**`cargarLeads`** (línea ~503):
- Mismo cambio: 1 query + agrupación frontend

**`cargarMasLeads`** (línea ~540):
- SIN CAMBIOS — sigue usando query por etapa individual (necesario para paginación incremental)

### Decisiones
- Límite global de 500 leads por query. Si un pipeline tiene >500 leads, se mostrarán los 500 más recientes por `fecha_entrada`. En la práctica, los pipelines de Madrigal tienen ~50-100 leads activos.
- Los counts por etapa se derivan del array agrupado (no de `count: 'exact'`). Esto es exacto para ≤500 leads.
- `hasMore` por etapa se calcula comparando items en la etapa vs `LEADS_PER_BATCH` (20).

---

## Problema 2 (MEDIO): 3 queries → 1 para roles comerciales

### Archivos modificados
- `src/hooks/useVentas.js`

### Cambios

**Antes** (3 queries):
1. `select('id, usuario_id, rol, activo').eq('activo', true)` → roles básicos
2. `select('usuario_id, usuario:usuarios(...)').eq('rol', 'setter')` → setters con nombre
3. `select('usuario_id, usuario:usuarios(...)').eq('rol', 'closer')` → closers con nombre

**Después** (1 query):
1. `select('id, usuario_id, rol, activo, usuario:usuarios(id, nombre, email)').eq('activo', true)`
2. `settersList = roles.filter(r => r.rol === 'setter')` en frontend
3. `closersList = roles.filter(r => r.rol === 'closer')` en frontend

Cache key cambiada de `rolesBasic` + `settersList` + `closersList` → `rolesAll` (1 sola key).

---

## Problema 3 (MEDIO): 5 queries → 1 para contadores de ventas

### Archivos modificados
- `src/hooks/useVentas.js`

### Cambios

**Antes** (5 queries con `head: true`):
1. `select('id', { count: 'exact', head: true })` → total
2. + `.eq('estado', 'pendiente').eq('es_devolucion', false)` → pendientes
3. + `.eq('estado', 'aprobada').eq('es_devolucion', false)` → aprobadas
4. + `.eq('estado', 'rechazada').eq('es_devolucion', false)` → rechazadas
5. + `.eq('es_devolucion', true)` → devoluciones

**Después** (1 query):
1. `select('estado, es_devolucion')` con los mismos filtros de rol/fecha/etc.
2. Conteo por estado en frontend con `.filter().length`

### Decisiones
- La query trae solo 2 columnas (`estado`, `es_devolucion`) sin joins, por lo que el payload es mínimo (~10 bytes por row).
- Para un usuario con ~200 ventas, esto son ~2KB vs 5 roundtrips HTTP.
- Si en el futuro hay miles de ventas por usuario, se podría crear un RPC `contar_ventas_por_estado(p_user_id)` para hacerlo en SQL.

---

## Qué NO se cambió
- **UI**: Ningún componente visual modificado
- **RLS policies**: Sin cambios en Supabase
- **Dependencias**: Sin añadir ninguna
- **Paginación**: `cargarMasLeads` sigue funcionando igual (query por etapa individual)
- **Filtros de rol**: La lógica admin/setter/closer se mantiene intacta en `buildLeadQuery`
- **Realtime**: Las subscriptions y handlers no se tocaron
- **Table view**: `cargarLeadsTabla` ya hacía 1 sola query (sin filtro por etapa), no necesitaba cambio
