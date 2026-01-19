-- ==========================================================================
-- MADRIGAL CRM - ACTUALIZACIÓN SISTEMA DE USUARIOS Y PERMISOS
-- Ejecutar en Supabase SQL Editor
-- ==========================================================================

-- 1. MODIFICAR TABLA USUARIOS
-- ==========================================================================

-- Añadir campo tipo de usuario
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'equipo' 
CHECK (tipo IN ('super_admin', 'admin', 'equipo', 'cliente'));

-- Añadir campo rol_id (referencia a roles)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS rol_id UUID;

-- Añadir campo cliente_id (para usuarios tipo cliente)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

-- Añadir campo ultimo_acceso
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

-- Añadir campo invitado_por
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS invitado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- Añadir campo fecha_invitacion
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS fecha_invitacion TIMESTAMPTZ;

-- 2. RECREAR TABLA ROLES (antes era plantillas_rol)
-- ==========================================================================

-- Eliminar tabla antigua si existe
DROP TABLE IF EXISTS plantillas_rol CASCADE;

-- Crear nueva tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    nivel INTEGER DEFAULT 0, -- 0-100, mayor = más poder
    color VARCHAR(7) DEFAULT '#6B7280', -- color hex para badges
    es_sistema BOOLEAN DEFAULT FALSE, -- no se puede eliminar
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Añadir FK de usuarios a roles
ALTER TABLE usuarios 
ADD CONSTRAINT fk_usuarios_rol 
FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE SET NULL;

-- 3. RECREAR TABLA PERMISOS
-- ==========================================================================

-- Eliminar tabla antigua
DROP TABLE IF EXISTS permisos_disponibles CASCADE;

-- Crear nueva tabla de permisos
CREATE TABLE IF NOT EXISTS permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    modulo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por módulo
CREATE INDEX IF NOT EXISTS idx_permisos_modulo ON permisos(modulo);

-- 4. TABLA PERMISOS DE ROL
-- ==========================================================================

DROP TABLE IF EXISTS roles_permisos CASCADE;

CREATE TABLE roles_permisos (
    rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (rol_id, permiso_id)
);

-- 5. RECREAR TABLA PERMISOS ESPECÍFICOS DE USUARIO
-- ==========================================================================

DROP TABLE IF EXISTS usuarios_permisos CASCADE;

CREATE TABLE usuarios_permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    permitido BOOLEAN NOT NULL, -- true = permitir, false = denegar
    asignado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, permiso_id)
);

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS idx_usuarios_permisos_usuario ON usuarios_permisos(usuario_id);

-- 6. INSERTAR ROLES POR DEFECTO
-- ==========================================================================

INSERT INTO roles (nombre, descripcion, nivel, color, es_sistema) VALUES
('Super Admin', 'Control total del sistema', 100, '#EF4444', TRUE),
('Directivo Comercial', 'Gestión del equipo comercial y ventas', 90, '#F59E0B', TRUE),
('Directivo Clientes', 'Gestión del equipo de cuentas y clientes', 90, '#F59E0B', TRUE),
('Contable', 'Gestión de facturación y finanzas', 70, '#10B981', TRUE),
('Media Buyer', 'Gestión de campañas y leads', 60, '#3B82F6', TRUE),
('Comercial', 'Captación y seguimiento de leads', 60, '#8B5CF6', TRUE),
('Creativo', 'Gestión de branding y contenido', 50, '#EC4899', TRUE)
ON CONFLICT (nombre) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    nivel = EXCLUDED.nivel,
    color = EXCLUDED.color;

-- 7. INSERTAR CATÁLOGO DE PERMISOS
-- ==========================================================================

INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
-- Dashboard
('dashboard.ver', 'dashboard', 'Ver dashboard', 'Acceso al dashboard principal', 10),
('dashboard.ver_metricas_globales', 'dashboard', 'Ver métricas globales', 'Ver estadísticas de toda la empresa', 11),
('dashboard.ver_metricas_equipo', 'dashboard', 'Ver métricas de equipo', 'Ver estadísticas del equipo asignado', 12),

