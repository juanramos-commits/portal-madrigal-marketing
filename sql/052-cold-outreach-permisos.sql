-- ============================================================================
-- 052 - Cold Outreach: Permisos
-- Inserta los 15 permisos granulares del módulo de cold outreach
-- y los asigna automáticamente a super_admin y director_ventas.
-- ============================================================================


-- ─── 1. Insertar permisos ─────────────────────────────────────────────────────

INSERT INTO permisos (id, codigo, modulo, nombre, descripcion, orden) VALUES
    (gen_random_uuid(), 'ventas.outreach.ver',                  'ventas_outreach', 'Ver Cold Outreach',          'Acceso al módulo de outreach',           520),
    (gen_random_uuid(), 'ventas.outreach.dominios.ver',         'ventas_outreach', 'Ver dominios',               'Ver dominios de envío',                  521),
    (gen_random_uuid(), 'ventas.outreach.dominios.editar',      'ventas_outreach', 'Editar dominios',            'Gestionar dominios de envío',            522),
    (gen_random_uuid(), 'ventas.outreach.inboxes.ver',          'ventas_outreach', 'Ver inboxes',                'Ver cuentas de envío',                   523),
    (gen_random_uuid(), 'ventas.outreach.inboxes.editar',       'ventas_outreach', 'Editar inboxes',             'Gestionar cuentas de envío',             524),
    (gen_random_uuid(), 'ventas.outreach.listas.ver',           'ventas_outreach', 'Ver listas',                 'Ver listas de contactos',                525),
    (gen_random_uuid(), 'ventas.outreach.listas.editar',        'ventas_outreach', 'Editar listas',              'Gestionar listas de contactos',          526),
    (gen_random_uuid(), 'ventas.outreach.campanas.ver',         'ventas_outreach', 'Ver campañas outreach',      'Ver campañas de outreach',               527),
    (gen_random_uuid(), 'ventas.outreach.campanas.crear',       'ventas_outreach', 'Crear campañas outreach',    'Crear campañas de outreach',             528),
    (gen_random_uuid(), 'ventas.outreach.campanas.enviar',      'ventas_outreach', 'Enviar campañas outreach',   'Activar envío de campañas',              529),
    (gen_random_uuid(), 'ventas.outreach.respuestas.ver',       'ventas_outreach', 'Ver respuestas',             'Ver respuestas recibidas',               530),
    (gen_random_uuid(), 'ventas.outreach.respuestas.gestionar', 'ventas_outreach', 'Gestionar respuestas',       'Clasificar y responder',                 531),
    (gen_random_uuid(), 'ventas.outreach.analytics.ver',        'ventas_outreach', 'Ver analytics outreach',     'Ver analytics de outreach',              532),
    (gen_random_uuid(), 'ventas.outreach.ajustes.ver',          'ventas_outreach', 'Ver ajustes outreach',       'Ver ajustes del módulo',                 533),
    (gen_random_uuid(), 'ventas.outreach.ajustes.editar',       'ventas_outreach', 'Editar ajustes outreach',    'Editar ajustes del módulo',              534)
ON CONFLICT (codigo) DO NOTHING;

-- Si los permisos ya existían con modulo='ventas', actualizar a 'ventas_outreach'
UPDATE permisos SET modulo = 'ventas_outreach' WHERE codigo LIKE 'ventas.outreach.%' AND modulo != 'ventas_outreach';


-- ─── 2. Asignar permisos a roles del sistema (roles_permisos) ────────────────
-- Nombres reales de los roles en la tabla roles: 'Super Admin', 'Directivo Comercial'

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r, permisos p
WHERE r.nombre IN ('Super Admin', 'Directivo Comercial')
  AND p.codigo LIKE 'ventas.outreach.%'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;


-- ─── 3. Asignar permisos a roles comerciales (ventas_roles_permisos) ─────────
-- Tabla usada por el panel de Ajustes > Permisos del equipo comercial

INSERT INTO ventas_roles_permisos (id, rol_comercial, permiso_id)
SELECT gen_random_uuid(), rc.rol, p.id
FROM (VALUES ('director_ventas'), ('closer'), ('setter')) AS rc(rol),
     permisos p
WHERE p.codigo LIKE 'ventas.outreach.%'
  AND (
    -- director_ventas: todos los permisos de outreach
    rc.rol = 'director_ventas'
    -- closer: solo permisos de lectura (.ver)
    OR (rc.rol = 'closer' AND p.codigo IN (
      'ventas.outreach.ver', 'ventas.outreach.dominios.ver',
      'ventas.outreach.inboxes.ver', 'ventas.outreach.listas.ver',
      'ventas.outreach.campanas.ver', 'ventas.outreach.respuestas.ver',
      'ventas.outreach.analytics.ver', 'ventas.outreach.ajustes.ver'
    ))
    -- setter: solo ver módulo y ver respuestas
    OR (rc.rol = 'setter' AND p.codigo IN (
      'ventas.outreach.ver', 'ventas.outreach.respuestas.ver'
    ))
  )
ON CONFLICT (rol_comercial, permiso_id) DO NOTHING;


-- ============================================================================
-- FIN 052
-- ============================================================================
