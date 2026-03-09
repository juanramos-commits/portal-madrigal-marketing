-- ============================================================================
-- 046 - Email Marketing: Permisos
-- Inserta los 17 permisos granulares del módulo de email marketing
-- y los asigna automáticamente a super_admin y director_ventas.
-- ============================================================================


-- ─── 1. Insertar permisos ─────────────────────────────────────────────────────

INSERT INTO permisos (id, codigo, modulo, nombre, descripcion, orden) VALUES
    (gen_random_uuid(), 'ventas.email.ver',                  'ventas', 'Ver Email Marketing',      'Acceso al módulo de email marketing',        500),
    (gen_random_uuid(), 'ventas.email.contactos.ver',        'ventas', 'Ver contactos email',      'Ver lista de contactos de email',            501),
    (gen_random_uuid(), 'ventas.email.contactos.editar',     'ventas', 'Editar contactos email',   'Editar contactos de email marketing',        502),
    (gen_random_uuid(), 'ventas.email.campanas.ver',         'ventas', 'Ver campañas',             'Ver campañas de email',                      503),
    (gen_random_uuid(), 'ventas.email.campanas.crear',       'ventas', 'Crear campañas',           'Crear y editar campañas de email',           504),
    (gen_random_uuid(), 'ventas.email.campanas.enviar',      'ventas', 'Enviar campañas',          'Enviar campañas de email',                   505),
    (gen_random_uuid(), 'ventas.email.plantillas.ver',       'ventas', 'Ver plantillas',           'Ver plantillas de email',                    506),
    (gen_random_uuid(), 'ventas.email.plantillas.crear',     'ventas', 'Crear plantillas',         'Crear plantillas de email',                  507),
    (gen_random_uuid(), 'ventas.email.plantillas.editar',    'ventas', 'Editar plantillas',        'Editar plantillas de email',                 508),
    (gen_random_uuid(), 'ventas.email.segmentos.ver',        'ventas', 'Ver segmentos',            'Ver segmentos de audiencia',                 509),
    (gen_random_uuid(), 'ventas.email.segmentos.crear',      'ventas', 'Crear segmentos',          'Crear segmentos de audiencia',               510),
    (gen_random_uuid(), 'ventas.email.automaciones.ver',     'ventas', 'Ver automaciones',         'Ver automaciones de email',                  511),
    (gen_random_uuid(), 'ventas.email.automaciones.crear',   'ventas', 'Crear automaciones',       'Crear automaciones de email',                512),
    (gen_random_uuid(), 'ventas.email.automaciones.activar', 'ventas', 'Activar automaciones',     'Activar/desactivar automaciones',            513),
    (gen_random_uuid(), 'ventas.email.analytics.ver',        'ventas', 'Ver analytics email',      'Ver analytics de email marketing',           514),
    (gen_random_uuid(), 'ventas.email.ajustes.ver',          'ventas', 'Ver ajustes email',        'Ver ajustes de email marketing',             515),
    (gen_random_uuid(), 'ventas.email.ajustes.editar',       'ventas', 'Editar ajustes email',     'Editar ajustes de email marketing',          516)
ON CONFLICT (codigo) DO NOTHING;


-- ─── 2. Asignar permisos a roles super_admin y director_ventas ────────────────

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre IN ('super_admin', 'director_ventas')
  AND p.codigo LIKE 'ventas.email.%'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;


-- ============================================================================
-- FIN 046
-- ============================================================================
