-- ==========================================================================
-- FIX: RLS auth_rls_initplan performance warnings
-- Wrap auth.uid() with (select ...) so PostgreSQL evaluates it once per
-- query instead of re-evaluating for each row.
-- Also: drop duplicate indexes, merge duplicate permissive policies.
-- ==========================================================================

-- ── 1. Fix ventas helper functions (used in 50+ policies) ───────────────

CREATE OR REPLACE FUNCTION ventas_tiene_rol(p_rol TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID := (select auth.uid()::uuid);
BEGIN
    IF p_rol IS NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM ventas_roles_comerciales
            WHERE usuario_id = v_uid
            AND activo = true
        );
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = v_uid
        AND rol = p_rol
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION ventas_es_admin_o_director()
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID := (select auth.uid()::uuid);
    v_tipo VARCHAR;
BEGIN
    SELECT tipo INTO v_tipo FROM usuarios WHERE id = v_uid;
    IF v_tipo = 'super_admin' THEN RETURN TRUE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = v_uid
        AND rol IN ('super_admin', 'director_ventas')
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION ventas_es_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID := (select auth.uid()::uuid);
    v_tipo VARCHAR;
BEGIN
    SELECT tipo INTO v_tipo FROM usuarios WHERE id = v_uid;
    IF v_tipo = 'super_admin' THEN RETURN TRUE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = v_uid
        AND rol = 'super_admin'
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fix get_user_protected_fields (used in anti-escalation)
-- Must drop dependent policy first, then recreate function
DROP POLICY IF EXISTS usuarios_no_auto_escalation ON usuarios;
DROP FUNCTION IF EXISTS get_user_protected_fields();
CREATE FUNCTION get_user_protected_fields()
RETURNS TABLE(tipo VARCHAR, rol_id UUID, activo BOOLEAN) AS $$
BEGIN
  RETURN QUERY SELECT u.tipo, u.rol_id, u.activo FROM usuarios u WHERE u.id = (select auth.uid()::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── 2. Fix puede_ver_cliente helper (used by clientes_* secondary tables) ─
CREATE OR REPLACE FUNCTION puede_ver_cliente(p_cliente_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM clientes WHERE clientes.id = p_cliente_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── 3. Fix core table policies: clientes ─────────────────────────────────

DROP POLICY IF EXISTS clientes_select ON clientes;
CREATE POLICY clientes_select ON clientes FOR SELECT USING (
  (
    tiene_permiso((select auth.uid()::uuid), 'clientes.ver_lista')
    AND (
      NOT tiene_permiso((select auth.uid()::uuid), 'clientes.ver_solo_asignados')
      OR
      clientes.usuario_asignado_id = (select auth.uid()::uuid)
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = (select auth.uid()::uuid)
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = clientes.id
  )
);

DROP POLICY IF EXISTS clientes_insert ON clientes;
CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'clientes.crear')
);

DROP POLICY IF EXISTS clientes_update ON clientes;
CREATE POLICY clientes_update ON clientes FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'));

DROP POLICY IF EXISTS clientes_delete ON clientes;
CREATE POLICY clientes_delete ON clientes FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'clientes.eliminar')
);

-- ── 4. Fix leads table policies ──────────────────────────────────────────

DROP POLICY IF EXISTS leads_select ON leads;
CREATE POLICY leads_select ON leads FOR SELECT USING (
  (
    tiene_permiso((select auth.uid()::uuid), 'leads.ver')
    AND (
      NOT tiene_permiso((select auth.uid()::uuid), 'leads.ver_solo_asignados')
      OR
      EXISTS (
        SELECT 1 FROM clientes
        WHERE clientes.id = leads.cliente_id
        AND clientes.usuario_asignado_id = (select auth.uid()::uuid)
      )
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = (select auth.uid()::uuid)
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = leads.cliente_id
  )
);

DROP POLICY IF EXISTS leads_insert ON leads;
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'leads.crear')
);

DROP POLICY IF EXISTS leads_update ON leads;
CREATE POLICY leads_update ON leads FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'leads.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'leads.editar'));

DROP POLICY IF EXISTS leads_delete ON leads;
CREATE POLICY leads_delete ON leads FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'leads.eliminar')
);

