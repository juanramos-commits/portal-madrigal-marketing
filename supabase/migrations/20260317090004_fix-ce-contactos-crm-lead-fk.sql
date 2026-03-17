-- Fix: set crm_lead_id to NULL when lead is deleted instead of blocking
ALTER TABLE ce_contactos DROP CONSTRAINT IF EXISTS ce_contactos_crm_lead_id_fkey;
ALTER TABLE ce_contactos ADD CONSTRAINT ce_contactos_crm_lead_id_fkey
  FOREIGN KEY (crm_lead_id) REFERENCES ventas_leads(id) ON DELETE SET NULL;

-- Same for ce_respuestas.crm_lead_id
ALTER TABLE ce_respuestas DROP CONSTRAINT IF EXISTS ce_respuestas_crm_lead_id_fkey;
ALTER TABLE ce_respuestas ADD CONSTRAINT ce_respuestas_crm_lead_id_fkey
  FOREIGN KEY (crm_lead_id) REFERENCES ventas_leads(id) ON DELETE SET NULL;
