-- Add explicit UNIQUE constraint on email (required for PostgREST upsert)
-- The expression index on lower(email) exists but PostgREST needs a named constraint
ALTER TABLE ce_contactos ADD CONSTRAINT ce_contactos_email_unique UNIQUE (email);
