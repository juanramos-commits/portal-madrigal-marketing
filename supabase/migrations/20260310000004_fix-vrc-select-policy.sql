-- ==========================================================================
-- FIX: vrc_select policy was changed from ventas_es_admin_o_director() to
-- ventas_tiene_rol(), which broke Super Admin access (they have no row in
-- ventas_roles_comerciales, so ventas_tiene_rol() returns false).
-- Restore original logic: admin/director can see ALL roles.
-- ==========================================================================

DROP POLICY IF EXISTS vrc_select ON ventas_roles_comerciales;
CREATE POLICY vrc_select ON ventas_roles_comerciales FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = (select auth.uid()::uuid)
);