-- ── 5. Fix usuarios table policies + merge duplicate permissive ──────────

DROP POLICY IF EXISTS usuarios_select ON usuarios;
DROP POLICY IF EXISTS usuarios_select_equipo_comercial ON usuarios;
CREATE POLICY usuarios_select ON usuarios FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.ver')
  OR
  usuarios.id = (select auth.uid()::uuid)
  OR
  -- Equipo comercial: ver usuarios del módulo ventas
  EXISTS (
    SELECT 1 FROM ventas_roles_comerciales vrc
    WHERE vrc.usuario_id = usuarios.id AND vrc.activo = true
    AND EXISTS (
      SELECT 1 FROM ventas_roles_comerciales my_vrc
      WHERE my_vrc.usuario_id = (select auth.uid()::uuid) AND my_vrc.activo = true
    )
  )
);

DROP POLICY IF EXISTS usuarios_insert ON usuarios;
CREATE POLICY usuarios_insert ON usuarios FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.crear')
);

DROP POLICY IF EXISTS usuarios_update ON usuarios;
DROP POLICY IF EXISTS usuarios_no_auto_escalation ON usuarios;
-- Merged permissive + restrictive into one policy with proper anti-escalation
CREATE POLICY usuarios_update ON usuarios FOR UPDATE
  USING (
    tiene_permiso((select auth.uid()::uuid), 'usuarios.editar')
    OR
    usuarios.id = (select auth.uid()::uuid)
  )
  WITH CHECK (
    tiene_permiso((select auth.uid()::uuid), 'usuarios.editar')
    OR
    (
      usuarios.id = (select auth.uid()::uuid)
      AND tipo = (SELECT f.tipo FROM get_user_protected_fields() f)
      AND rol_id IS NOT DISTINCT FROM (SELECT f.rol_id FROM get_user_protected_fields() f)
      AND activo = (SELECT f.activo FROM get_user_protected_fields() f)
    )
  );

DROP POLICY IF EXISTS usuarios_delete ON usuarios;
CREATE POLICY usuarios_delete ON usuarios FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.eliminar')
);

-- ── 6. Fix clientes secondary table policies ─────────────────────────────

-- clientes_facturacion
DROP POLICY IF EXISTS clientes_facturacion_insert ON clientes_facturacion;
CREATE POLICY clientes_facturacion_insert ON clientes_facturacion FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'clientes.editar_facturacion')
);
DROP POLICY IF EXISTS clientes_facturacion_update ON clientes_facturacion;
CREATE POLICY clientes_facturacion_update ON clientes_facturacion FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'clientes.editar_facturacion'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'clientes.editar_facturacion'));
DROP POLICY IF EXISTS clientes_facturacion_delete ON clientes_facturacion;
CREATE POLICY clientes_facturacion_delete ON clientes_facturacion FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'clientes.eliminar')
);

-- clientes_branding
DROP POLICY IF EXISTS clientes_branding_insert ON clientes_branding;
CREATE POLICY clientes_branding_insert ON clientes_branding FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'clientes.editar_branding')
);
DROP POLICY IF EXISTS clientes_branding_update ON clientes_branding;
CREATE POLICY clientes_branding_update ON clientes_branding FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'clientes.editar_branding'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'clientes.editar_branding'));
DROP POLICY IF EXISTS clientes_branding_delete ON clientes_branding;
CREATE POLICY clientes_branding_delete ON clientes_branding FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'clientes.eliminar')
);

-- clientes_urls
DROP POLICY IF EXISTS clientes_urls_insert ON clientes_urls;
CREATE POLICY clientes_urls_insert ON clientes_urls FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'clientes.editar')
);
DROP POLICY IF EXISTS clientes_urls_update ON clientes_urls;
CREATE POLICY clientes_urls_update ON clientes_urls FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'));
DROP POLICY IF EXISTS clientes_urls_delete ON clientes_urls;
CREATE POLICY clientes_urls_delete ON clientes_urls FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'clientes.eliminar')
);

