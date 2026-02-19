# Inventario de Datos Personales - GDPR

## Responsable del Tratamiento
**Estrategias Madrigal Marketing S.L.**

## Tablas con datos personales

| Tabla | Datos personales | Base legal | Retención |
|-------|-----------------|------------|-----------|
| usuarios | email, nombre | Interés legítimo (gestión interna) | Mientras esté activo + 3 años |
| clientes | nombre empresa, contacto, email, teléfono | Contrato de prestación de servicios | Vigencia contrato + 5 años (fiscal) |
| clientes_facturacion | CIF/NIF, dirección fiscal, datos bancarios | Obligación legal (facturación) | 5 años (Ley de IVA) |
| clientes_socios | nombre, cargo, email, teléfono de socios | Contrato / interés legítimo | Vigencia contrato + 3 años |
| leads | nombre, email, teléfono | Consentimiento / interés legítimo | 2 años desde último contacto |
| cliente_notas | Notas con posible info personal | Interés legítimo | Mientras exista el cliente |
| audit_log | usuario_email, nombre, acciones | Interés legítimo (seguridad) | 1 año |
| login_attempts | email, IP | Interés legítimo (seguridad) | 90 días |
| security_alerts | datos de usuarios involucrados | Interés legítimo (seguridad) | 6 meses resueltas, 1 año no resueltas |

## Derechos del interesado (GDPR Art. 12-22)

| Derecho | Estado | Implementación |
|---------|--------|---------------|
| Acceso (Art. 15) | Implementado | Botón "Descargar mis datos" en /mi-seguridad |
| Rectificación (Art. 16) | Implementado | Edición de perfil en la app |
| Supresión (Art. 17) | Implementado | Solicitud vía contacto, anonimización de datos |
| Portabilidad (Art. 20) | Implementado | Exportación JSON desde /mi-seguridad |
| Oposición (Art. 21) | Parcial | Contacto directo con responsable |
| Limitación (Art. 18) | Parcial | Desactivación de cuenta |

## Excepciones a la supresión

Los siguientes datos NO se pueden eliminar por obligación legal:
- **Facturas y datos fiscales**: 5 años (Ley 37/1992 del IVA, art. 164)
- **Documentos mercantiles**: 6 años (Código de Comercio, art. 30)
- Se ANONIMIZAN en lugar de eliminar cuando hay obligación de retención

## Transferencias internacionales

- **Supabase**: Verificar región del proyecto en Dashboard > Settings > General
  - Si región UE (Frankfurt, Dublin, etc.): OK sin medidas adicionales
  - Si fuera de UE: Requiere SCCs (Standard Contractual Clauses) - Supabase los proporciona
- **Cloudflare** (si se usa para CDN): Tiene DPA y SCCs disponibles