-- Clientes
('clientes.ver_lista', 'clientes', 'Ver lista de clientes', 'Acceso a la lista de clientes', 20),
('clientes.ver_detalle', 'clientes', 'Ver detalle de cliente', 'Acceso al detalle completo de un cliente', 21),
('clientes.crear', 'clientes', 'Crear clientes', 'Crear nuevos clientes', 22),
('clientes.editar', 'clientes', 'Editar clientes', 'Editar información general de clientes', 23),
('clientes.editar_facturacion', 'clientes', 'Editar facturación', 'Editar datos de facturación', 24),
('clientes.editar_branding', 'clientes', 'Editar branding', 'Editar información de branding', 25),
('clientes.eliminar', 'clientes', 'Eliminar clientes', 'Eliminar clientes del sistema', 26),
('clientes.asignar_responsable', 'clientes', 'Asignar responsable', 'Cambiar el responsable de un cliente', 27),
('clientes.ver_solo_asignados', 'clientes', 'Solo ver asignados', 'Solo puede ver clientes que tiene asignados', 28),
('clientes.exportar', 'clientes', 'Exportar clientes', 'Exportar datos de clientes', 29),

-- Leads
('leads.ver', 'leads', 'Ver leads', 'Acceso a los leads', 30),
('leads.crear', 'leads', 'Crear leads', 'Crear nuevos leads', 31),
('leads.editar', 'leads', 'Editar leads', 'Editar información de leads', 32),
('leads.eliminar', 'leads', 'Eliminar leads', 'Eliminar leads', 33),
('leads.cambiar_estado', 'leads', 'Cambiar estado', 'Cambiar el estado de los leads', 34),
('leads.ver_solo_asignados', 'leads', 'Solo ver asignados', 'Solo puede ver leads de sus clientes', 35),
('leads.exportar', 'leads', 'Exportar leads', 'Exportar datos de leads', 36),
('leads.importar', 'leads', 'Importar leads', 'Importar leads masivamente', 37),

-- Campañas
('campanas.ver', 'campanas', 'Ver campañas', 'Acceso a las campañas', 40),
('campanas.crear', 'campanas', 'Crear campañas', 'Crear nuevas campañas', 41),
('campanas.editar', 'campanas', 'Editar campañas', 'Editar información de campañas', 42),
('campanas.eliminar', 'campanas', 'Eliminar campañas', 'Eliminar campañas', 43),
('campanas.ver_metricas', 'campanas', 'Ver métricas', 'Ver métricas de rendimiento', 44),
('campanas.ver_solo_asignadas', 'campanas', 'Solo ver asignadas', 'Solo puede ver campañas de sus clientes', 45),

-- Tareas
('tareas.ver_todas', 'tareas', 'Ver todas las tareas', 'Ver tareas de todos los usuarios', 50),
('tareas.ver_propias', 'tareas', 'Ver tareas propias', 'Ver solo sus propias tareas', 51),
('tareas.crear', 'tareas', 'Crear tareas', 'Crear nuevas tareas', 52),
('tareas.editar', 'tareas', 'Editar tareas', 'Editar información de tareas', 53),
('tareas.eliminar', 'tareas', 'Eliminar tareas', 'Eliminar tareas', 54),
('tareas.asignar', 'tareas', 'Asignar tareas', 'Asignar tareas a otros usuarios', 55),
('tareas.completar', 'tareas', 'Completar tareas', 'Marcar tareas como completadas', 56),

-- Sugerencias
('sugerencias.ver_todas', 'sugerencias', 'Ver todas las sugerencias', 'Ver sugerencias de todos', 60),
('sugerencias.ver_propias', 'sugerencias', 'Ver sugerencias propias', 'Ver solo sus sugerencias', 61),
('sugerencias.crear', 'sugerencias', 'Crear sugerencias', 'Crear nuevas sugerencias', 62),
('sugerencias.editar', 'sugerencias', 'Editar sugerencias', 'Editar sugerencias', 63),
('sugerencias.eliminar', 'sugerencias', 'Eliminar sugerencias', 'Eliminar sugerencias', 64),
('sugerencias.responder', 'sugerencias', 'Responder sugerencias', 'Responder a sugerencias de otros', 65),

-- Reuniones
('reuniones.ver', 'reuniones', 'Ver reuniones', 'Acceso a las reuniones', 70),
('reuniones.crear', 'reuniones', 'Crear reuniones', 'Crear nuevas reuniones', 71),
('reuniones.editar', 'reuniones', 'Editar reuniones', 'Editar información de reuniones', 72),
('reuniones.eliminar', 'reuniones', 'Eliminar reuniones', 'Eliminar reuniones', 73),
('reuniones.ver_transcripciones', 'reuniones', 'Ver transcripciones', 'Ver transcripciones de reuniones', 74),