-- clientes_info_adicional
DROP POLICY IF EXISTS clientes_info_adicional_insert ON clientes_info_adicional;
CREATE POLICY clientes_info_adicional_insert ON clientes_info_adicional FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'clientes.editar')
);
DROP POLICY IF EXISTS clientes_info_adicional_update ON clientes_info_adicional;
CREATE POLICY clientes_info_adicional_update ON clientes_info_adicional FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'));
DROP POLICY IF EXISTS clientes_info_adicional_delete ON clientes_info_adicional;
CREATE POLICY clientes_info_adicional_delete ON clientes_info_adicional FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'clientes.eliminar')
);

-- clientes_socios
DROP POLICY IF EXISTS clientes_socios_insert ON clientes_socios;
CREATE POLICY clientes_socios_insert ON clientes_socios FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'clientes.editar')
);
DROP POLICY IF EXISTS clientes_socios_update ON clientes_socios;
CREATE POLICY clientes_socios_update ON clientes_socios FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'clientes.editar'));
DROP POLICY IF EXISTS clientes_socios_delete ON clientes_socios;
CREATE POLICY clientes_socios_delete ON clientes_socios FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'clientes.eliminar')
);

-- ── 7. Fix tareas policies ───────────────────────────────────────────────

DROP POLICY IF EXISTS tareas_select ON tareas;
CREATE POLICY tareas_select ON tareas FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'tareas.ver_todas')
  OR
  (
    tiene_permiso((select auth.uid()::uuid), 'tareas.ver_propias')
    AND (
      tareas.asignado_a_id = (select auth.uid()::uuid)
      OR tareas.creado_por_id = (select auth.uid()::uuid)
    )
  )
);

DROP POLICY IF EXISTS tareas_insert ON tareas;
CREATE POLICY tareas_insert ON tareas FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'tareas.crear')
);

DROP POLICY IF EXISTS tareas_update ON tareas;
CREATE POLICY tareas_update ON tareas FOR UPDATE
  USING (
    tiene_permiso((select auth.uid()::uuid), 'tareas.editar')
    AND (
      tiene_permiso((select auth.uid()::uuid), 'tareas.ver_todas')
      OR tareas.asignado_a_id = (select auth.uid()::uuid)
      OR tareas.creado_por_id = (select auth.uid()::uuid)
    )
  )
  WITH CHECK (
    tiene_permiso((select auth.uid()::uuid), 'tareas.editar')
  );

DROP POLICY IF EXISTS tareas_delete ON tareas;
CREATE POLICY tareas_delete ON tareas FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'tareas.eliminar')
);

-- ── 8. Fix roles/permisos/roles_permisos/usuarios_permisos policies ──────

DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.ver')
);
DROP POLICY IF EXISTS roles_insert ON roles;
CREATE POLICY roles_insert ON roles FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.crear')
);
DROP POLICY IF EXISTS roles_update ON roles;
CREATE POLICY roles_update ON roles FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'usuarios.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'usuarios.editar'));
DROP POLICY IF EXISTS roles_delete ON roles;
CREATE POLICY roles_delete ON roles FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.eliminar')
);

DROP POLICY IF EXISTS permisos_select ON permisos;
CREATE POLICY permisos_select ON permisos FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.ver')
);

DROP POLICY IF EXISTS roles_permisos_select ON roles_permisos;
CREATE POLICY roles_permisos_select ON roles_permisos FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.ver')
);
DROP POLICY IF EXISTS roles_permisos_insert ON roles_permisos;
CREATE POLICY roles_permisos_insert ON roles_permisos FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.editar')
);
DROP POLICY IF EXISTS roles_permisos_delete ON roles_permisos;
CREATE POLICY roles_permisos_delete ON roles_permisos FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.editar')
);

DROP POLICY IF EXISTS usuarios_permisos_select ON usuarios_permisos;
CREATE POLICY usuarios_permisos_select ON usuarios_permisos FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.ver')
);
DROP POLICY IF EXISTS usuarios_permisos_insert ON usuarios_permisos;
CREATE POLICY usuarios_permisos_insert ON usuarios_permisos FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.editar')
);
DROP POLICY IF EXISTS usuarios_permisos_update ON usuarios_permisos;
CREATE POLICY usuarios_permisos_update ON usuarios_permisos FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'usuarios.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'usuarios.editar'));
DROP POLICY IF EXISTS usuarios_permisos_delete ON usuarios_permisos;
CREATE POLICY usuarios_permisos_delete ON usuarios_permisos FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.editar')
);

