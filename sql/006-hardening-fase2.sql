-- ==========================================================================
-- MADRIGAL CRM - FASE 2: HARDENING Y PERMISOS
-- Ejecutado en Supabase el 2026-02-19
-- ==========================================================================

-- Anti-escalacion: funcion helper
CREATE OR REPLACE FUNCTION get_user_protected_fields()
RETURNS TABLE(tipo TEXT, rol_id UUID, activo BOOLEAN) AS $$
BEGIN
  RETURN QUERY SELECT u.tipo, u.rol_id, u.activo FROM usuarios u WHERE u.id = auth.uid()::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Politica RESTRICTIVE anti-escalacion
CREATE POLICY usuarios_no_auto_escalation ON usuarios AS RESTRICTIVE FOR UPDATE
  WITH CHECK (
    id != auth.uid()::uuid
    OR
    (
      tipo = (SELECT f.tipo FROM get_user_protected_fields() f)
      AND rol_id IS NOT DISTINCT FROM (SELECT f.rol_id FROM get_user_protected_fields() f)
      AND activo = (SELECT f.activo FROM get_user_protected_fields() f)
    )
  );

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  accion VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_usuario_accion ON rate_limits(usuario_id, accion, created_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_limits_insert ON rate_limits FOR INSERT WITH CHECK (
  current_user = 'postgres'
  OR rate_limits.usuario_id = auth.uid()::uuid
);

CREATE POLICY rate_limits_select ON rate_limits FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'sistema.logs')
);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_usuario_id UUID,
  p_accion VARCHAR(100),
  p_max_por_hora INTEGER DEFAULT 10,
  p_max_por_dia INTEGER DEFAULT 50
) RETURNS BOOLEAN AS $$
DECLARE
  v_count_hora INTEGER;
  v_count_dia INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_hora
  FROM rate_limits
  WHERE usuario_id = p_usuario_id AND accion = p_accion
    AND created_at > NOW() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO v_count_dia
  FROM rate_limits
  WHERE usuario_id = p_usuario_id AND accion = p_accion
    AND created_at > NOW() - INTERVAL '1 day';

  IF v_count_hora >= p_max_por_hora OR v_count_dia >= p_max_por_dia THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limits (usuario_id, accion) VALUES (p_usuario_id, p_accion);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION limpiar_rate_limits()
RETURNS VOID AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================================
-- Permisos nuevos para modulos faltantes
-- ==========================================================================

INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('notificaciones.ver', 'notificaciones', 'Ver notificaciones', 'Ver sus propias notificaciones', 10),
('notificaciones.ver_todas', 'notificaciones', 'Ver todas las notificaciones', 'Ver notificaciones de todos', 20),
('notificaciones.configurar', 'notificaciones', 'Configurar notificaciones', 'Modificar ajustes', 30),
('archivos.ver_todos', 'archivos', 'Ver todos los archivos', 'Ver archivos de todos', 20),
('archivos.subir', 'archivos', 'Subir archivos', 'Subir nuevos archivos', 30),
('archivos.editar', 'archivos', 'Editar archivos', 'Renombrar, mover', 40),
('archivos.eliminar', 'archivos', 'Eliminar archivos', 'Eliminar archivos', 50),
('documentacion.crear', 'documentacion', 'Crear documentacion', 'Crear nuevos documentos', 20),
('documentacion.editar', 'documentacion', 'Editar documentacion', 'Editar existentes', 30),
('documentacion.eliminar', 'documentacion', 'Eliminar documentacion', 'Eliminar documentos', 40),
('madrigalito.usar', 'madrigalito', 'Usar Madrigalito', 'Interactuar', 20),
('madrigalito.configurar', 'madrigalito', 'Configurar Madrigalito', 'Ajustar config', 30),
('paquetes.ver', 'paquetes', 'Ver paquetes', 'Ver paquetes de clientes', 10),
('paquetes.crear', 'paquetes', 'Crear paquetes', 'Crear nuevos', 20),
('paquetes.editar', 'paquetes', 'Editar paquetes', 'Editar existentes', 30),
('paquetes.eliminar', 'paquetes', 'Eliminar paquetes', 'Eliminar', 40),
('notas.ver', 'notas', 'Ver notas', 'Ver notas de clientes', 10),
('notas.crear', 'notas', 'Crear notas', 'Anadir notas', 20),
('notas.editar', 'notas', 'Editar notas', 'Editar existentes', 30),
('notas.eliminar', 'notas', 'Eliminar notas', 'Eliminar notas', 40),
('historial.ver', 'historial', 'Ver historial', 'Ver historial de cambios', 10)
ON CONFLICT (codigo) DO NOTHING;