-- Facturación
('facturacion.ver', 'facturacion', 'Ver facturación', 'Acceso a facturación', 80),
('facturacion.crear', 'facturacion', 'Crear facturas', 'Crear nuevas facturas', 81),
('facturacion.editar', 'facturacion', 'Editar facturas', 'Editar facturas existentes', 82),
('facturacion.eliminar', 'facturacion', 'Eliminar facturas', 'Eliminar facturas', 83),
('facturacion.marcar_pagada', 'facturacion', 'Marcar como pagada', 'Marcar facturas como pagadas', 84),
('facturacion.ver_informes', 'facturacion', 'Ver informes', 'Ver informes financieros', 85),
('facturacion.exportar', 'facturacion', 'Exportar facturación', 'Exportar datos de facturación', 86),

-- Usuarios (Admin)
('usuarios.ver', 'usuarios', 'Ver usuarios', 'Ver lista de usuarios', 90),
('usuarios.crear', 'usuarios', 'Crear usuarios', 'Invitar nuevos usuarios', 91),
('usuarios.editar', 'usuarios', 'Editar usuarios', 'Editar información de usuarios', 92),
('usuarios.eliminar', 'usuarios', 'Eliminar usuarios', 'Eliminar usuarios del sistema', 93),
('usuarios.cambiar_password', 'usuarios', 'Cambiar contraseñas', 'Cambiar contraseña de otros usuarios', 94),
('usuarios.activar_desactivar', 'usuarios', 'Activar/Desactivar', 'Activar o desactivar cuentas', 95),
('usuarios.ver_actividad', 'usuarios', 'Ver actividad', 'Ver registro de actividad de usuarios', 96),

-- Roles (Admin)
('roles.ver', 'roles', 'Ver roles', 'Ver lista de roles', 100),
('roles.crear', 'roles', 'Crear roles', 'Crear nuevos roles', 101),
('roles.editar', 'roles', 'Editar roles', 'Editar roles existentes', 102),
('roles.eliminar', 'roles', 'Eliminar roles', 'Eliminar roles', 103),

-- Sistema (Super Admin)
('sistema.configuracion', 'sistema', 'Configuración', 'Acceso a configuración del sistema', 110),
('sistema.webhooks', 'sistema', 'Webhooks', 'Gestión de webhooks', 111),
('sistema.logs', 'sistema', 'Logs', 'Ver logs del sistema', 112),
('sistema.backup', 'sistema', 'Backup', 'Realizar backups', 113)

ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    modulo = EXCLUDED.modulo,
    orden = EXCLUDED.orden;

-- 8. ASIGNAR PERMISOS A ROLES
-- ==========================================================================

-- Función auxiliar para asignar permisos a un rol
CREATE OR REPLACE FUNCTION asignar_permisos_rol(p_rol_nombre VARCHAR, p_codigos TEXT[])
RETURNS VOID AS $$
DECLARE
    v_rol_id UUID;
    v_codigo TEXT;
    v_permiso_id UUID;