-- ── 9. Fix reuniones policies ────────────────────────────────────────────

DROP POLICY IF EXISTS reuniones_select ON reuniones;
CREATE POLICY reuniones_select ON reuniones FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'reuniones.ver')
  OR
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = (select auth.uid()::uuid)
    AND usuarios.tipo = 'cliente'
    AND usuarios.cliente_id = reuniones.cliente_id
  )
);
DROP POLICY IF EXISTS reuniones_insert ON reuniones;
CREATE POLICY reuniones_insert ON reuniones FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'reuniones.crear')
);
DROP POLICY IF EXISTS reuniones_update ON reuniones;
CREATE POLICY reuniones_update ON reuniones FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'reuniones.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'reuniones.editar'));
DROP POLICY IF EXISTS reuniones_delete ON reuniones;
CREATE POLICY reuniones_delete ON reuniones FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'reuniones.eliminar')
);

-- ── 10. Fix usuarios_menu_order policies ─────────────────────────────────

DROP POLICY IF EXISTS usuarios_menu_order_select ON usuarios_menu_order;
CREATE POLICY usuarios_menu_order_select ON usuarios_menu_order FOR SELECT USING (
  usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS usuarios_menu_order_insert ON usuarios_menu_order;
CREATE POLICY usuarios_menu_order_insert ON usuarios_menu_order FOR INSERT WITH CHECK (
  usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS usuarios_menu_order_update ON usuarios_menu_order;
CREATE POLICY usuarios_menu_order_update ON usuarios_menu_order FOR UPDATE
  USING (usuario_id = (select auth.uid()::uuid))
  WITH CHECK (usuario_id = (select auth.uid()::uuid));
DROP POLICY IF EXISTS usuarios_menu_order_delete ON usuarios_menu_order;
CREATE POLICY usuarios_menu_order_delete ON usuarios_menu_order FOR DELETE USING (
  usuario_id = (select auth.uid()::uuid)
);

-- ── 11. Fix campanas, facturas policies ──────────────────────────────────

DROP POLICY IF EXISTS campanas_select ON campanas;
CREATE POLICY campanas_select ON campanas FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'campanas.ver')
);
DROP POLICY IF EXISTS campanas_insert ON campanas;
CREATE POLICY campanas_insert ON campanas FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'campanas.crear')
);
DROP POLICY IF EXISTS campanas_update ON campanas;
CREATE POLICY campanas_update ON campanas FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'campanas.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'campanas.editar'));
DROP POLICY IF EXISTS campanas_delete ON campanas;
CREATE POLICY campanas_delete ON campanas FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'campanas.eliminar')
);

DROP POLICY IF EXISTS facturas_select ON facturas;
CREATE POLICY facturas_select ON facturas FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'facturas.ver')
);
DROP POLICY IF EXISTS facturas_insert ON facturas;
CREATE POLICY facturas_insert ON facturas FOR INSERT WITH CHECK (
  tiene_permiso((select auth.uid()::uuid), 'facturas.crear')
);
DROP POLICY IF EXISTS facturas_update ON facturas;
CREATE POLICY facturas_update ON facturas FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'facturas.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'facturas.editar'));
DROP POLICY IF EXISTS facturas_delete ON facturas;
CREATE POLICY facturas_delete ON facturas FOR DELETE USING (
  tiene_permiso((select auth.uid()::uuid), 'facturas.eliminar')
);

-- ── 12. Fix audit_log, rate_limits, security_alerts, login_attempts ──────

DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'auditoria.ver')
);
DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (
  (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS rate_limits_insert ON rate_limits;
CREATE POLICY rate_limits_insert ON rate_limits FOR INSERT WITH CHECK (
  (select auth.uid()) IS NOT NULL OR true
);
DROP POLICY IF EXISTS rate_limits_select ON rate_limits;
CREATE POLICY rate_limits_select ON rate_limits FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'auditoria.ver')
);

DROP POLICY IF EXISTS security_alerts_select ON security_alerts;
CREATE POLICY security_alerts_select ON security_alerts FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'auditoria.ver')
);
DROP POLICY IF EXISTS security_alerts_update ON security_alerts;
CREATE POLICY security_alerts_update ON security_alerts FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'auditoria.ver'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'auditoria.ver'));

