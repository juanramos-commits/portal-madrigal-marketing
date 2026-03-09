-- ============================================================================
-- 047 - Email Marketing: Seed Data
-- Segmentos del sistema, configuración por defecto, plantillas y bloques
-- de plantilla, y schedule de warmup de 42 días.
-- ============================================================================


-- ─── 1. Segmentos del sistema ─────────────────────────────────────────────────

INSERT INTO ventas_em_segments (id, name, description, rules, is_system, created_at) VALUES

-- 1) Alto Engagement
(gen_random_uuid(), 'Alto Engagement', 'Contactos con engagement score >= 70',
 '{"operator":"AND","conditions":[{"field":"engagement_score","op":"gte","value":"70"}]}'::JSONB,
 true, now()),

-- 2) Leads Fríos
(gen_random_uuid(), 'Leads Fríos', 'Contactos con bajo engagement y sin aperturas',
 '{"operator":"AND","conditions":[{"field":"engagement_score","op":"lt","value":"20"},{"field":"total_opened","op":"eq","value":"0"}]}'::JSONB,
 true, now()),

-- 3) Clientes Activos
(gen_random_uuid(), 'Clientes Activos', 'Contactos activos con más de 5 aperturas',
 '{"operator":"AND","conditions":[{"field":"status","op":"=","value":"active"},{"field":"total_opened","op":"gt","value":"5"}]}'::JSONB,
 true, now()),

-- 4) Inactivos 30 días (proxy: lead_score bajo)
(gen_random_uuid(), 'Inactivos 30 días', 'Contactos con baja actividad reciente (lead_score < 30)',
 '{"operator":"AND","conditions":[{"field":"lead_score","op":"lt","value":"30"}]}'::JSONB,
 true, now()),

-- 5) Nuevos (sin envíos aún)
(gen_random_uuid(), 'Nuevos sin envío', 'Contactos que aún no han recibido emails',
 '{"operator":"AND","conditions":[{"field":"total_sent","op":"eq","value":"0"}]}'::JSONB,
 true, now()),

-- 6) Lead Score Alto
(gen_random_uuid(), 'Lead Score Alto', 'Contactos con lead score >= 70',
 '{"operator":"AND","conditions":[{"field":"lead_score","op":"gte","value":"70"}]}'::JSONB,
 true, now()),

-- 7) Gmail Users
(gen_random_uuid(), 'Gmail Users', 'Contactos con proveedor Gmail',
 '{"operator":"AND","conditions":[{"field":"provider","op":"=","value":"gmail"}]}'::JSONB,
 true, now()),

-- 8) Sin Respuesta
(gen_random_uuid(), 'Sin Respuesta', 'Contactos con más de 3 envíos y 0 aperturas',
 '{"operator":"AND","conditions":[{"field":"total_sent","op":"gt","value":"3"},{"field":"total_opened","op":"eq","value":"0"}]}'::JSONB,
 true, now()),

-- 9) Convertidos (proxy: alto engagement + alto lead score)
(gen_random_uuid(), 'Convertidos', 'Contactos con engagement > 80 y lead score > 80',
 '{"operator":"AND","conditions":[{"field":"engagement_score","op":"gt","value":"80"},{"field":"lead_score","op":"gt","value":"80"}]}'::JSONB,
 true, now())

ON CONFLICT DO NOTHING;


-- ─── 2. Configuración por defecto ─────────────────────────────────────────────

INSERT INTO ventas_em_settings (key, value, description) VALUES
    ('warmup_days',          '42',                   'Días de warmup del dominio'),
    ('frequency_cap_hours',  '72',                   'Horas mínimas entre envíos al mismo contacto'),
    ('sunset_days',          '90',                   'Días sin actividad para sunset automático'),
    ('max_sends_per_hour',   '100',                  'Máximo de envíos por hora'),
    ('bounce_threshold',     '5',                    'Porcentaje máximo de bounces antes de pausar'),
    ('complaint_threshold',  '0.1',                  'Porcentaje máximo de complaints antes de pausar'),
    ('from_name',            'Madrigal Marketing',   'Nombre del remitente'),
    ('from_email',           '',                     'Email del remitente (configurar)'),
    ('reply_to',             '',                     'Email de respuesta (configurar)'),
    ('tracking_domain',      '',                     'Dominio de tracking personalizado (configurar)')
ON CONFLICT (key) DO NOTHING;


-- ─── 3. Plantillas del sistema ────────────────────────────────────────────────

INSERT INTO ventas_em_templates (id, name, subject, html_body, blocks, category, is_system, created_at) VALUES

