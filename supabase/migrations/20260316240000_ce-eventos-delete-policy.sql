-- Allow deletion of ce_eventos for users with cold_email.envios.ver permission
CREATE POLICY ce_eventos_delete ON ce_eventos FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.envios.ver'));

-- Also add ON DELETE CASCADE to ce_eventos.contacto_id FK
-- so deleting a contact cleans up its eventos automatically
ALTER TABLE ce_eventos DROP CONSTRAINT IF EXISTS ce_eventos_contacto_id_fkey;
ALTER TABLE ce_eventos ADD CONSTRAINT ce_eventos_contacto_id_fkey
  FOREIGN KEY (contacto_id) REFERENCES ce_contactos(id) ON DELETE CASCADE;

-- Same for ce_envios.contacto_id
ALTER TABLE ce_envios DROP CONSTRAINT IF EXISTS ce_envios_contacto_id_fkey;
ALTER TABLE ce_envios ADD CONSTRAINT ce_envios_contacto_id_fkey
  FOREIGN KEY (contacto_id) REFERENCES ce_contactos(id) ON DELETE CASCADE;

-- And ce_enrollments.contacto_id
ALTER TABLE ce_enrollments DROP CONSTRAINT IF EXISTS ce_enrollments_contacto_id_fkey;
ALTER TABLE ce_enrollments ADD CONSTRAINT ce_enrollments_contacto_id_fkey
  FOREIGN KEY (contacto_id) REFERENCES ce_contactos(id) ON DELETE CASCADE;
