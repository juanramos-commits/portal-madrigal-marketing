-- ============================================================
-- 025: Añadir permiso ventas.ventas.ver_todos
-- Faltaba este permiso para filtrado de datos en ventas
-- ============================================================

BEGIN;

-- 1. Insertar el nuevo permiso
INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.ventas.ver_todos', 'ventas_ventas', 'Ver todas las ventas', 'Ver ventas de todo el equipo, no solo propias', 317)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Asignar al rol director_ventas
INSERT INTO ventas_roles_permisos (rol_comercial, permiso_id)
SELECT 'director_ventas', id FROM permisos WHERE codigo = 'ventas.ventas.ver_todos'
ON CONFLICT (rol_comercial, permiso_id) DO NOTHING;

COMMIT;
