-- ============================================================================
-- Cold Email RLS Policies
-- ============================================================================

-- ce_cuentas
CREATE POLICY ce_cuentas_select ON ce_cuentas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.config.ver'));
CREATE POLICY ce_cuentas_insert ON ce_cuentas FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'cold_email.config.editar'));
CREATE POLICY ce_cuentas_update ON ce_cuentas FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.config.editar'));
CREATE POLICY ce_cuentas_delete ON ce_cuentas FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.config.editar'));

-- ce_contactos
CREATE POLICY ce_contactos_select ON ce_contactos FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.ver'));
CREATE POLICY ce_contactos_insert ON ce_contactos FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.editar'));
CREATE POLICY ce_contactos_update ON ce_contactos FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.editar'));
CREATE POLICY ce_contactos_delete ON ce_contactos FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.editar'));

-- ce_listas
CREATE POLICY ce_listas_select ON ce_listas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.ver'));
CREATE POLICY ce_listas_all ON ce_listas FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.editar'));

-- ce_contactos_listas
CREATE POLICY ce_contactos_listas_select ON ce_contactos_listas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.ver'));
CREATE POLICY ce_contactos_listas_all ON ce_contactos_listas FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.contactos.editar'));

-- ce_plantillas
CREATE POLICY ce_plantillas_select ON ce_plantillas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.plantillas.ver'));
CREATE POLICY ce_plantillas_insert ON ce_plantillas FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'cold_email.plantillas.editar'));
CREATE POLICY ce_plantillas_update ON ce_plantillas FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.plantillas.editar'));
CREATE POLICY ce_plantillas_delete ON ce_plantillas FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.plantillas.editar'));

-- ce_secuencias
CREATE POLICY ce_secuencias_select ON ce_secuencias FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.ver'));
CREATE POLICY ce_secuencias_insert ON ce_secuencias FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));
CREATE POLICY ce_secuencias_update ON ce_secuencias FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));
CREATE POLICY ce_secuencias_delete ON ce_secuencias FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));

-- ce_secuencias_cuentas
CREATE POLICY ce_secuencias_cuentas_select ON ce_secuencias_cuentas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.ver'));
CREATE POLICY ce_secuencias_cuentas_all ON ce_secuencias_cuentas FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));

-- ce_pasos
CREATE POLICY ce_pasos_select ON ce_pasos FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.ver'));
CREATE POLICY ce_pasos_insert ON ce_pasos FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));
CREATE POLICY ce_pasos_update ON ce_pasos FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));
CREATE POLICY ce_pasos_delete ON ce_pasos FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));

-- ce_enrollments
CREATE POLICY ce_enrollments_select ON ce_enrollments FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.ver'));
CREATE POLICY ce_enrollments_all ON ce_enrollments FOR ALL
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.secuencias.editar'));

-- ce_envios
CREATE POLICY ce_envios_select ON ce_envios FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.envios.ver'));

-- ce_eventos
CREATE POLICY ce_eventos_select ON ce_eventos FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.envios.ver'));

-- ce_respuestas
CREATE POLICY ce_respuestas_select ON ce_respuestas FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.respuestas.ver'));
CREATE POLICY ce_respuestas_update ON ce_respuestas FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.respuestas.clasificar'));

-- ce_blacklist
CREATE POLICY ce_blacklist_select ON ce_blacklist FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.config.ver'));
CREATE POLICY ce_blacklist_insert ON ce_blacklist FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'cold_email.config.editar'));
CREATE POLICY ce_blacklist_delete ON ce_blacklist FOR DELETE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.config.editar'));

-- ce_config
CREATE POLICY ce_config_select ON ce_config FOR SELECT
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.config.ver'));
CREATE POLICY ce_config_insert ON ce_config FOR INSERT
  WITH CHECK (tiene_permiso((SELECT auth.uid()), 'cold_email.config.editar'));
CREATE POLICY ce_config_update ON ce_config FOR UPDATE
  USING (tiene_permiso((SELECT auth.uid()), 'cold_email.config.editar'));