-- Plantilla 1: Bienvenida Nuevo Lead
(gen_random_uuid(), 'Bienvenida Nuevo Lead', '¡Bienvenido/a a {{empresa}}!',
 '',
 '[
   {"type":"header","content":"<div style=\"text-align:center;padding:20px;background:#1a1a2e;\"><img src=\"{{logo_url}}\" alt=\"{{empresa}}\" style=\"max-height:60px;\"/></div>"},
   {"type":"text","content":"<p>Hola {{nombre}},</p><p>Gracias por tu interés en nuestros servicios. Estamos encantados de tenerte aquí.</p>"},
   {"type":"text","content":"<p>En <strong>{{empresa}}</strong> ayudamos a negocios como el tuyo a crecer con estrategias de marketing digital personalizadas.</p>"},
   {"type":"cta","content":"<div style=\"text-align:center;padding:20px;\"><a href=\"{{cta_url}}\" style=\"background:#4f46e5;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;\">Agendar una llamada</a></div>"},
   {"type":"footer","content":"<div style=\"text-align:center;padding:20px;font-size:12px;color:#666;\"><p>{{empresa}} — {{direccion}}</p><p><a href=\"{{unsubscribe_url}}\">Cancelar suscripción</a></p></div>"}
 ]'::JSONB,
 'onboarding', true, now()),

-- Plantilla 2: Seguimiento Propuesta
(gen_random_uuid(), 'Seguimiento Propuesta', 'Tu propuesta de {{empresa}} — Seguimiento',
 '',
 '[
   {"type":"header","content":"<div style=\"text-align:center;padding:20px;background:#1a1a2e;\"><img src=\"{{logo_url}}\" alt=\"{{empresa}}\" style=\"max-height:60px;\"/></div>"},
   {"type":"text","content":"<p>Hola {{nombre}},</p><p>Queríamos hacer seguimiento sobre la propuesta que te enviamos. ¿Has tenido oportunidad de revisarla?</p>"},
   {"type":"text","content":"<p>Aquí un resumen de lo que incluye:</p><ul><li>Estrategia personalizada</li><li>Cronograma de implementación</li><li>Resultados esperados</li></ul>"},
   {"type":"cta","content":"<div style=\"text-align:center;padding:20px;\"><a href=\"{{propuesta_url}}\" style=\"background:#4f46e5;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;\">Ver propuesta</a></div>"},
   {"type":"divider","content":"<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:20px 0;\"/>"},
   {"type":"footer","content":"<div style=\"text-align:center;padding:20px;font-size:12px;color:#666;\"><p>{{empresa}} — {{direccion}}</p><p><a href=\"{{unsubscribe_url}}\">Cancelar suscripción</a></p></div>"}
 ]'::JSONB,
 'sales', true, now())

ON CONFLICT DO NOTHING;


-- ─── 4. Bloques de plantilla del sistema ──────────────────────────────────────

INSERT INTO ventas_em_template_blocks (id, name, type, content, styles, category, is_system, created_at) VALUES

-- 1) Header Marca
(gen_random_uuid(), 'Header Marca', 'header',
 '<div style="text-align:center;padding:20px;background:#1a1a2e;"><img src="{{logo_url}}" alt="{{empresa}}" style="max-height:60px;"/></div>',
 '{"backgroundColor":"#1a1a2e","padding":"20px"}'::JSONB,
 'branding', true, now()),

-- 2) Texto Simple
(gen_random_uuid(), 'Texto Simple', 'text',
 '<p style="font-size:16px;line-height:1.6;color:#333;">Escribe aquí tu contenido. Puedes usar <strong>negrita</strong>, <em>cursiva</em> y <a href="#">enlaces</a>.</p>',
 '{"fontSize":"16px","lineHeight":"1.6","color":"#333333"}'::JSONB,
 'contenido', true, now()),

-- 3) CTA Principal
(gen_random_uuid(), 'CTA Principal', 'cta',
 '<div style="text-align:center;padding:20px;"><a href="{{cta_url}}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">{{cta_texto}}</a></div>',
 '{"backgroundColor":"#4f46e5","color":"#ffffff","borderRadius":"6px","align":"center"}'::JSONB,
 'accion', true, now()),

-- 4) CTA Secundario
(gen_random_uuid(), 'CTA Secundario', 'cta',
 '<div style="text-align:center;padding:20px;"><a href="{{cta_url}}" style="display:inline-block;border:2px solid #4f46e5;color:#4f46e5;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">{{cta_texto}}</a></div>',
 '{"borderColor":"#4f46e5","color":"#4f46e5","borderRadius":"6px","variant":"outlined","align":"center"}'::JSONB,
 'accion', true, now()),