BEGIN
    SELECT id INTO v_rol_id FROM roles WHERE nombre = p_rol_nombre;
    
    IF v_rol_id IS NULL THEN
        RAISE EXCEPTION 'Rol no encontrado: %', p_rol_nombre;
    END IF;
    
    -- Eliminar permisos anteriores del rol
    DELETE FROM roles_permisos WHERE rol_id = v_rol_id;
    
    -- Insertar nuevos permisos
    FOREACH v_codigo IN ARRAY p_codigos
    LOOP
        SELECT id INTO v_permiso_id FROM permisos WHERE codigo = v_codigo;
        IF v_permiso_id IS NOT NULL THEN
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES (v_rol_id, v_permiso_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Directivo Comercial
SELECT asignar_permisos_rol('Directivo Comercial', ARRAY[
    'dashboard.ver', 'dashboard.ver_metricas_globales', 'dashboard.ver_metricas_equipo',
    'clientes.ver_lista', 'clientes.ver_detalle', 'clientes.crear', 'clientes.editar', 'clientes.asignar_responsable', 'clientes.exportar',
    'leads.ver', 'leads.crear', 'leads.editar', 'leads.cambiar_estado', 'leads.exportar', 'leads.importar',
    'campanas.ver', 'campanas.ver_metricas',
    'tareas.ver_todas', 'tareas.crear', 'tareas.editar', 'tareas.asignar', 'tareas.completar',
    'sugerencias.ver_todas', 'sugerencias.crear', 'sugerencias.editar', 'sugerencias.responder',
    'reuniones.ver', 'reuniones.crear', 'reuniones.editar', 'reuniones.ver_transcripciones',
    'facturacion.ver', 'facturacion.ver_informes',
    'usuarios.ver', 'usuarios.ver_actividad'
]);

-- Directivo Clientes
SELECT asignar_permisos_rol('Directivo Clientes', ARRAY[
    'dashboard.ver', 'dashboard.ver_metricas_globales', 'dashboard.ver_metricas_equipo',
    'clientes.ver_lista', 'clientes.ver_detalle', 'clientes.crear', 'clientes.editar', 'clientes.editar_facturacion', 'clientes.editar_branding', 'clientes.asignar_responsable', 'clientes.exportar',
    'leads.ver', 'leads.crear', 'leads.editar', 'leads.cambiar_estado', 'leads.exportar',
    'campanas.ver', 'campanas.crear', 'campanas.editar', 'campanas.ver_metricas',
    'tareas.ver_todas', 'tareas.crear', 'tareas.editar', 'tareas.asignar', 'tareas.completar',
    'sugerencias.ver_todas', 'sugerencias.crear', 'sugerencias.editar', 'sugerencias.responder',
    'reuniones.ver', 'reuniones.crear', 'reuniones.editar', 'reuniones.ver_transcripciones',
    'facturacion.ver', 'facturacion.ver_informes',
    'usuarios.ver', 'usuarios.ver_actividad'
]);

-- Contable
SELECT asignar_permisos_rol('Contable', ARRAY[
    'dashboard.ver',
    'clientes.ver_lista', 'clientes.ver_detalle', 'clientes.editar_facturacion',
    'facturacion.ver', 'facturacion.crear', 'facturacion.editar', 'facturacion.eliminar', 'facturacion.marcar_pagada', 'facturacion.ver_informes', 'facturacion.exportar',
    'tareas.ver_propias', 'tareas.crear', 'tareas.completar'
]);

-- Media Buyer
SELECT asignar_permisos_rol('Media Buyer', ARRAY[
    'dashboard.ver',
    'clientes.ver_lista', 'clientes.ver_detalle',
    'leads.ver', 'leads.crear', 'leads.editar', 'leads.cambiar_estado', 'leads.ver_solo_asignados',
    'campanas.ver', 'campanas.crear', 'campanas.editar', 'campanas.ver_metricas', 'campanas.ver_solo_asignadas',
    'tareas.ver_propias', 'tareas.crear', 'tareas.editar', 'tareas.completar',
    'sugerencias.ver_propias', 'sugerencias.crear'
]);

-- Comercial
SELECT asignar_permisos_rol('Comercial', ARRAY[
    'dashboard.ver',
    'clientes.ver_lista', 'clientes.ver_detalle', 'clientes.ver_solo_asignados',
    'leads.ver', 'leads.crear', 'leads.editar', 'leads.cambiar_estado', 'leads.ver_solo_asignados',
    'tareas.ver_propias', 'tareas.crear', 'tareas.completar',
    'sugerencias.ver_propias', 'sugerencias.crear',
    'reuniones.ver', 'reuniones.crear', 'reuniones.editar'
]);

-- Creativo
SELECT asignar_permisos_rol('Creativo', ARRAY[
    'dashboard.ver',
    'clientes.ver_lista', 'clientes.ver_detalle', 'clientes.editar_branding', 'clientes.ver_solo_asignados',
    'tareas.ver_propias', 'tareas.crear', 'tareas.completar',
    'sugerencias.ver_propias', 'sugerencias.crear'
]);

-- 9. FUNCIÓN PARA OBTENER PERMISOS EFECTIVOS DE UN USUARIO
-- ==========================================================================

CREATE OR REPLACE FUNCTION obtener_permisos_usuario(p_usuario_id UUID)
RETURNS TABLE(codigo VARCHAR, permitido BOOLEAN) AS $$
DECLARE
    v_tipo VARCHAR;
    v_rol_id UUID;
BEGIN
    -- Obtener tipo y rol del usuario
    SELECT u.tipo, u.rol_id INTO v_tipo, v_rol_id
    FROM usuarios u WHERE u.id = p_usuario_id;
    
    -- Super Admin tiene todos los permisos
    IF v_tipo = 'super_admin' THEN
        RETURN QUERY
        SELECT p.codigo, TRUE
        FROM permisos p;
        RETURN;
    END IF;
    
    -- Para otros usuarios: combinar permisos de rol + overrides
    RETURN QUERY
    WITH permisos_rol AS (
        -- Permisos que vienen del rol
        SELECT p.codigo, TRUE as permitido
        FROM permisos p
        JOIN roles_permisos rp ON rp.permiso_id = p.id
        WHERE rp.rol_id = v_rol_id
    ),
    overrides AS (
        -- Overrides específicos del usuario
        SELECT p.codigo, up.permitido
        FROM usuarios_permisos up
        JOIN permisos p ON p.id = up.permiso_id
        WHERE up.usuario_id = p_usuario_id
    )
    -- Combinar: override tiene prioridad sobre rol
    SELECT 
        COALESCE(o.codigo, pr.codigo) as codigo,
        COALESCE(o.permitido, pr.permitido) as permitido
    FROM permisos_rol pr
    FULL OUTER JOIN overrides o ON o.codigo = pr.codigo
    WHERE COALESCE(o.permitido, pr.permitido) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. FUNCIÓN PARA VERIFICAR UN PERMISO ESPECÍFICO
-- ==========================================================================

CREATE OR REPLACE FUNCTION tiene_permiso(p_usuario_id UUID, p_codigo VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_tipo VARCHAR;
    v_rol_id UUID;
    v_override BOOLEAN;
    v_rol_tiene BOOLEAN;
BEGIN
    -- Obtener tipo y rol del usuario
    SELECT u.tipo, u.rol_id INTO v_tipo, v_rol_id
    FROM usuarios u WHERE u.id = p_usuario_id;
    
    -- Super Admin siempre tiene permiso
    IF v_tipo = 'super_admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Buscar override específico
    SELECT up.permitido INTO v_override
    FROM usuarios_permisos up
    JOIN permisos p ON p.id = up.permiso_id
    WHERE up.usuario_id = p_usuario_id AND p.codigo = p_codigo;
    
    -- Si hay override, usarlo
    IF v_override IS NOT NULL THEN
        RETURN v_override;
    END IF;
    
    -- Si no hay override, verificar permiso del rol
    SELECT EXISTS(
        SELECT 1 FROM roles_permisos rp
        JOIN permisos p ON p.id = rp.permiso_id
        WHERE rp.rol_id = v_rol_id AND p.codigo = p_codigo
    ) INTO v_rol_tiene;
    
    RETURN COALESCE(v_rol_tiene, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. ACTUALIZAR USUARIO EXISTENTE A SUPER ADMIN
-- ==========================================================================

UPDATE usuarios 
SET tipo = 'super_admin'
WHERE email = 'info@madrigalmarketing.es';

-- 12. TRIGGER PARA UPDATED_AT
-- ==========================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 13. ROW LEVEL SECURITY PARA CLIENTES
-- ==========================================================================

-- Habilitar RLS en tablas sensibles
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

-- Política para clientes: usuarios tipo 'cliente' solo ven su registro
CREATE POLICY clientes_policy ON clientes
    FOR ALL
    USING (
        -- Super admin y admin ven todo
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id = auth.uid()::uuid 
            AND usuarios.tipo IN ('super_admin', 'admin', 'equipo')
        )
        OR
        -- Clientes solo ven su propio registro
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id = auth.uid()::uuid 
            AND usuarios.tipo = 'cliente'
            AND usuarios.cliente_id = clientes.id
        )
    );

-- Política para leads
CREATE POLICY leads_policy ON leads
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id = auth.uid()::uuid 
            AND usuarios.tipo IN ('super_admin', 'admin', 'equipo')
        )
        OR
        EXISTS (
            SELECT 1 FROM usuarios u
            JOIN clientes c ON c.id = u.cliente_id
            WHERE u.id = auth.uid()::uuid 
            AND u.tipo = 'cliente'
            AND leads.cliente_id = c.id
        )
    );

-- 14. ÍNDICES ADICIONALES
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_cliente ON usuarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- ==========================================================================
-- FIN DEL SCRIPT
-- ==========================================================================
