-- ============================================================
-- 024: Permisos granulares para módulo de ventas
-- Tablas puente rol_comercial → permisos + overrides por usuario
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Eliminar permisos ventas.* antiguos (coarse-grained)
-- ============================================================
DELETE FROM usuarios_permisos WHERE permiso_id IN (
    SELECT id FROM permisos WHERE codigo LIKE 'ventas.%'
);
DELETE FROM roles_permisos WHERE permiso_id IN (
    SELECT id FROM permisos WHERE codigo LIKE 'ventas.%'
);
DELETE FROM permisos WHERE codigo LIKE 'ventas.%';

-- ============================================================
-- 2. Insertar permisos granulares nuevos
-- ============================================================

-- CRM (8)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.crm.ver',              'ventas_crm', 'Ver CRM',                'Acceso al CRM de ventas', 300),
('ventas.crm.crear_leads',      'ventas_crm', 'Crear leads',            'Crear nuevos leads', 301),
('ventas.crm.editar_leads',     'ventas_crm', 'Editar leads',           'Editar datos de leads existentes', 302),
('ventas.crm.eliminar_leads',   'ventas_crm', 'Eliminar leads',         'Eliminar leads', 303),
('ventas.crm.mover_leads',      'ventas_crm', 'Mover leads',            'Mover leads entre etapas del pipeline', 304),
('ventas.crm.ver_todos',        'ventas_crm', 'Ver todos los leads',    'Ver leads de todo el equipo, no solo propios', 305),
('ventas.crm.asignar',          'ventas_crm', 'Asignar leads',          'Asignar setter/closer a leads', 306),
('ventas.crm.importar_exportar','ventas_crm', 'Importar/exportar leads','Importar y exportar leads CSV', 307);

-- VENTAS (7)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.ventas.ver',           'ventas_ventas', 'Ver ventas',           'Ver listado de ventas cerradas', 310),
('ventas.ventas.crear',         'ventas_ventas', 'Registrar venta',      'Registrar una nueva venta desde el CRM', 311),
('ventas.ventas.aprobar',       'ventas_ventas', 'Aprobar ventas',       'Aprobar ventas pendientes', 312),
('ventas.ventas.rechazar',      'ventas_ventas', 'Rechazar ventas',      'Rechazar ventas', 313),
('ventas.ventas.devolucion',    'ventas_ventas', 'Marcar devolución',    'Marcar una venta como devolución', 314),
('ventas.ventas.revertir',      'ventas_ventas', 'Revertir estados',     'Revertir rechazos y devoluciones', 315),
('ventas.ventas.exportar',      'ventas_ventas', 'Exportar ventas',      'Exportar ventas a CSV', 316);

-- WALLET (4)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.wallet.ver',           'ventas_wallet', 'Ver wallet',            'Ver wallet y comisiones propias', 320),
('ventas.wallet.ver_todos',     'ventas_wallet', 'Ver todos los wallets', 'Ver wallets y comisiones de todo el equipo', 321),
('ventas.wallet.solicitar_retiro','ventas_wallet','Solicitar retiro',     'Solicitar retiro de comisiones', 322),
('ventas.wallet.aprobar_retiros','ventas_wallet', 'Aprobar retiros',      'Aprobar o rechazar solicitudes de retiro', 323);

-- DASHBOARD (3)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.dashboard.ver',        'ventas_dashboard', 'Ver dashboard',         'Ver dashboard de ventas', 330),
('ventas.dashboard.personalizar','ventas_dashboard','Personalizar dashboard','Personalizar widgets del dashboard', 331),
('ventas.dashboard.ver_equipo', 'ventas_dashboard', 'Ver métricas equipo',   'Ver métricas y rankings del equipo', 332);

-- BIBLIOTECA (3)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.biblioteca.ver',                'ventas_biblioteca', 'Ver biblioteca',         'Acceso a la biblioteca de recursos', 340),
('ventas.biblioteca.gestionar_secciones','ventas_biblioteca', 'Gestionar secciones',    'Crear, editar y eliminar secciones', 341),
('ventas.biblioteca.gestionar_recursos', 'ventas_biblioteca', 'Gestionar recursos',     'Crear, editar y eliminar recursos', 342);