DROP POLICY IF EXISTS login_attempts_select ON login_attempts;
CREATE POLICY login_attempts_select ON login_attempts FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'auditoria.ver')
);

-- ── 13. Fix configuracion, notificaciones, sugerencias, etc. ─────────────

DROP POLICY IF EXISTS configuracion_select ON configuracion;
CREATE POLICY configuracion_select ON configuracion FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'ajustes.ver')
);
DROP POLICY IF EXISTS configuracion_update ON configuracion;
CREATE POLICY configuracion_update ON configuracion FOR UPDATE
  USING (tiene_permiso((select auth.uid()::uuid), 'ajustes.editar'))
  WITH CHECK (tiene_permiso((select auth.uid()::uuid), 'ajustes.editar'));

DROP POLICY IF EXISTS notificaciones_select ON notificaciones;
CREATE POLICY notificaciones_select ON notificaciones FOR SELECT USING (
  usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS notificaciones_insert ON notificaciones;
CREATE POLICY notificaciones_insert ON notificaciones FOR INSERT WITH CHECK (
  (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS plantillas_permisos_select ON plantillas_permisos;
CREATE POLICY plantillas_permisos_select ON plantillas_permisos FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'usuarios.ver')
);

DROP POLICY IF EXISTS registro_cambios_select ON registro_cambios;
CREATE POLICY registro_cambios_select ON registro_cambios FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'auditoria.ver')
);

DROP POLICY IF EXISTS sesiones_usuario_select ON sesiones_usuario;
CREATE POLICY sesiones_usuario_select ON sesiones_usuario FOR SELECT USING (
  usuario_id = (select auth.uid()::uuid)
  OR tiene_permiso((select auth.uid()::uuid), 'auditoria.ver')
);
DROP POLICY IF EXISTS sesiones_usuario_insert ON sesiones_usuario;
CREATE POLICY sesiones_usuario_insert ON sesiones_usuario FOR INSERT WITH CHECK (
  (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS sugerencias_select ON sugerencias;
CREATE POLICY sugerencias_select ON sugerencias FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'ajustes.ver')
  OR usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS sugerencias_insert ON sugerencias;
CREATE POLICY sugerencias_insert ON sugerencias FOR INSERT WITH CHECK (
  (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS tarifas_paquetes_select ON tarifas_paquetes;
CREATE POLICY tarifas_paquetes_select ON tarifas_paquetes FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'ajustes.ver')
);

DROP POLICY IF EXISTS webhooks_config_select ON webhooks_config;
CREATE POLICY webhooks_config_select ON webhooks_config FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'ajustes.ver')
);

DROP POLICY IF EXISTS webhooks_log_select ON webhooks_log;
CREATE POLICY webhooks_log_select ON webhooks_log FOR SELECT USING (
  tiene_permiso((select auth.uid()::uuid), 'auditoria.ver')
);

-- ── 14. Fix ventas-specific policies with direct auth.uid() ──────────────

-- ventas_leads: inline auth.uid() in setter/closer checks
DROP POLICY IF EXISTS vl_select ON ventas_leads;
CREATE POLICY vl_select ON ventas_leads FOR SELECT USING (
    ventas_es_admin_o_director()
    OR (ventas_tiene_rol('setter') AND setter_asignado_id = (select auth.uid()::uuid))
    OR (ventas_tiene_rol('closer') AND closer_asignado_id = (select auth.uid()::uuid))
);
DROP POLICY IF EXISTS vl_update ON ventas_leads;
CREATE POLICY vl_update ON ventas_leads FOR UPDATE
    USING (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('setter') AND setter_asignado_id = (select auth.uid()::uuid))
        OR (ventas_tiene_rol('closer') AND closer_asignado_id = (select auth.uid()::uuid))
    )
    WITH CHECK (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('setter') AND setter_asignado_id = (select auth.uid()::uuid))
        OR (ventas_tiene_rol('closer') AND closer_asignado_id = (select auth.uid()::uuid))
    );

