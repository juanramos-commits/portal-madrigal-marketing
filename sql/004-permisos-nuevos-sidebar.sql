-- ==========================================================================
-- MADRIGAL CRM - PERMISOS NUEVOS PARA SIDEBAR
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-02-19
-- ==========================================================================

-- Insertar permisos nuevos para módulos que no tenían
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('documentacion.ver', 'documentacion', 'Ver documentación', 'Acceso a la sección de documentación', 120),
('archivos.ver', 'archivos', 'Ver archivos', 'Acceso a la sección de archivos', 130),
('madrigalito.ver', 'madrigalito', 'Ver Madrigalito', 'Acceso a Madrigalito', 140)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    modulo = EXCLUDED.modulo,
    orden = EXCLUDED.orden;

-- Asignar permisos a roles:
-- documentacion.ver → Todos los roles
-- reuniones.ver → Ya existe y está asignado a algunos roles
-- archivos.ver → Todos los roles
-- madrigalito.ver → Todos los roles

-- Función para asignar un permiso a varios roles
DO $$
DECLARE
    v_permiso_id UUID;
    v_rol_record RECORD;
BEGIN
    -- documentacion.ver → Todos los roles
    SELECT id INTO v_permiso_id FROM permisos WHERE codigo = 'documentacion.ver';
    IF v_permiso_id IS NOT NULL THEN
        FOR v_rol_record IN SELECT id FROM roles LOOP
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES (v_rol_record.id, v_permiso_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- archivos.ver → Todos los roles
    SELECT id INTO v_permiso_id FROM permisos WHERE codigo = 'archivos.ver';
    IF v_permiso_id IS NOT NULL THEN
        FOR v_rol_record IN SELECT id FROM roles LOOP
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES (v_rol_record.id, v_permiso_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- madrigalito.ver → Todos los roles
    SELECT id INTO v_permiso_id FROM permisos WHERE codigo = 'madrigalito.ver';
    IF v_permiso_id IS NOT NULL THEN
        FOR v_rol_record IN SELECT id FROM roles LOOP
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES (v_rol_record.id, v_permiso_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- ==========================================================================
-- FIN
-- ==========================================================================
