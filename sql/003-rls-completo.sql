-- ==========================================================================
-- MADRIGAL CRM - RLS COMPLETO PARA TODAS LAS TABLAS
-- Ejecutar en Supabase SQL Editor SECCION POR SECCION
-- Fecha: 2026-02-19
-- ==========================================================================
--
-- IMPORTANTE: La función tiene_permiso(uuid, varchar) ya existe y es
-- SECURITY DEFINER. Se reutiliza en todas las políticas.
--
-- Lógica general:
-- - Super admin tiene acceso total (manejado dentro de tiene_permiso)
-- - Cada operación (SELECT/INSERT/UPDATE/DELETE) tiene su propia política
-- - WITH CHECK se incluye en INSERT y UPDATE
-- - ver_solo_asignados filtra por usuario_asignado_id donde aplique

-- ==========================================================================
-- SECCION 3A: Arreglar políticas existentes de CLIENTES y LEADS
-- ==========================================================================

-- Eliminar políticas actuales
DROP POLICY IF EXISTS clientes_policy ON clientes;
DROP POLICY IF EXISTS leads_policy ON leads;

-- CLIENTES: SELECT
-- Si tiene 'clientes.ver_lista' Y NO tiene 'clientes.ver_solo_asignados' → ve todos
-- Si tiene 'clientes.ver_lista' Y tiene 'clientes.ver_solo_asignados' → solo los suyos
-- Si NO tiene 'clientes.ver_lista' pero es tipo 'cliente' → solo su registro
CREATE POLICY clientes_select ON clientes FOR SELECT USING (
  -- Opción 1: usuario interno con permiso de ver lista
  (
    tiene_permiso(auth.uid()::uuid, 'clientes.ver_lista')
    AND (
      -- Sin restricción de solo asignados → ve todos
      NOT tiene_permiso(auth.uid()::uuid, 'clientes.ver_solo_asignados')
      OR
      -- Con restricción → solo donde es responsable
      clientes.usuario_asignado_id = auth.uid()::uuid
    )
  )
  OR
  -- Opción 2: usuario tipo cliente → solo su propio registro
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()::uuid
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = clientes.id
  )
);

-- CLIENTES: INSERT
CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.crear')
);

-- CLIENTES: UPDATE
CREATE POLICY clientes_update ON clientes FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'clientes.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'clientes.editar'));

-- CLIENTES: DELETE
CREATE POLICY clientes_delete ON clientes FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.eliminar')
);

-- LEADS: SELECT
CREATE POLICY leads_select ON leads FOR SELECT USING (
  -- Usuario interno con permiso de ver leads
  (
    tiene_permiso(auth.uid()::uuid, 'leads.ver')
    AND (
      NOT tiene_permiso(auth.uid()::uuid, 'leads.ver_solo_asignados')
      OR
      -- Solo leads de clientes donde es responsable
      EXISTS (
        SELECT 1 FROM clientes
        WHERE clientes.id = leads.cliente_id
        AND clientes.usuario_asignado_id = auth.uid()::uuid
      )
    )
  )
  OR
  -- Usuario tipo cliente → solo leads de su empresa
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()::uuid
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = leads.cliente_id
  )
);

-- LEADS: INSERT
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'leads.crear')
);

-- LEADS: UPDATE
CREATE POLICY leads_update ON leads FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'leads.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'leads.editar'));

-- LEADS: DELETE
CREATE POLICY leads_delete ON leads FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'leads.eliminar')
);

-- ==========================================================================
-- SECCION 3B: RLS en tabla USUARIOS
-- ==========================================================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- SELECT: Si tiene usuarios.ver ve todos, si no, solo se ve a sí mismo
CREATE POLICY usuarios_select ON usuarios FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'usuarios.ver')
  OR
  usuarios.id = auth.uid()::uuid
);

-- INSERT: Solo con usuarios.crear
CREATE POLICY usuarios_insert ON usuarios FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'usuarios.crear')
);

-- UPDATE: Solo con usuarios.editar, o el propio usuario (campos limitados via app)
CREATE POLICY usuarios_update ON usuarios FOR UPDATE
  USING (
    tiene_permiso(auth.uid()::uuid, 'usuarios.editar')
    OR
    usuarios.id = auth.uid()::uuid
  )
  WITH CHECK (
    tiene_permiso(auth.uid()::uuid, 'usuarios.editar')
    OR
    usuarios.id = auth.uid()::uuid
  );

