-- Add ON DELETE CASCADE to ce_respuestas.contacto_id FK
ALTER TABLE ce_respuestas DROP CONSTRAINT IF EXISTS ce_respuestas_contacto_id_fkey;
ALTER TABLE ce_respuestas ADD CONSTRAINT ce_respuestas_contacto_id_fkey
  FOREIGN KEY (contacto_id) REFERENCES ce_contactos(id) ON DELETE CASCADE;

-- Also cascade envio_id and enrollment_id
ALTER TABLE ce_respuestas DROP CONSTRAINT IF EXISTS ce_respuestas_envio_id_fkey;
ALTER TABLE ce_respuestas ADD CONSTRAINT ce_respuestas_envio_id_fkey
  FOREIGN KEY (envio_id) REFERENCES ce_envios(id) ON DELETE CASCADE;

ALTER TABLE ce_respuestas DROP CONSTRAINT IF EXISTS ce_respuestas_enrollment_id_fkey;
ALTER TABLE ce_respuestas ADD CONSTRAINT ce_respuestas_enrollment_id_fkey
  FOREIGN KEY (enrollment_id) REFERENCES ce_enrollments(id) ON DELETE CASCADE;
