# Subencargados del Tratamiento

## Listado de subencargados

| Servicio | Proveedor | Función | Datos tratados | DPA | Región | Garantías |
|----------|-----------|---------|---------------|-----|--------|-----------|
| Base de datos y Auth | Supabase Inc. | Almacenamiento y autenticación | Todos los datos de la app | Sí (disponible en supabase.com/privacy) | Verificar en Dashboard > Settings | SCCs si fuera de UE |
| CDN / Hosting | Cloudflare Inc. | Distribución de contenido estático | Metadatos de conexión, IPs | Sí (disponible en cloudflare.com/gdpr) | Global con nodos en UE | SCCs + Binding Corporate Rules |
| Edge Functions | Supabase Inc. (Deno Deploy) | Ejecución de funciones serverless | Datos procesados en funciones | Cubierto por DPA de Supabase | Mismo que proyecto Supabase | SCCs si fuera de UE |

## Verificación de región de Supabase

Para verificar dónde se almacenan los datos:
1. Ir a Supabase Dashboard
2. Settings > General
3. Verificar "Region"

**Regiones EU de Supabase**: Frankfurt (eu-central-1), Dublin (eu-west-1), London (eu-west-2)
**Si está en región EU**: No se requieren medidas adicionales para transferencias
**Si está fuera de EU**: Verificar que Supabase proporciona SCCs y documentar

## Acciones requeridas

- [ ] Verificar región del proyecto Supabase
- [ ] Firmar DPA con Supabase si no se ha hecho (disponible en su web)
- [ ] Documentar cualquier cambio de subencargado
- [ ] Revisar anualmente la lista de subencargados

## Fecha de última revisión

**2026-02-19**