-- DELETE: Solo con usuarios.eliminar
CREATE POLICY usuarios_delete ON usuarios FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'usuarios.eliminar')
);

-- ==========================================================================
-- SECCION 3C: RLS en tablas secundarias de CLIENTES
-- Hereda acceso de la tabla clientes principal
-- ==========================================================================

-- Función auxiliar para verificar acceso a un cliente específico
-- Evita repetir la lógica completa en cada tabla secundaria
CREATE OR REPLACE FUNCTION puede_ver_cliente(p_cliente_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM clientes WHERE clientes.id = p_cliente_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- CLIENTES_FACTURACION
ALTER TABLE clientes_facturacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_facturacion_select ON clientes_facturacion FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY clientes_facturacion_insert ON clientes_facturacion FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.editar_facturacion')
);
CREATE POLICY clientes_facturacion_update ON clientes_facturacion FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'clientes.editar_facturacion'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'clientes.editar_facturacion'));
CREATE POLICY clientes_facturacion_delete ON clientes_facturacion FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.eliminar')
);

-- CLIENTES_BRANDING
ALTER TABLE clientes_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_branding_select ON clientes_branding FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY clientes_branding_insert ON clientes_branding FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.editar_branding')
);
CREATE POLICY clientes_branding_update ON clientes_branding FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'clientes.editar_branding'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'clientes.editar_branding'));
CREATE POLICY clientes_branding_delete ON clientes_branding FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.eliminar')
);

-- CLIENTES_URLS
ALTER TABLE clientes_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_urls_select ON clientes_urls FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY clientes_urls_insert ON clientes_urls FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.editar')
);
CREATE POLICY clientes_urls_update ON clientes_urls FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'clientes.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'clientes.editar'));
CREATE POLICY clientes_urls_delete ON clientes_urls FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.eliminar')
);

-- CLIENTES_INFO_ADICIONAL
ALTER TABLE clientes_info_adicional ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_info_adicional_select ON clientes_info_adicional FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY clientes_info_adicional_insert ON clientes_info_adicional FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.editar')
);
CREATE POLICY clientes_info_adicional_update ON clientes_info_adicional FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'clientes.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'clientes.editar'));
CREATE POLICY clientes_info_adicional_delete ON clientes_info_adicional FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.eliminar')
);

-- NOTA: clientes_lanzamiento no existe en la BD actual, se omite

-- CLIENTES_SOCIOS
ALTER TABLE clientes_socios ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_socios_select ON clientes_socios FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY clientes_socios_insert ON clientes_socios FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'clientes.editar')
);
CREATE POLICY clientes_socios_update ON clientes_socios FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'clientes.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'clientes.editar'));
CREATE POLICY clientes_socios_delete ON clientes_socios FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'clientes.eliminar')
);

-- CLIENTE_NOTAS
ALTER TABLE cliente_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY cliente_notas_select ON cliente_notas FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY cliente_notas_insert ON cliente_notas FOR INSERT WITH CHECK (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY cliente_notas_update ON cliente_notas FOR UPDATE
  USING (puede_ver_cliente(cliente_id))
  WITH CHECK (puede_ver_cliente(cliente_id));
CREATE POLICY cliente_notas_delete ON cliente_notas FOR DELETE USING (
  puede_ver_cliente(cliente_id)
);

-- CLIENTE_HISTORIAL
ALTER TABLE cliente_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY cliente_historial_select ON cliente_historial FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
-- Historial se inserta automáticamente, permitir a quien pueda ver el cliente
CREATE POLICY cliente_historial_insert ON cliente_historial FOR INSERT WITH CHECK (
  puede_ver_cliente(cliente_id)
);

-- ==========================================================================
-- SECCION 3D: RLS en tabla TAREAS
-- ==========================================================================

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

-- SELECT: ver_todas = todo, ver_propias = solo las propias
CREATE POLICY tareas_select ON tareas FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'tareas.ver_todas')
  OR
  (
    tiene_permiso(auth.uid()::uuid, 'tareas.ver_propias')
    AND (
      tareas.asignado_a_id = auth.uid()::uuid
      OR tareas.creado_por_id = auth.uid()::uuid
    )
  )
);

