-- Add categoria and zona columns to ce_contactos
ALTER TABLE ce_contactos ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE ce_contactos ADD COLUMN IF NOT EXISTS zona TEXT;
