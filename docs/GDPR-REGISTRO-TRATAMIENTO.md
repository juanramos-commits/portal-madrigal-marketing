# Registro de Actividades de Tratamiento (Art. 30 GDPR)

## 1. Datos del Responsable

- **Nombre**: Estrategias Madrigal Marketing S.L.
- **Dirección**: [Completar]
- **CIF**: [Completar]
- **Email de contacto DPD**: [Completar]
- **Representante**: [Completar nombre del representante legal]

## 2. Actividades de Tratamiento

### 2.1 Gestión de clientes (CRM)
- **Finalidad**: Gestión de la relación comercial con clientes
- **Base legal**: Ejecución de contrato (Art. 6.1.b GDPR)
- **Categorías de interesados**: Clientes empresas, contactos de clientes
- **Categorías de datos**: Nombre empresa, nombre contacto, email, teléfono, dirección
- **Destinatarios**: Personal interno autorizado (equipo comercial, dirección)
- **Transferencias internacionales**: Supabase (verificar región)
- **Plazo de supresión**: Vigencia contrato + 5 años
- **Medidas de seguridad**: RLS, cifrado en tránsito (HTTPS), acceso por permisos

### 2.2 Facturación
- **Finalidad**: Emisión y gestión de facturas
- **Base legal**: Obligación legal (Art. 6.1.c GDPR) - Ley del IVA
- **Categorías de interesados**: Clientes facturados
- **Categorías de datos**: CIF/NIF, razón social, dirección fiscal, datos bancarios
- **Destinatarios**: Personal contable, asesoría fiscal (si aplica)
- **Plazo de supresión**: 5 años (Ley del IVA), 6 años (Código de Comercio)
- **Medidas de seguridad**: RLS, acceso solo con permiso clientes.editar_facturacion

### 2.3 Gestión de leads
- **Finalidad**: Captación y seguimiento de potenciales clientes
- **Base legal**: Consentimiento (Art. 6.1.a) o interés legítimo (Art. 6.1.f)
- **Categorías de interesados**: Personas que han mostrado interés en servicios
- **Categorías de datos**: Nombre, email, teléfono, origen, estado
- **Destinatarios**: Equipo comercial
- **Plazo de supresión**: 2 años desde último contacto
- **Medidas de seguridad**: RLS, acceso por permisos

### 2.4 Gestión interna de usuarios
- **Finalidad**: Control de acceso y gestión del equipo
- **Base legal**: Interés legítimo (Art. 6.1.f) / Contrato laboral (Art. 6.1.b)
- **Categorías de interesados**: Empleados y colaboradores
- **Categorías de datos**: Nombre, email, rol, actividad
- **Destinatarios**: Dirección, administradores del sistema
- **Plazo de supresión**: Mientras esté activo + 3 años
- **Medidas de seguridad**: RLS, 2FA obligatorio para admins, auditoría

### 2.5 Seguridad y auditoría
- **Finalidad**: Detección de incidentes, cumplimiento normativo
- **Base legal**: Interés legítimo (Art. 6.1.f GDPR)
- **Categorías de interesados**: Todos los usuarios del sistema
- **Categorías de datos**: Acciones realizadas, timestamps, IPs (login_attempts)
- **Destinatarios**: Administradores de seguridad
- **Plazo de supresión**: audit_log 1 año, login_attempts 90 días, alertas 6 meses-1 año
- **Medidas de seguridad**: RLS, acceso solo con sistema.logs, SECURITY DEFINER

## 3. Medidas de Seguridad Técnicas y Organizativas (Art. 32 GDPR)

### Técnicas
- Cifrado en tránsito (HTTPS/TLS)
- Row Level Security (RLS) en todas las tablas
- Autenticación multifactor (2FA) obligatoria para administradores
- Política de contraseñas robusta (8+ caracteres, complejidad)
- Bloqueo de cuenta por intentos fallidos
- Rate limiting en operaciones sensibles
- Auditoría automática de acciones
- Headers de seguridad (CSP, X-Frame-Options, etc.)
- Anti-escalación de privilegios

### Organizativas
- Sistema de roles y permisos granular (93+ permisos)
- Principio de mínimo privilegio
- Registro y revisión de actividades
- Plan de respuesta a incidentes
- Documentación de seguridad actualizada
- Expiración de sesiones (24 horas)

## 4. Evaluación de Impacto (DPIA)

Dado el volumen y tipo de datos tratados (empresariales, no categorías especiales),
no se considera necesaria una DPIA formal. Se reevaluará si:
- Se empiezan a tratar datos de categorías especiales
- Se implementa perfilado automatizado
- Se amplía significativamente el volumen de datos

## 5. Fecha de última actualización

**2026-02-19**
