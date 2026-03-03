-- ============================================================================
-- 021: Fix ventas_actividad.lead_id — permitir NULL
-- ============================================================================
-- Problema: ventas_ventas.lead_id es nullable (ON DELETE SET NULL), pero
-- ventas_actividad.lead_id es NOT NULL. Cuando una venta no tiene lead
-- (borrado o no asignado), las RPCs de aprobar/rechazar/devolucion fallan
-- con: "null value in column lead_id violates not-null constraint".
--
-- Afecta a: ventas_aprobar_venta, ventas_rechazar_venta,
--           ventas_marcar_devolucion, ventas_revertir_rechazo,
--           ventas_revertir_devolucion
-- ============================================================================

-- 1. Hacer lead_id nullable
ALTER TABLE ventas_actividad ALTER COLUMN lead_id DROP NOT NULL;

-- 2. Actualizar policy RLS de SELECT para aceptar lead_id NULL
-- (actividades sin lead son visibles para cualquier usuario con rol comercial)
DROP POLICY IF EXISTS vact_select ON ventas_actividad;
CREATE POLICY vact_select ON ventas_actividad FOR SELECT USING (
    lead_id IS NULL
    OR EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id)
);
