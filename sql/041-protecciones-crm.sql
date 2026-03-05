-- ============================================================================
-- 041 - Protecciones CRM: etapas, duplicados, concurrent moves
-- ============================================================================

-- ─── 1. Proteger borrado de etapas con leads ────────────────────────────────
-- No se puede borrar una etapa si tiene leads asignados.
-- Primero mover los leads a otra etapa, luego borrar.

CREATE OR REPLACE FUNCTION trg_fn_proteger_borrado_etapa()
RETURNS TRIGGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM ventas_lead_pipeline
    WHERE etapa_id = OLD.id;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar la etapa "%" porque tiene % lead(s) asignados. Muévelos primero.', OLD.nombre, v_count;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ventas_proteger_borrado_etapa ON ventas_etapas;
CREATE TRIGGER trg_ventas_proteger_borrado_etapa
    BEFORE DELETE ON ventas_etapas
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_proteger_borrado_etapa();


-- ─── 2. Función para detectar leads duplicados ─────────────────────────────
-- Busca leads con mismo email o teléfono. Devuelve array de posibles duplicados.

CREATE OR REPLACE FUNCTION ventas_buscar_duplicados(
    p_email TEXT DEFAULT NULL,
    p_telefono TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_duplicados JSONB;
BEGIN
    -- Limpiar inputs
    p_email := NULLIF(TRIM(COALESCE(p_email, '')), '');
    p_telefono := NULLIF(TRIM(COALESCE(p_telefono, '')), '');

    IF p_email IS NULL AND p_telefono IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', l.id,
        'nombre', l.nombre,
        'email', l.email,
        'telefono', l.telefono,
        'created_at', l.created_at,
        'match_tipo', CASE
            WHEN p_email IS NOT NULL AND l.email = p_email AND p_telefono IS NOT NULL AND l.telefono = p_telefono THEN 'email_y_telefono'
            WHEN p_email IS NOT NULL AND l.email = p_email THEN 'email'
            WHEN p_telefono IS NOT NULL AND l.telefono = p_telefono THEN 'telefono'
        END
    )), '[]'::jsonb)
    INTO v_duplicados
    FROM ventas_leads l
    WHERE (p_email IS NOT NULL AND l.email = p_email)
       OR (p_telefono IS NOT NULL AND l.telefono = p_telefono);

    RETURN v_duplicados;
END;
$$;

GRANT EXECUTE ON FUNCTION ventas_buscar_duplicados(TEXT, TEXT) TO authenticated;


-- ─── 3. Proteger eliminar lead — solo super_admin ───────────────────────────
-- RLS ya controla esto, pero añadimos una función explícita por seguridad.

CREATE OR REPLACE FUNCTION ventas_eliminar_lead(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede eliminar leads');
    END IF;

    -- Verificar que no tiene ventas aprobadas
    IF EXISTS (SELECT 1 FROM ventas_ventas WHERE lead_id = p_lead_id AND estado = 'aprobada' AND es_devolucion = false) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No se puede eliminar un lead con ventas aprobadas');
    END IF;

    DELETE FROM ventas_leads WHERE id = p_lead_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Lead no encontrado');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION ventas_eliminar_lead(UUID) TO authenticated;


-- ─── 4. Optimistic locking para moves concurrentes ──────────────────────────
-- Añadir columna version para detectar conflictos

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ventas_lead_pipeline' AND column_name = 'version'
    ) THEN
        ALTER TABLE ventas_lead_pipeline ADD COLUMN version INTEGER DEFAULT 0;
    END IF;
END $$;

-- Función que incrementa version en cada update
CREATE OR REPLACE FUNCTION trg_fn_lead_pipeline_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version := COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ventas_lead_pipeline_version ON ventas_lead_pipeline;
CREATE TRIGGER trg_ventas_lead_pipeline_version
    BEFORE UPDATE ON ventas_lead_pipeline
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_lead_pipeline_version();