-- INSERT
CREATE POLICY tareas_insert ON tareas FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'tareas.crear')
);

-- UPDATE: editar + ver_todas = todas, editar + ver_propias = solo las propias
CREATE POLICY tareas_update ON tareas FOR UPDATE
  USING (
    tiene_permiso(auth.uid()::uuid, 'tareas.editar')
    AND (
      tiene_permiso(auth.uid()::uuid, 'tareas.ver_todas')
      OR tareas.asignado_a_id = auth.uid()::uuid
      OR tareas.creado_por_id = auth.uid()::uuid
    )
  )
  WITH CHECK (
    tiene_permiso(auth.uid()::uuid, 'tareas.editar')
  );

-- DELETE
CREATE POLICY tareas_delete ON tareas FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'tareas.eliminar')
);

-- ==========================================================================
-- SECCION 3E: RLS en tablas del sistema de permisos
-- ==========================================================================

-- ROLES: Lectura para todos los autenticados (necesario para UI)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_select ON roles FOR SELECT USING (
  auth.uid() IS NOT NULL
);
CREATE POLICY roles_insert ON roles FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'roles.crear')
);
CREATE POLICY roles_update ON roles FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'roles.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'roles.editar'));
CREATE POLICY roles_delete ON roles FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'roles.eliminar')
);

-- PERMISOS: Lectura para todos los autenticados
ALTER TABLE permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY permisos_select ON permisos FOR SELECT USING (
  auth.uid() IS NOT NULL
);
-- Solo super_admin puede modificar el catálogo de permisos (via SQL)
-- No se crean políticas INSERT/UPDATE/DELETE para proteger el catálogo

-- ROLES_PERMISOS: Lectura para todos, escritura con roles.editar
ALTER TABLE roles_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_permisos_select ON roles_permisos FOR SELECT USING (
  auth.uid() IS NOT NULL
);
CREATE POLICY roles_permisos_insert ON roles_permisos FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'roles.editar')
);
CREATE POLICY roles_permisos_delete ON roles_permisos FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'roles.editar')
);

-- USUARIOS_PERMISOS: Ver si tienes usuarios.ver o es tu propio registro
ALTER TABLE usuarios_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuarios_permisos_select ON usuarios_permisos FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'usuarios.ver')
  OR
  usuarios_permisos.usuario_id = auth.uid()::uuid
);
CREATE POLICY usuarios_permisos_insert ON usuarios_permisos FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'usuarios.editar')
);
CREATE POLICY usuarios_permisos_update ON usuarios_permisos FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'usuarios.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'usuarios.editar'));
CREATE POLICY usuarios_permisos_delete ON usuarios_permisos FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'usuarios.editar')
);

-- ==========================================================================
-- SECCION 3F: RLS en REUNIONES
-- ==========================================================================

ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;

-- SELECT: Si tiene reuniones.ver ve todas, si no solo las de sus clientes
CREATE POLICY reuniones_select ON reuniones FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'reuniones.ver')
  OR
  -- Usuario tipo cliente ve las reuniones de su empresa
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()::uuid
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = reuniones.cliente_id
  )
);

CREATE POLICY reuniones_insert ON reuniones FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'reuniones.crear')
);

CREATE POLICY reuniones_update ON reuniones FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'reuniones.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'reuniones.editar'));

CREATE POLICY reuniones_delete ON reuniones FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'reuniones.eliminar')
);

-- ==========================================================================
-- SECCION 3G: RLS en tablas restantes
-- ==========================================================================

