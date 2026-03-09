-- ============================================================================
-- 046 - Email Marketing: Permisos
-- Inserta los 17 permisos granulares del módulo de email marketing
-- y los asigna automáticamente a super_admin y director_ventas.
-- ============================================================================


-- ─── 1. Insertar permisos ─────────────────────────────────────────────────────

INSERT INTO permisos (id, codigo, modulo, nombre, descripcion, orden) VALUES
    (gen_random_uuid(), 'ventas.email.ver',                  'ventas_email', 'Ver Email Marketing',      'Acceso al módulo de email marketing',        500),
    (gen_random_uuid(), 'ventas.email.contactos.ver',        'ventas_email', 'Ver contactos email',      'Ver lista de contactos de email',            501),
    (gen_random_uuid(), 'ventas.email.contactos.editar',     'ventas_email', 'Editar contactos email',   'Editar contactos de email marketing',        502),
    (gen_random_uuid(), 'ventas.email.campanas.ver',         'ventas_email', 'Ver campañas',             'Ver campañas de email',                      503),
    (gen_random_uuid(), 'ventas.email.campanas.crear',       'ventas_email', 'Crear campañas',           'Crear y editar campañas de email',           504),
    (gen_random_uuid(), 'ventas.email.campanas.enviar',      'ventas_email', 'Enviar campañas',          'Enviar campañas de email',                   505),
    (gen_random_uuid(), 'ventas.email.plantillas.ver',       'ventas_email', 'Ver plantillas',           'Ver plantillas de email',                    506),
    (gen_random_uuid(), 'ventas.email.plantillas.crear',     'ventas_email', 'Crear plantillas',         'Crear plantillas de email',                  507),
    (gen_random_uuid(), 'ventas.email.plantillas.editar',    'ventas_email', 'Editar plantillas',        'Editar plantillas de email',                 508),
    (gen_random_uuid(), 'ventas.email.segmentos.ver',        'ventas_email', 'Ver segmentos',            'Ver segmentos de audiencia',                 509),
    (gen_random_uuid(), 'ventas.email.segmentos.crear',      'ventas_email', 'Crear segmentos',          'Crear segmentos de audiencia',               510),
    (gen_random_uuid(), 'ventas.email.automaciones.ver',     'ventas_email', 'Ver automaciones',         'Ver automaciones de email',                  511),
    (gen_random_uuid(), 'ventas.email.automaciones.crear',   'ventas_email', 'Crear automaciones',       'Crear automaciones de email',                512),
    (gen_random_uuid(), 'ventas.email.automaciones.activar', 'ventas_email', 'Activar automaciones',     'Activar/desactivar automaciones',            513),
    (gen_random_uuid(), 'ventas.email.analytics.ver',        'ventas_email', 'Ver analytics email',      'Ver analytics de email marketing',           514),
    (gen_random_uuid(), 'ventas.email.ajustes.ver',          'ventas_email', 'Ver ajustes email',        'Ver ajustes de email marketing',             515),
    (gen_random_uuid(), 'ventas.email.ajustes.editar',       'ventas_email', 'Editar ajustes email',     'Editar ajustes de email marketing',          516)
ON CONFLICT (codigo) DO NOTHING;

-- Si los permisos ya existían con modulo='ventas', actualizar a 'ventas_email'
UPDATE permisos SET modulo = 'ventas_email' WHERE codigo LIKE 'ventas.email.%' AND modulo != 'ventas_email';


-- ─── 2. Asignar permisos a roles del sistema (roles_permisos) ────────────────
-- Nombres reales de los roles en la tabla roles: 'Super Admin', 'Directivo Comercial'

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre IN ('Super Admin', 'Directivo Comercial')
  AND p.codigo LIKE 'ventas.email.%'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;


-- ─── 3. Asignar permisos a roles comerciales (ventas_roles_permisos) ─────────
-- Tabla usada por el panel de Ajustes > Permisos del equipo comercial

INSERT INTO ventas_roles_permisos (id, rol_comercial, permiso_id)
SELECT gen_random_uuid(), rc.rol, p.id
FROM (VALUES ('director_ventas'), ('closer'), ('setter')) AS rc(rol),
     permisos p
WHERE p.codigo LIKE 'ventas.email.%'
  AND (
    -- director_ventas: todos los permisos de email
    rc.rol = 'director_ventas'
    -- closer: solo ver (no enviar, no ajustes.editar)
    OR (rc.rol = 'closer' AND p.codigo IN (
      'ventas.email.ver', 'ventas.email.contactos.ver', 'ventas.email.campanas.ver',
      'ventas.email.plantillas.ver', 'ventas.email.segmentos.ver',
      'ventas.email.automaciones.ver', 'ventas.email.analytics.ver', 'ventas.email.ajustes.ver'
    ))
    -- setter: solo ver dashboard y contactos
    OR (rc.rol = 'setter' AND p.codigo IN (
      'ventas.email.ver', 'ventas.email.contactos.ver', 'ventas.email.analytics.ver'
    ))
  )
ON CONFLICT (rol_comercial, permiso_id) DO NOTHING;


-- ============================================================================
-- FIN 046
-- ============================================================================
