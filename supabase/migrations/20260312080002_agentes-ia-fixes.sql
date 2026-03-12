-- =====================================================
-- Agentes IA — Fixes & missing features
-- =====================================================

-- 1. Add processing_lock_at column for race condition prevention
ALTER TABLE ia_conversaciones
  ADD COLUMN IF NOT EXISTS processing_lock_at TIMESTAMPTZ DEFAULT NULL;

-- 2. RPC: Atomic processing lock acquisition
CREATE OR REPLACE FUNCTION ia_acquire_processing_lock(
  p_conversacion_id UUID,
  p_lock_timeout_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE ia_conversaciones
  SET processing_lock_at = NOW()
  WHERE id = p_conversacion_id
    AND (processing_lock_at IS NULL OR processing_lock_at < NOW() - (p_lock_timeout_seconds || ' seconds')::INTERVAL)
  RETURNING TRUE INTO v_updated;

  RETURN COALESCE(v_updated, FALSE);
END;
$$;

-- 3. Fix RLS policies that use 'ver' for ALL operations (should use 'editar')
DO $$ BEGIN
  DROP POLICY IF EXISTS ia_metricas_all ON ia_metricas_diarias;
  CREATE POLICY ia_metricas_all ON ia_metricas_diarias
    FOR ALL USING (tiene_permiso(auth.uid(), 'ventas.agentes_ia.editar'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS ia_costes_all ON ia_costes;
  CREATE POLICY ia_costes_all ON ia_costes
    FOR ALL USING (tiene_permiso(auth.uid(), 'ventas.agentes_ia.editar'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS ia_alertas_all ON ia_alertas_supervisor;
  CREATE POLICY ia_alertas_all ON ia_alertas_supervisor
    FOR ALL USING (tiene_permiso(auth.uid(), 'ventas.agentes_ia.editar'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Keep SELECT policies for viewers
DO $$ BEGIN
  DROP POLICY IF EXISTS ia_metricas_select ON ia_metricas_diarias;
  CREATE POLICY ia_metricas_select ON ia_metricas_diarias
    FOR SELECT USING (tiene_permiso(auth.uid(), 'ventas.agentes_ia.ver'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS ia_costes_select ON ia_costes;
  CREATE POLICY ia_costes_select ON ia_costes
    FOR SELECT USING (tiene_permiso(auth.uid(), 'ventas.agentes_ia.ver'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS ia_alertas_select ON ia_alertas_supervisor;
  CREATE POLICY ia_alertas_select ON ia_alertas_supervisor
    FOR SELECT USING (tiene_permiso(auth.uid(), 'ventas.agentes_ia.ver'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Add 'derivacion_urgente', 'derivacion_humano', 'wa_quality_warning', 'wa_quality_critical'
-- to ia_alertas_supervisor tipo CHECK constraint
ALTER TABLE ia_alertas_supervisor DROP CONSTRAINT IF EXISTS ia_alertas_supervisor_tipo_check;
ALTER TABLE ia_alertas_supervisor ADD CONSTRAINT ia_alertas_supervisor_tipo_check
  CHECK (tipo IN (
    'lead_caliente_sin_respuesta', 'sentimiento_negativo', 'bot_bloqueado',
    'calidad_baja', 'error', 'wa_quality_warning', 'wa_quality_critical',
    'derivacion_urgente', 'derivacion_humano'
  ));

-- 5. Add 'whatsapp' as valid origen for ia_leads
ALTER TABLE ia_leads DROP CONSTRAINT IF EXISTS ia_leads_origen_check;
ALTER TABLE ia_leads ADD CONSTRAINT ia_leads_origen_check
  CHECK (origen IN ('formulario', 'importado', 'manual', 'crm', 'whatsapp'));

-- 6. Insert permissions for agentes IA if they don't exist
INSERT INTO permisos (id, codigo, modulo, nombre, descripcion, orden)
VALUES
  (gen_random_uuid(), 'ventas.agentes_ia.ver',     'ventas_agentes_ia', 'Ver Agentes IA',    'Acceso al módulo de Agentes IA',        600),
  (gen_random_uuid(), 'ventas.agentes_ia.crear',    'ventas_agentes_ia', 'Crear agentes',     'Crear y configurar agentes de IA',      601),
  (gen_random_uuid(), 'ventas.agentes_ia.editar',   'ventas_agentes_ia', 'Editar agentes',    'Editar configuración de agentes',       602),
  (gen_random_uuid(), 'ventas.agentes_ia.eliminar',  'ventas_agentes_ia', 'Eliminar agentes',  'Eliminar agentes de IA',                603),
  (gen_random_uuid(), 'ventas.agentes_ia.ejecutar',  'ventas_agentes_ia', 'Ejecutar agentes',  'Lanzar y detener ejecución de agentes', 604)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  modulo = EXCLUDED.modulo,
  orden = EXCLUDED.orden;

-- 7. Grant all IA permissions to super_admin role
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'super_admin'
  AND p.codigo LIKE 'ventas.agentes_ia.%'
ON CONFLICT DO NOTHING;

-- 8. Add index for processing lock queries
CREATE INDEX IF NOT EXISTS idx_ia_conv_processing_lock
  ON ia_conversaciones (id)
  WHERE processing_lock_at IS NOT NULL;

-- 9. Add 'failed' to wa_status CHECK (for tracking failed deliveries)
ALTER TABLE ia_mensajes DROP CONSTRAINT IF EXISTS ia_mensajes_wa_status_check;
ALTER TABLE ia_mensajes ADD CONSTRAINT ia_mensajes_wa_status_check
  CHECK (wa_status IS NULL OR wa_status IN ('sent', 'delivered', 'read', 'failed'));
