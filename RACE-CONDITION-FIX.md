# Race Condition Fix — Lead Detail View

**Fecha:** 2026-03-10
**Commit:** `d1eca7e` — "Fix race condition: use cancelled flag in useEffect for lead loading"

---

## Problema

Al navegar rápidamente entre leads en el CRM (o cambiar de pestaña del navegador), la vista de detalle se quedaba permanentemente en skeleton de carga. Tras 6-7 navegaciones rápidas, la página dejaba de funcionar completamente.

### Causas raíz identificadas

1. **Race condition en queries asíncronas**: Al cambiar de lead, las queries del lead anterior completaban y actualizaban el estado del lead nuevo con datos incorrectos.
2. **Agotamiento del pool de conexiones HTTP**: Cada vista de lead lanzaba 4 queries paralelas + 5 de catálogos + prefetch on hover = ~60+ peticiones HTTP tras 7 navegaciones rápidas, saturando el límite de conexiones del navegador.
3. **Guard `requestId` bloqueaba `setLoading(false)`**: En `useVentasCRM.js`, las funciones `cargarPipelineCompleto`, `cargarLeads` y `cargarLeadsTabla` compartían un `loadRequestRef`. Cuando se lanzaban llamadas concurrentes, el `finally` no ejecutaba `setLoading(false)` porque el requestId ya no coincidía.
4. **Skeleton visible durante refresh en background**: `CRMKanban.jsx` mostraba skeleton cuando `loading === true`, incluso si ya había datos cargados previamente.

---

## Archivos modificados

### 1. `src/components/ventas/CRMLeadDetalle.jsx`

**Cambios:**

- **Consolidación de 4 queries en 1**: Se reemplazaron 4 queries paralelas (`ventas_leads`, `ventas_lead_pipeline`, `ventas_citas`, `ventas_lead_etiquetas`) por una sola query con nested selects de PostgREST:
  ```js
  supabase.from('ventas_leads').select(`
    id, nombre, email, ...,
    pipeline_states:ventas_lead_pipeline(...),
    citas:ventas_citas(...),
    lead_etiquetas:ventas_lead_etiquetas(...)
  `).eq('id', leadId).single()
  ```

- **Desactivación de prefetch**: `prefetchLeadDetail()` convertida en no-op para evitar acumulación de conexiones HTTP al hacer hover sobre leads.

- **Patrón `cancelled` flag en useEffect**: Se eliminó `cargarLead` como `useCallback` separado. Toda la lógica de carga ahora vive dentro de un único `useEffect([id])` con cleanup:
  ```js
  useEffect(() => {
    if (!id) return
    let cancelled = false
    // ... fetch data ...
    fetchLeadDetail(id).then(result => {
      if (cancelled) return  // ← Previene actualización de estado con datos obsoletos
      setLead(result)
      // ... cargar actividad ...
    })
    return () => { cancelled = true }  // ← Se ejecuta al cambiar id o desmontar
  }, [id])
  ```

- **Cache a nivel de módulo**: `_lastLeadCache` permite mostrar datos del lead anterior instantáneamente si se vuelve al mismo lead, evitando flash de skeleton.

---

### 2. `src/hooks/useVentasCRM.js`

**Cambios:**

- **Eliminación del guard `requestId` en `setLoading(false)`**: En `cargarPipelineCompleto`, `cargarLeads` y `cargarLeadsTabla`, el bloque `finally` ahora siempre ejecuta `setLoading(false)` si el componente sigue montado, sin verificar requestId.

- **Guard de concurrencia `refreshRunningRef`**: Se añadió un `useRef(false)` que previene que múltiples llamadas concurrentes a la misma función se apilen:
  ```js
  if (refreshRunningRef.current) return
  refreshRunningRef.current = true
  try { /* ... */ }
  finally { refreshRunningRef.current = false }
  ```

---

### 3. `src/components/ventas/CRMKanban.jsx`

**Cambio:**

- Condición de skeleton cambiada de `if (loading)` a `if (loading && !hasData)`:
  ```js
  const hasData = etapas.length > 0 && Object.keys(leads).some(k => (leads[k] || []).length > 0)
  if (loading && !hasData) { /* skeleton */ }
  ```
  Esto permite que los refreshes en background no oculten los datos ya visibles.

---

### 4. `src/hooks/useRefreshOnFocus.js`

**Cambio:**

- `minInterval` por defecto aumentado de `30_000` (30s) a `120_000` (2 min) para reducir la carga de peticiones al cambiar de pestaña rápidamente.

---

### 5. `src/contexts/AuthContext.jsx`

**Cambio:**

- Reintentos de `cargarUsuario` aumentados de 1 a 3, con delays incrementales (`1s`, `2s`, `3s`). Resuelve el problema intermitente de Mireia al iniciar sesión cuando hay errores de red transitorios.

---

### 6. `src/components/ProtectedRoute.jsx`

**Cambio:**

- Auto-retry: cuando `user` existe pero `usuario` es `null` y `loading` es `false`, se reintenta automáticamente tras 3 segundos. Texto de error cambiado a "Cargando cuenta..." con mensaje "Reintentando automáticamente".

---

## Resumen de impacto

| Métrica | Antes | Después |
|---------|-------|---------|
| Queries por vista de lead | 4 paralelas + prefetch | 1 consolidada |
| Conexiones HTTP por navegación | ~9 | ~2 |
| Skeleton stuck tras navegación rápida | Frecuente (6-7 cambios) | Resuelto |
| Datos obsoletos por race condition | Posible | Prevenido (cancelled flag) |
| Loading stuck en CRM kanban | Al cambiar pestaña | Solo si no hay datos previos |
| Login intermitente fallido | 1 reintento | 3 reintentos + auto-retry |
