-- ============================================================================
-- 049 - Email Marketing: Automaciones predefinidas
-- 10 secuencias de automatización para agencia de marketing, cada una con
-- sus pasos (send_email, wait, condition, exit).
-- ============================================================================


-- ─── 1. Bienvenida Nuevo Lead ─────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Bienvenida Nuevo Lead',
            'Secuencia de bienvenida cuando se crea un nuevo lead. Envía email de bienvenida, servicios y caso de éxito.',
            'lead_created',
            '{"event":"lead_created"}'::JSONB,
            'draft', 5, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'send_email',
         '{"template_name":"Bienvenida Nuevo Lead","subject":"¡Bienvenido/a a Madrigal Marketing!"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'wait',
         '{"wait_days":1}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'send_email',
         '{"template_name":"Servicios Overview","subject":"Conoce nuestros servicios de marketing digital"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'wait',
         '{"wait_days":2}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 5, 'send_email',
         '{"template_name":"Caso de Éxito","subject":"Cómo ayudamos a [cliente] a crecer un 300%"}'::JSONB, now());
END;
$$;


-- ─── 2. Seguimiento Propuesta ─────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Seguimiento Propuesta',
            'Seguimiento automático después de enviar una propuesta comercial.',
            'proposal_sent',
            '{"event":"proposal_sent"}'::JSONB,
            'draft', 6, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'wait',
         '{"wait_days":3}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'send_email',
         '{"template_name":"Seguimiento Propuesta","subject":"¿Has tenido oportunidad de revisar nuestra propuesta?"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'wait',
         '{"wait_days":4}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'send_email',
         '{"template_name":"Follow-up Propuesta","subject":"Seguimos disponibles para resolver tus dudas"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 5, 'wait',
         '{"wait_days":7}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 6, 'send_email',
         '{"template_name":"Última Oportunidad","subject":"Última oportunidad: tu propuesta personalizada"}'::JSONB, now());
END;
$$;


-- ─── 3. Onboarding Cliente ────────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Onboarding Cliente',
            'Secuencia de onboarding cuando un lead se convierte en cliente.',
            'lead_converted',
            '{"event":"lead_converted"}'::JSONB,
            'draft', 7, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'send_email',
         '{"template_name":"Felicitaciones","subject":"¡Bienvenido como cliente de Madrigal Marketing!"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'wait',
         '{"wait_days":1}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'send_email',
         '{"template_name":"Guía Onboarding","subject":"Tu guía de onboarding — primeros pasos"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'wait',
         '{"wait_days":3}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 5, 'send_email',
         '{"template_name":"Tips Iniciales","subject":"5 tips para sacar el máximo a tu inversión"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 6, 'wait',
         '{"wait_days":7}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 7, 'send_email',
         '{"template_name":"Check-in","subject":"¿Cómo va todo? Tu primer check-in"}'::JSONB, now());
END;
$$;


-- ─── 4. Re-engagement Inactivo ────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Re-engagement Inactivo',
            'Intenta re-activar contactos que llevan 30 días sin interacción.',
            'inactive_30d',
            '{"event":"inactive_30d","condition":"last_opened_at < now() - interval ''30 days''"}'::JSONB,
            'draft', 6, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'send_email',
         '{"template_name":"Te Echamos de Menos","subject":"Te echamos de menos — ¿sigues ahí?"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'wait',
         '{"wait_days":5}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'condition',
         '{"field":"total_opened","operator":"gt","value":"0","then":"exit"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'send_email',
         '{"template_name":"Oferta Especial","subject":"Una oferta exclusiva para ti"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 5, 'wait',
         '{"wait_days":7}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 6, 'send_email',
         '{"template_name":"Último Intento","subject":"Último mensaje — ¿nos damos otra oportunidad?"}'::JSONB, now());
END;
$$;


-- ─── 5. Prevención Churn ──────────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Prevención Churn',
            'Secuencia para retener clientes con engagement bajo.',
            'low_engagement',
            '{"event":"low_engagement","condition":"engagement_score < 30"}'::JSONB,
            'draft', 6, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'send_email',
         '{"template_name":"Recordatorio de Valor","subject":"Lo que estás consiguiendo con nosotros"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'wait',
         '{"wait_days":3}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'send_email',
         '{"template_name":"Historias de Éxito","subject":"Historias de éxito de clientes como tú"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'wait',
         '{"wait_days":5}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 5, 'condition',
         '{"field":"engagement_score","operator":"gte","value":"50","then":"exit"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 6, 'send_email',
         '{"template_name":"Contacto Personal","subject":"¿Hablamos? Tu account manager quiere ayudarte"}'::JSONB, now());