-- CALENDARIO (5)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.calendario.ver',             'ventas_calendario', 'Ver calendario',          'Ver calendario de citas', 350),
('ventas.calendario.disponibilidad',  'ventas_calendario', 'Gestionar disponibilidad','Configurar horarios disponibles', 351),
('ventas.calendario.bloqueos',        'ventas_calendario', 'Gestionar bloqueos',      'Crear y eliminar bloqueos de tiempo', 352),
('ventas.calendario.enlaces',         'ventas_calendario', 'Gestionar enlaces',       'Crear y gestionar enlaces de agenda', 353),
('ventas.calendario.reasignar',       'ventas_calendario', 'Reasignar citas',         'Reasignar citas a otros closers', 354);

-- NOTIFICACIONES (1)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.notificaciones.ver',   'ventas_notificaciones', 'Ver notificaciones', 'Ver notificaciones del módulo de ventas', 360);

-- AJUSTES (15)
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.ajustes.ver',               'ventas_ajustes', 'Acceder a ajustes',      'Acceso a la página de ajustes', 370),
('ventas.ajustes.perfil',            'ventas_ajustes', 'Perfil propio',           'Gestionar perfil personal', 371),
('ventas.ajustes.calendario',        'ventas_ajustes', 'Config calendario',       'Configuración de calendario propio', 372),
('ventas.ajustes.pipelines',         'ventas_ajustes', 'Gestionar pipelines',     'Crear y editar pipelines y etapas', 373),
('ventas.ajustes.reparto',           'ventas_ajustes', 'Reparto de leads',        'Configurar reparto automático de leads', 374),
('ventas.ajustes.paquetes',          'ventas_ajustes', 'Gestionar paquetes',      'Crear y editar paquetes comerciales', 375),
('ventas.ajustes.categorias',        'ventas_ajustes', 'Gestionar categorías',    'Crear y editar categorías de leads', 376),
('ventas.ajustes.comisiones',        'ventas_ajustes', 'Configurar comisiones',   'Configurar reglas de comisiones', 377),
('ventas.ajustes.empresa_fiscal',    'ventas_ajustes', 'Datos fiscales empresa',  'Gestionar datos fiscales de la empresa', 378),
('ventas.ajustes.equipo',            'ventas_ajustes', 'Gestionar equipo',        'Añadir/editar miembros del equipo comercial', 379),
('ventas.ajustes.webhooks',          'ventas_ajustes', 'Gestionar webhooks',      'Configurar webhooks de entrada de leads', 380),
('ventas.ajustes.reunion_estados',   'ventas_ajustes', 'Estados de reunión',      'Configurar estados de resultado de reuniones', 381),
('ventas.ajustes.campos_obligatorios','ventas_ajustes','Campos obligatorios',     'Configurar qué campos son obligatorios', 382),
('ventas.ajustes.log',               'ventas_ajustes', 'Log de actividad',        'Ver registro de actividad', 383),
('ventas.ajustes.permisos',          'ventas_ajustes', 'Gestionar permisos',      'Configurar permisos por rol y usuario', 384);

-- ============================================================
-- 3. Tabla puente: rol comercial → permisos
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_roles_permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_comercial VARCHAR(20) NOT NULL CHECK (rol_comercial IN ('setter', 'closer', 'director_ventas')),
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(rol_comercial, permiso_id)
);

CREATE INDEX IF NOT EXISTS idx_vrp_rol ON ventas_roles_permisos(rol_comercial);
CREATE INDEX IF NOT EXISTS idx_vrp_permiso ON ventas_roles_permisos(permiso_id);

-- RLS para ventas_roles_permisos
ALTER TABLE ventas_roles_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY vrp_select ON ventas_roles_permisos FOR SELECT USING (true);
CREATE POLICY vrp_insert ON ventas_roles_permisos FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vrp_update ON ventas_roles_permisos FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vrp_delete ON ventas_roles_permisos FOR DELETE USING (
    ventas_es_super_admin()
);

-- ============================================================
-- 4. Tabla de overrides por usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_usuarios_permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    permitido BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(usuario_id, permiso_id)
);

CREATE INDEX IF NOT EXISTS idx_vup_usuario ON ventas_usuarios_permisos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vup_permiso ON ventas_usuarios_permisos(permiso_id);