-- ventas_citas
DROP POLICY IF EXISTS vcit_select ON ventas_citas;
CREATE POLICY vcit_select ON ventas_citas FOR SELECT USING (
    ventas_es_admin_o_director()
    OR (ventas_tiene_rol('closer') AND closer_id = (select auth.uid()::uuid))
    OR (ventas_tiene_rol('setter') AND EXISTS (
        SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id AND setter_asignado_id = (select auth.uid()::uuid)
    ))
);
DROP POLICY IF EXISTS vcit_update ON ventas_citas;
CREATE POLICY vcit_update ON ventas_citas FOR UPDATE
    USING (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('closer') AND closer_id = (select auth.uid()::uuid))
    )
    WITH CHECK (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('closer') AND closer_id = (select auth.uid()::uuid))
    );

-- ventas_roles_comerciales
DROP POLICY IF EXISTS vrc_select ON ventas_roles_comerciales;
CREATE POLICY vrc_select ON ventas_roles_comerciales FOR SELECT USING (
    ventas_tiene_rol()
    OR usuario_id = (select auth.uid()::uuid)
);

-- ventas_calendario_disponibilidad
DROP POLICY IF EXISTS vcdisp_select ON ventas_calendario_disponibilidad;
CREATE POLICY vcdisp_select ON ventas_calendario_disponibilidad FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS vcdisp_insert ON ventas_calendario_disponibilidad;
CREATE POLICY vcdisp_insert ON ventas_calendario_disponibilidad FOR INSERT WITH CHECK (
    usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director()
);
DROP POLICY IF EXISTS vcdisp_update ON ventas_calendario_disponibilidad;
CREATE POLICY vcdisp_update ON ventas_calendario_disponibilidad FOR UPDATE
    USING (usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director())
    WITH CHECK (usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director());
DROP POLICY IF EXISTS vcdisp_delete ON ventas_calendario_disponibilidad;
CREATE POLICY vcdisp_delete ON ventas_calendario_disponibilidad FOR DELETE USING (
    usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director()
);

-- ventas_calendario_bloqueos
DROP POLICY IF EXISTS vcbloq_select ON ventas_calendario_bloqueos;
CREATE POLICY vcbloq_select ON ventas_calendario_bloqueos FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS vcbloq_insert ON ventas_calendario_bloqueos;
CREATE POLICY vcbloq_insert ON ventas_calendario_bloqueos FOR INSERT WITH CHECK (
    usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director()
);
DROP POLICY IF EXISTS vcbloq_update ON ventas_calendario_bloqueos;
CREATE POLICY vcbloq_update ON ventas_calendario_bloqueos FOR UPDATE
    USING (usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director())
    WITH CHECK (usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director());
DROP POLICY IF EXISTS vcbloq_delete ON ventas_calendario_bloqueos;
CREATE POLICY vcbloq_delete ON ventas_calendario_bloqueos FOR DELETE USING (
    usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director()
);

-- ventas_calendario_config
DROP POLICY IF EXISTS vcconf_select ON ventas_calendario_config;
CREATE POLICY vcconf_select ON ventas_calendario_config FOR SELECT USING (
    usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director()
);
DROP POLICY IF EXISTS vcconf_insert ON ventas_calendario_config;
CREATE POLICY vcconf_insert ON ventas_calendario_config FOR INSERT WITH CHECK (
    usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director()
);
DROP POLICY IF EXISTS vcconf_update ON ventas_calendario_config;
CREATE POLICY vcconf_update ON ventas_calendario_config FOR UPDATE
    USING (usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director())
    WITH CHECK (usuario_id = (select auth.uid()::uuid) OR ventas_es_admin_o_director());

-- ventas_ventas
DROP POLICY IF EXISTS vvt_select ON ventas_ventas;
CREATE POLICY vvt_select ON ventas_ventas FOR SELECT USING (
    ventas_es_admin_o_director()
    OR closer_id = (select auth.uid()::uuid)
    OR setter_id = (select auth.uid()::uuid)
);

-- ventas_comisiones
DROP POLICY IF EXISTS vcom_select ON ventas_comisiones;
CREATE POLICY vcom_select ON ventas_comisiones FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = (select auth.uid()::uuid)
);

-- ventas_wallet
DROP POLICY IF EXISTS vwal_select ON ventas_wallet;
CREATE POLICY vwal_select ON ventas_wallet FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = (select auth.uid()::uuid)
);

