-- Fix cold email permissions modulo to match UI key format
-- (was 'Cold Email', needs to be 'cold_email' to match AjustesPermisos.jsx MODULO_LABELS)
UPDATE permisos
SET modulo = 'cold_email',
    orden = CASE codigo
      WHEN 'cold_email.ver' THEN 600
      WHEN 'cold_email.contactos.ver' THEN 601
      WHEN 'cold_email.contactos.editar' THEN 602
      WHEN 'cold_email.secuencias.ver' THEN 603
      WHEN 'cold_email.secuencias.editar' THEN 604
      WHEN 'cold_email.envios.ver' THEN 605
      WHEN 'cold_email.respuestas.ver' THEN 606
      WHEN 'cold_email.respuestas.clasificar' THEN 607
      WHEN 'cold_email.plantillas.ver' THEN 608
      WHEN 'cold_email.plantillas.editar' THEN 609
      WHEN 'cold_email.config.ver' THEN 610
      WHEN 'cold_email.config.editar' THEN 611
      ELSE orden
    END
WHERE codigo LIKE 'cold_email.%';