-- RLS para ventas_usuarios_permisos
ALTER TABLE ventas_usuarios_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY vup_select ON ventas_usuarios_permisos FOR SELECT USING (
    ventas_es_super_admin() OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vup_insert ON ventas_usuarios_permisos FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vup_update ON ventas_usuarios_permisos FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vup_delete ON ventas_usuarios_permisos FOR DELETE USING (
    ventas_es_super_admin()
);

-- ============================================================
-- 5. RPC: Obtener permisos efectivos de un usuario ventas
-- ============================================================
CREATE OR REPLACE FUNCTION obtener_permisos_ventas_usuario(p_usuario_id UUID)
RETURNS TABLE(codigo VARCHAR, permitido BOOLEAN) AS $$
DECLARE
    v_tipo VARCHAR;
BEGIN
    -- Super admin tiene todos los permisos
    SELECT tipo INTO v_tipo FROM usuarios WHERE id = p_usuario_id;
    IF v_tipo = 'super_admin' THEN
        RETURN QUERY
        SELECT p.codigo, TRUE as permitido
        FROM permisos p
        WHERE p.codigo LIKE 'ventas.%';
        RETURN;
    END IF;

    RETURN QUERY
    WITH permisos_de_roles AS (
        -- Unir permisos de todos los roles comerciales del usuario
        SELECT DISTINCT vrp.permiso_id, TRUE as permitido
        FROM ventas_roles_comerciales vrc
        JOIN ventas_roles_permisos vrp ON vrp.rol_comercial = vrc.rol
        WHERE vrc.usuario_id = p_usuario_id
          AND vrc.activo = true
    ),
    overrides AS (
        -- Overrides específicos del usuario
        SELECT vup.permiso_id, vup.permitido
        FROM ventas_usuarios_permisos vup
        WHERE vup.usuario_id = p_usuario_id
    )
    SELECT
        p.codigo,
        COALESCE(o.permitido, pr.permitido, FALSE) as permitido
    FROM permisos p
    LEFT JOIN permisos_de_roles pr ON pr.permiso_id = p.id
    LEFT JOIN overrides o ON o.permiso_id = p.id
    WHERE p.codigo LIKE 'ventas.%'
      AND COALESCE(o.permitido, pr.permitido, FALSE) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. Seed: Permisos por defecto para cada rol comercial
-- ============================================================

-- SETTER: permisos básicos de visualización y gestión propia
INSERT INTO ventas_roles_permisos (rol_comercial, permiso_id)
SELECT 'setter', id FROM permisos WHERE codigo IN (
    'ventas.crm.ver',
    'ventas.crm.editar_leads',
    'ventas.crm.mover_leads',
    'ventas.ventas.ver',
    'ventas.wallet.ver',
    'ventas.wallet.solicitar_retiro',
    'ventas.dashboard.ver',
    'ventas.biblioteca.ver',
    'ventas.calendario.ver',
    'ventas.calendario.disponibilidad',
    'ventas.notificaciones.ver',
    'ventas.ajustes.ver',
    'ventas.ajustes.perfil',
    'ventas.ajustes.calendario'
);

-- CLOSER: permisos de setter + crear ventas + personalizar dashboard
INSERT INTO ventas_roles_permisos (rol_comercial, permiso_id)
SELECT 'closer', id FROM permisos WHERE codigo IN (
    'ventas.crm.ver',
    'ventas.crm.crear_leads',
    'ventas.crm.editar_leads',
    'ventas.crm.mover_leads',
    'ventas.ventas.ver',
    'ventas.ventas.crear',
    'ventas.wallet.ver',
    'ventas.wallet.solicitar_retiro',
    'ventas.dashboard.ver',
    'ventas.dashboard.personalizar',
    'ventas.biblioteca.ver',
    'ventas.calendario.ver',
    'ventas.calendario.disponibilidad',
    'ventas.calendario.bloqueos',
    'ventas.notificaciones.ver',
    'ventas.ajustes.ver',
    'ventas.ajustes.perfil',
    'ventas.ajustes.calendario'
);

-- DIRECTOR: todos los permisos
INSERT INTO ventas_roles_permisos (rol_comercial, permiso_id)
SELECT 'director_ventas', id FROM permisos WHERE codigo LIKE 'ventas.%';

COMMIT;