-- ventas_retiros
DROP POLICY IF EXISTS vret_select ON ventas_retiros;
CREATE POLICY vret_select ON ventas_retiros FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS vret_insert ON ventas_retiros;
CREATE POLICY vret_insert ON ventas_retiros FOR INSERT WITH CHECK (
    usuario_id = (select auth.uid()::uuid)
);

-- ventas_datos_fiscales
DROP POLICY IF EXISTS vdf_select ON ventas_datos_fiscales;
CREATE POLICY vdf_select ON ventas_datos_fiscales FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS vdf_insert ON ventas_datos_fiscales;
CREATE POLICY vdf_insert ON ventas_datos_fiscales FOR INSERT WITH CHECK (
    usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS vdf_update ON ventas_datos_fiscales;
CREATE POLICY vdf_update ON ventas_datos_fiscales FOR UPDATE
    USING (ventas_es_super_admin() OR usuario_id = (select auth.uid()::uuid))
    WITH CHECK (ventas_es_super_admin() OR usuario_id = (select auth.uid()::uuid));

-- ventas_facturas
DROP POLICY IF EXISTS vfac_select ON ventas_facturas;
CREATE POLICY vfac_select ON ventas_facturas FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = (select auth.uid()::uuid)
);

-- ventas_biblioteca_recursos
DROP POLICY IF EXISTS vbr_select ON ventas_biblioteca_recursos;
CREATE POLICY vbr_select ON ventas_biblioteca_recursos FOR SELECT USING (
    ventas_es_super_admin()
    OR EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = (select auth.uid()::uuid)
        AND activo = true
        AND rol = ANY(ventas_biblioteca_recursos.visible_para)
    )
);

-- ventas_notificaciones
DROP POLICY IF EXISTS vnot_select ON ventas_notificaciones;
CREATE POLICY vnot_select ON ventas_notificaciones FOR SELECT USING (
    usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS vnot_update ON ventas_notificaciones;
CREATE POLICY vnot_update ON ventas_notificaciones FOR UPDATE
    USING (usuario_id = (select auth.uid()::uuid))
    WITH CHECK (usuario_id = (select auth.uid()::uuid));
DROP POLICY IF EXISTS vnot_delete ON ventas_notificaciones;
CREATE POLICY vnot_delete ON ventas_notificaciones FOR DELETE USING (
    usuario_id = (select auth.uid()::uuid)
);

-- dashboard_layouts
DROP POLICY IF EXISTS dl_select ON dashboard_layouts;
CREATE POLICY dl_select ON dashboard_layouts FOR SELECT USING (
    usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS dl_insert ON dashboard_layouts;
CREATE POLICY dl_insert ON dashboard_layouts FOR INSERT WITH CHECK (
    usuario_id = (select auth.uid()::uuid)
);
DROP POLICY IF EXISTS dl_update ON dashboard_layouts;
CREATE POLICY dl_update ON dashboard_layouts FOR UPDATE
    USING (usuario_id = (select auth.uid()::uuid))
    WITH CHECK (usuario_id = (select auth.uid()::uuid));

-- ventas_usuarios_permisos
DROP POLICY IF EXISTS vup_select ON ventas_usuarios_permisos;
CREATE POLICY vup_select ON ventas_usuarios_permisos FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = (select auth.uid()::uuid)
);

-- ventas_google_events
DROP POLICY IF EXISTS vge_select ON ventas_google_events;
CREATE POLICY vge_select ON ventas_google_events FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = (select auth.uid()::uuid)
);

-- ── 15. Drop duplicate indexes ───────────────────────────────────────────

DROP INDEX IF EXISTS idx_historial_cliente;           -- duplicate of idx_cliente_historial_cliente
DROP INDEX IF EXISTS idx_usuarios_menu_order_usuario_id; -- duplicate of idx_usuarios_menu_order_usuario
DROP INDEX IF EXISTS idx_vc_lead_id;                  -- duplicate of idx_vc_lead
DROP INDEX IF EXISTS idx_co_replies_campaign_id;      -- duplicate of idx_co_replies_campaign
DROP INDEX IF EXISTS idx_ventas_leads_telefono;       -- duplicate of idx_vl_telefono