-- 5) Imagen Destacada
(gen_random_uuid(), 'Imagen Destacada', 'image',
 '<div style="text-align:center;padding:10px 0;"><img src="{{imagen_url}}" alt="{{imagen_alt}}" style="max-width:100%;height:auto;border-radius:8px;"/></div>',
 '{"maxWidth":"100%","borderRadius":"8px","align":"center"}'::JSONB,
 'media', true, now()),

-- 6) Divisor
(gen_random_uuid(), 'Divisor', 'divider',
 '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>',
 '{"borderColor":"#e5e7eb","margin":"24px 0"}'::JSONB,
 'layout', true, now()),

-- 7) Footer Legal
(gen_random_uuid(), 'Footer Legal', 'footer',
 '<div style="text-align:center;padding:24px;font-size:12px;color:#9ca3af;background:#f9fafb;"><p>{{empresa}} — {{direccion}}</p><p>Recibes este email porque te suscribiste a nuestras comunicaciones.</p><p><a href="{{unsubscribe_url}}" style="color:#6b7280;">Cancelar suscripción</a> · <a href="{{preferences_url}}" style="color:#6b7280;">Gestionar preferencias</a></p></div>',
 '{"backgroundColor":"#f9fafb","fontSize":"12px","color":"#9ca3af","padding":"24px"}'::JSONB,
 'legal', true, now()),

-- 8) Columnas 2x
(gen_random_uuid(), 'Columnas 2x', 'text',
 '<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td width="50%" valign="top" style="padding-right:10px;"><p style="font-size:14px;color:#333;">Columna izquierda: escribe tu contenido aquí.</p></td><td width="50%" valign="top" style="padding-left:10px;"><p style="font-size:14px;color:#333;">Columna derecha: escribe tu contenido aquí.</p></td></tr></table>',
 '{"layout":"two-column","gap":"20px"}'::JSONB,
 'layout', true, now())

ON CONFLICT DO NOTHING;


-- ─── 5. Warmup schedule (42 días) ─────────────────────────────────────────────
-- Reemplaza el schedule simplificado de 044 con uno detallado de 42 días.

INSERT INTO ventas_em_warmup_schedule (day, max_sends, description) VALUES
    -- Semana 1: arranque conservador
    ( 1,   2, 'Día  1 — inicio warmup'),
    ( 2,   4, 'Día  2'),
    ( 3,   6, 'Día  3'),
    ( 4,   8, 'Día  4'),
    ( 5,  10, 'Día  5'),
    ( 6,  12, 'Día  6'),
    ( 7,  15, 'Día  7 — fin semana 1'),
    -- Semana 2
    ( 8,  18, 'Día  8'),
    ( 9,  20, 'Día  9'),
    (10,  22, 'Día 10'),
    (11,  25, 'Día 11'),
    (12,  28, 'Día 12'),
    (13,  30, 'Día 13'),
    (14,  33, 'Día 14 — fin semana 2'),
    -- Semana 3
    (15,  35, 'Día 15'),
    (16,  38, 'Día 16'),
    (17,  40, 'Día 17'),
    (18,  42, 'Día 18'),
    (19,  45, 'Día 19'),
    (20,  48, 'Día 20'),
    (21,  50, 'Día 21 — fin semana 3'),
    -- Semana 4
    (22,  52, 'Día 22'),
    (23,  55, 'Día 23'),
    (24,  57, 'Día 24'),
    (25,  58, 'Día 25'),
    (26,  60, 'Día 26'),
    (27,  62, 'Día 27'),
    (28,  63, 'Día 28 — fin semana 4'),
    -- Semana 5
    (29,  64, 'Día 29'),
    (30,  65, 'Día 30'),
    (31,  66, 'Día 31'),
    (32,  67, 'Día 32'),
    (33,  68, 'Día 33'),
    (34,  69, 'Día 34'),
    (35,  70, 'Día 35 — fin semana 5'),
    -- Semana 6: estabilización
    (36,  71, 'Día 36'),
    (37,  72, 'Día 37'),
    (38,  73, 'Día 38'),
    (39,  74, 'Día 39'),
    (40,  74, 'Día 40'),
    (41,  75, 'Día 41'),
    (42,  75, 'Día 42 — warmup completo')
ON CONFLICT (day) DO UPDATE SET
    max_sends   = EXCLUDED.max_sends,
    description = EXCLUDED.description;


-- ============================================================================
-- FIN 047
-- ============================================================================