END;
$$;


-- ─── 6. Win-back Ex-cliente ───────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Win-back Ex-cliente',
            'Secuencia para recuperar ex-clientes 60 días después de expirar contrato.',
            'contract_expired_60d',
            '{"event":"contract_expired_60d","delay_days":60}'::JSONB,
            'draft', 6, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'wait',
         '{"wait_days":7}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'send_email',
         '{"template_name":"Novedades","subject":"Mira lo que hay de nuevo en Madrigal Marketing"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'wait',
         '{"wait_days":14}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'send_email',
         '{"template_name":"Oferta Retorno","subject":"Oferta especial de regreso — solo para ti"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 5, 'wait',
         '{"wait_days":21}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 6, 'send_email',
         '{"template_name":"Último Contacto","subject":"¿Nos das otra oportunidad?"}'::JSONB, now());
END;
$$;


-- ─── 7. Nurture Lead Frío ────────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Nurture Lead Frío',
            'Secuencia de nurturing para leads fríos con contenido educativo.',
            'cold_lead',
            '{"event":"cold_lead","condition":"engagement_score < 20"}'::JSONB,
            'draft', 8, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'send_email',
         '{"template_name":"Contenido Educativo","subject":"Guía gratuita: Marketing digital para tu negocio"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'wait',
         '{"wait_days":5}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'send_email',
         '{"template_name":"Caso de Estudio","subject":"Caso de estudio: resultados reales con datos reales"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'wait',
         '{"wait_days":7}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 5, 'send_email',
         '{"template_name":"Highlight Servicio","subject":"¿Conoces nuestro servicio de [servicio]?"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 6, 'wait',
         '{"wait_days":10}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 7, 'condition',
         '{"field":"engagement_score","operator":"gte","value":"40","then":"exit"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 8, 'send_email',
         '{"template_name":"Nurture Final","subject":"Último recurso educativo antes de despedirnos"}'::JSONB, now());
END;
$$;


-- ─── 8. NPS Post-servicio ─────────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'NPS Post-servicio',
            'Encuesta NPS 30 días después de completar un servicio.',
            'service_completed',
            '{"event":"service_completed"}'::JSONB,
            'draft', 4, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'wait',
         '{"wait_days":30}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'send_email',
         '{"template_name":"Encuesta NPS","subject":"¿Cómo fue tu experiencia? Tu opinión importa"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'wait',
         '{"wait_days":7}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 4, 'send_email',
         '{"template_name":"Recordatorio NPS","subject":"Recordatorio: tu opinión nos ayuda a mejorar"}'::JSONB, now());
END;
$$;


-- ─── 9. Cumpleaños Contrato ───────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Cumpleaños Contrato',
            'Celebración del aniversario del contrato con resumen de resultados.',
            'contract_anniversary',
            '{"event":"contract_anniversary"}'::JSONB,
            'draft', 3, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'send_email',
         '{"template_name":"Aniversario","subject":"🎉 ¡Feliz aniversario! Un año creciendo juntos"}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 2, 'wait',
         '{"wait_days":3}'::JSONB, now()),
        (gen_random_uuid(), v_auto_id, 3, 'send_email',
         '{"template_name":"Oferta Renovación","subject":"Oferta especial de renovación para celebrar"}'::JSONB, now());
END;
$$;


-- ─── 10. Newsletter Mensual ──────────────────────────────────────────────────

DO $$
DECLARE v_auto_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO ventas_em_automations (id, name, description, trigger_type, trigger_config, status, steps_count, created_at)
    VALUES (v_auto_id,
            'Newsletter Mensual',
            'Envío automático del newsletter mensual a todos los suscriptores activos.',
            'cron_monthly',
            '{"event":"cron_monthly","schedule":"0 10 1 * *","description":"Primer día de cada mes a las 10:00"}'::JSONB,
            'draft', 1, now());

    INSERT INTO ventas_em_automation_steps (id, automation_id, step_order, type, config, created_at) VALUES
        (gen_random_uuid(), v_auto_id, 1, 'send_email',
         '{"template_name":"Newsletter Mensual","subject":"Newsletter {{mes}} — Novedades de Madrigal Marketing"}'::JSONB, now());
END;
$$;


-- ============================================================================
-- FIN 049
-- ============================================================================