-- PAQUETES_LEADS: Acceso ligado a clientes
ALTER TABLE paquetes_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY paquetes_leads_select ON paquetes_leads FOR SELECT USING (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY paquetes_leads_insert ON paquetes_leads FOR INSERT WITH CHECK (
  puede_ver_cliente(cliente_id)
);
CREATE POLICY paquetes_leads_update ON paquetes_leads FOR UPDATE
  USING (puede_ver_cliente(cliente_id))
  WITH CHECK (puede_ver_cliente(cliente_id));
CREATE POLICY paquetes_leads_delete ON paquetes_leads FOR DELETE USING (
  puede_ver_cliente(cliente_id)
);

-- USUARIOS_MENU_ORDER: Solo tu propio registro
ALTER TABLE usuarios_menu_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuarios_menu_order_select ON usuarios_menu_order FOR SELECT USING (
  usuarios_menu_order.usuario_id = auth.uid()::uuid
);
CREATE POLICY usuarios_menu_order_insert ON usuarios_menu_order FOR INSERT WITH CHECK (
  usuarios_menu_order.usuario_id = auth.uid()::uuid
);
CREATE POLICY usuarios_menu_order_update ON usuarios_menu_order FOR UPDATE
  USING (usuarios_menu_order.usuario_id = auth.uid()::uuid)
  WITH CHECK (usuarios_menu_order.usuario_id = auth.uid()::uuid);
CREATE POLICY usuarios_menu_order_delete ON usuarios_menu_order FOR DELETE USING (
  usuarios_menu_order.usuario_id = auth.uid()::uuid
);

-- CAMPAÑAS: RLS ya activado pero sin políticas (BLOQUEADO)
-- Crear políticas para desbloquear
DROP POLICY IF EXISTS campanas_select ON campanas;
DROP POLICY IF EXISTS campanas_insert ON campanas;
DROP POLICY IF EXISTS campanas_update ON campanas;
DROP POLICY IF EXISTS campanas_delete ON campanas;

CREATE POLICY campanas_select ON campanas FOR SELECT USING (
  (
    tiene_permiso(auth.uid()::uuid, 'campanas.ver')
    AND (
      NOT tiene_permiso(auth.uid()::uuid, 'campanas.ver_solo_asignadas')
      OR
      EXISTS (
        SELECT 1 FROM clientes
        WHERE clientes.id = campanas.cliente_id
        AND clientes.usuario_asignado_id = auth.uid()::uuid
      )
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()::uuid
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = campanas.cliente_id
  )
);

CREATE POLICY campanas_insert ON campanas FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'campanas.crear')
);

CREATE POLICY campanas_update ON campanas FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'campanas.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'campanas.editar'));

CREATE POLICY campanas_delete ON campanas FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'campanas.eliminar')
);

-- FACTURAS: RLS ya activado pero sin políticas (BLOQUEADO)
DROP POLICY IF EXISTS facturas_select ON facturas;
DROP POLICY IF EXISTS facturas_insert ON facturas;
DROP POLICY IF EXISTS facturas_update ON facturas;
DROP POLICY IF EXISTS facturas_delete ON facturas;

CREATE POLICY facturas_select ON facturas FOR SELECT USING (
  tiene_permiso(auth.uid()::uuid, 'facturacion.ver')
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()::uuid
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = facturas.cliente_id
  )
);

CREATE POLICY facturas_insert ON facturas FOR INSERT WITH CHECK (
  tiene_permiso(auth.uid()::uuid, 'facturacion.crear')
);

CREATE POLICY facturas_update ON facturas FOR UPDATE
  USING (tiene_permiso(auth.uid()::uuid, 'facturacion.editar'))
  WITH CHECK (tiene_permiso(auth.uid()::uuid, 'facturacion.editar'));

CREATE POLICY facturas_delete ON facturas FOR DELETE USING (
  tiene_permiso(auth.uid()::uuid, 'facturacion.eliminar')
);

-- ==========================================================================
-- INDICES para optimizar las políticas RLS
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_clientes_usuario_asignado ON clientes(usuario_asignado_id);
CREATE INDEX IF NOT EXISTS idx_tareas_asignado ON tareas(asignado_a_id);
CREATE INDEX IF NOT EXISTS idx_tareas_creado_por ON tareas(creado_por_id);
CREATE INDEX IF NOT EXISTS idx_reuniones_cliente ON reuniones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_campanas_cliente ON campanas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_leads_cliente ON paquetes_leads(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_notas_cliente ON cliente_notas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_historial_cliente ON cliente_historial(cliente_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_menu_order_usuario ON usuarios_menu_order(usuario_id);

-- ==========================================================================
-- FIN DEL SCRIPT RLS COMPLETO
-- ==========================================================================
