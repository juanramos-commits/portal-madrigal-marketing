-- Drop the incomplete table and the problematic trigger
-- The trigger was likely added manually and references a table that didn't exist
DROP TABLE IF EXISTS ventas_co_lists CASCADE;

-- Find and drop the trigger that references ventas_co_lists
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'ventas_leads'::regclass
    AND NOT tgisinternal
    AND tgname NOT IN ('trg_em_sync_lead_to_contact', 'trg_em_update_lead_sync', 'set_updated_at_ventas_leads')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON ventas_leads', trig.tgname);
    RAISE NOTICE 'Dropped trigger: %', trig.tgname;
  END LOOP;
END $$;
