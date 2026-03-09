-- ============================================================================
-- 053 - Cold Outreach: Sync CRM Leads → Outreach Contacts
-- Crea triggers para sincronizar automáticamente los leads del CRM
-- (ventas_leads) con los contactos de Cold Outreach (ventas_co_contacts).
-- También inserta el dominio mail.madrigalmarketing.es como dominio activo.
-- ============================================================================


-- ─── 0. Ampliar CHECK constraint de source para incluir 'crm_sync' ──────────

ALTER TABLE ventas_co_lists DROP CONSTRAINT IF EXISTS ventas_co_lists_source_check;
ALTER TABLE ventas_co_lists ADD CONSTRAINT ventas_co_lists_source_check
  CHECK (source IN ('import', 'manual', 'scrape', 'api', 'crm_sync'));


-- ─── 1. Trigger: Auto-crear contacto outreach cuando se crea un lead ────────

CREATE OR REPLACE FUNCTION trg_fn_co_sync_lead_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo si el lead tiene email
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) != '' THEN
    -- Crear una lista "CRM - Importación automática" si no existe
    INSERT INTO ventas_co_lists (id, name, description, source)
    VALUES (
      '00000000-0000-0000-0000-000000000001'::UUID,
      'CRM - Leads automáticos',
      'Contactos importados automáticamente desde el CRM de ventas',
      'crm_sync'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insertar contacto en la lista automática
    INSERT INTO ventas_co_contacts (
      id, list_id, email, first_name, last_name, company,
      phone, custom_fields, status, email_verified
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000001'::UUID,
      LOWER(TRIM(NEW.email)),
      SPLIT_PART(COALESCE(NEW.nombre, ''), ' ', 1),
      CASE
        WHEN POSITION(' ' IN COALESCE(NEW.nombre, '')) > 0
        THEN SUBSTRING(NEW.nombre FROM POSITION(' ' IN NEW.nombre) + 1)
        ELSE NULL
      END,
      NEW.nombre_negocio,
      NEW.telefono,
      JSONB_BUILD_OBJECT(
        'lead_id', NEW.id,
        'fuente', COALESCE(NEW.fuente, ''),
        'valor', COALESCE(NEW.valor, 0)
      ),
      'new',
      false
    )
    ON CONFLICT (list_id, email) DO NOTHING;

    -- Incrementar contador de la lista
    UPDATE ventas_co_lists
    SET total_contacts = (
      SELECT COUNT(*) FROM ventas_co_contacts
      WHERE list_id = '00000000-0000-0000-0000-000000000001'::UUID
    )
    WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_sync_lead_to_contact'
  ) THEN
    CREATE TRIGGER trg_co_sync_lead_to_contact
      AFTER INSERT ON ventas_leads
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_co_sync_lead_to_contact();
  END IF;
END;
$$;


-- ─── 2. Trigger: Sincronizar cambios de lead a contacto outreach ────────────

CREATE OR REPLACE FUNCTION trg_fn_co_update_lead_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo si cambió email, nombre, negocio o teléfono
  IF (OLD.email IS DISTINCT FROM NEW.email)
     OR (OLD.nombre IS DISTINCT FROM NEW.nombre)
     OR (OLD.nombre_negocio IS DISTINCT FROM NEW.nombre_negocio)
     OR (OLD.telefono IS DISTINCT FROM NEW.telefono)
  THEN
    UPDATE ventas_co_contacts
    SET
      email = LOWER(TRIM(COALESCE(NEW.email, email))),
      first_name = SPLIT_PART(COALESCE(NEW.nombre, ''), ' ', 1),
      last_name = CASE
        WHEN POSITION(' ' IN COALESCE(NEW.nombre, '')) > 0
        THEN SUBSTRING(NEW.nombre FROM POSITION(' ' IN NEW.nombre) + 1)
        ELSE last_name
      END,
      company = COALESCE(NEW.nombre_negocio, company),
      phone = COALESCE(NEW.telefono, phone),
      custom_fields = custom_fields || JSONB_BUILD_OBJECT(
        'lead_id', NEW.id,
        'fuente', COALESCE(NEW.fuente, ''),
        'valor', COALESCE(NEW.valor, 0)
      ),
      updated_at = NOW()
    WHERE custom_fields->>'lead_id' = NEW.id::TEXT
       OR (list_id = '00000000-0000-0000-0000-000000000001'::UUID
           AND email = LOWER(TRIM(OLD.email)));
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_co_update_lead_sync'
  ) THEN
    CREATE TRIGGER trg_co_update_lead_sync
      AFTER UPDATE ON ventas_leads
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_co_update_lead_sync();
  END IF;
END;
$$;


-- ─── 3. Sync masivo: importar todos los leads existentes con email ──────────

-- Asegurar que la lista CRM existe
INSERT INTO ventas_co_lists (id, name, description, source, total_contacts)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'CRM - Leads automáticos',
  'Contactos importados automáticamente desde el CRM de ventas',
  'crm_sync',
  0
)
ON CONFLICT (id) DO NOTHING;

-- Importar todos los leads existentes que tengan email
INSERT INTO ventas_co_contacts (
  id, list_id, email, first_name, last_name, company,
  phone, custom_fields, status, email_verified, created_at
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::UUID,
  LOWER(TRIM(vl.email)),
  SPLIT_PART(COALESCE(vl.nombre, ''), ' ', 1),
  CASE
    WHEN POSITION(' ' IN COALESCE(vl.nombre, '')) > 0
    THEN SUBSTRING(vl.nombre FROM POSITION(' ' IN vl.nombre) + 1)
    ELSE NULL
  END,
  vl.nombre_negocio,
  vl.telefono,
  JSONB_BUILD_OBJECT(
    'lead_id', vl.id,
    'fuente', COALESCE(vl.fuente, ''),
    'valor', COALESCE(vl.valor, 0)
  ),
  'new',
  false,
  vl.created_at
FROM ventas_leads vl
WHERE vl.email IS NOT NULL
  AND TRIM(vl.email) != ''
ON CONFLICT (list_id, email) DO NOTHING;

-- Actualizar contador de la lista
UPDATE ventas_co_lists
SET total_contacts = (
  SELECT COUNT(*) FROM ventas_co_contacts
  WHERE list_id = '00000000-0000-0000-0000-000000000001'::UUID
)
WHERE id = '00000000-0000-0000-0000-000000000001'::UUID;


-- ─── 4. Insertar dominio mail.madrigalmarketing.es ──────────────────────────

INSERT INTO ventas_co_domains (
  id, domain, status, provider, daily_limit, warmup_day,
  warmup_completed, health_score, notes
) VALUES (
  gen_random_uuid(),
  'mail.madrigalmarketing.es',
  'active',
  'resend',
  50,
  0,
  false,
  100,
  'Dominio principal de cold outreach configurado en Resend'
)
ON CONFLICT (domain) DO NOTHING;


-- ─── 5. Insertar inbox principal ────────────────────────────────────────────

INSERT INTO ventas_co_inboxes (
  id, domain_id, email, display_name, daily_limit, is_active, warmup_mode
)
SELECT
  gen_random_uuid(),
  d.id,
  'hola@mail.madrigalmarketing.es',
  'Madrigal Marketing',
  30,
  true,
  true
FROM ventas_co_domains d
WHERE d.domain = 'mail.madrigalmarketing.es'
ON CONFLICT (email) DO NOTHING;


-- ============================================================================
-- FIN 053
-- ============================================================================
