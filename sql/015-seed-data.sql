-- ============================================================
-- SEED DATA — Portal Madrigal Marketing
-- Ejecutar en orden. Idempotente (ON CONFLICT DO NOTHING).
-- ============================================================

-- ── VARIABLES DE REFERENCIA ─────────────────────────────────
-- Usuarios existentes:
--   super_admin:      5740c65b-c37f-42d6-b518-eda4251054d5
--   david (dir):      e472a852-7177-4b0b-8bcf-d2462781d8aa
--   pablo (closer):   504f3541-90e9-4488-b5f9-807873e32937
--   mercedes (c+s):   0bf00739-59e3-4b1d-bf78-f4b5bfb57ce9
--   mireia (setter):  2af74587-e3df-44f7-a4b4-48bd286824d7
-- Usuarios nuevos:
--   maría (setter):   2d6f164d-fb87-43fc-b8bd-dff9fb38f699
--   carlos (setter):  be645ebe-3055-4565-971f-2c6b8e2206eb
--   ana (closer):     b886e833-15bf-4e3e-8372-1a8a8b6611a6
--   pedro (closer):   0098bf8e-1db7-4900-aee1-5174595182f4
--   laura (dir):      808ccab3-7ec9-4efe-a19d-ceb6d2d628fb

-- ── 1. USUARIOS ─────────────────────────────────────────────
INSERT INTO usuarios (id, email, nombre, tipo, activo, created_at, updated_at)
VALUES
  ('2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'maria@madrigalmarketing.es', 'María López', 'equipo', true, now(), now()),
  ('be645ebe-3055-4565-971f-2c6b8e2206eb', 'carlos@madrigalmarketing.es', 'Carlos Ruiz', 'equipo', true, now(), now()),
  ('b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'ana@madrigalmarketing.es', 'Ana García', 'equipo', true, now(), now()),
  ('0098bf8e-1db7-4900-aee1-5174595182f4', 'pedro@madrigalmarketing.es', 'Pedro Martín', 'equipo', true, now(), now()),
  ('808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'laura@madrigalmarketing.es', 'Laura Fernández', 'equipo', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── 2. ROLES COMERCIALES ────────────────────────────────────
INSERT INTO ventas_roles_comerciales (id, usuario_id, rol, activo, created_at)
VALUES
  (gen_random_uuid(), '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'setter', true, now()),
  (gen_random_uuid(), 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'setter', true, now()),
  (gen_random_uuid(), 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'closer', true, now()),
  (gen_random_uuid(), '0098bf8e-1db7-4900-aee1-5174595182f4', 'closer', true, now()),
  (gen_random_uuid(), '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', true, now())
ON CONFLICT DO NOTHING;

-- ── 3. CATEGORÍAS ───────────────────────────────────────────
INSERT INTO ventas_categorias (id, nombre, activo, orden, created_at, updated_at)
VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Fotógrafo',        true, 1,  now(), now()),
  ('c0000001-0000-0000-0000-000000000002', 'Videógrafo',       true, 2,  now(), now()),
  ('c0000001-0000-0000-0000-000000000003', 'Wedding Planner',  true, 3,  now(), now()),
  ('c0000001-0000-0000-0000-000000000004', 'Catering',         true, 4,  now(), now()),
  ('c0000001-0000-0000-0000-000000000005', 'Floristería',      true, 5,  now(), now()),
  ('c0000001-0000-0000-0000-000000000006', 'DJ / Música',      true, 6,  now(), now()),
  ('c0000001-0000-0000-0000-000000000007', 'Finca / Venue',    true, 7,  now(), now()),
  ('c0000001-0000-0000-0000-000000000008', 'Maquillaje',       true, 8,  now(), now()),
  ('c0000001-0000-0000-0000-000000000009', 'Invitaciones',     true, 9,  now(), now()),
  ('c0000001-0000-0000-0000-00000000000a', 'Otros',            true, 10, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── 4. ETIQUETAS ────────────────────────────────────────────
INSERT INTO ventas_etiquetas (id, nombre, color, activo, created_at, updated_at)
VALUES
  ('d0000001-0000-0000-0000-000000000001', 'VIP',              '#F59E0B', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000002', 'Urgente',          '#EF4444', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000003', 'Boda 2026',        '#3B82F6', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000004', 'Boda 2027',        '#8B5CF6', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000005', 'Presupuesto alto', '#10B981', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000006', 'Segundo contacto', '#F97316', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000007', 'Referido',         '#EC4899', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000008', 'Instagram',        '#E1306C', true, now(), now()),
  ('d0000001-0000-0000-0000-000000000009', 'Google Ads',       '#4285F4', true, now(), now()),
  ('d0000001-0000-0000-0000-00000000000a', 'Boca a boca',      '#6B7280', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── 5. PAQUETES ─────────────────────────────────────────────
INSERT INTO ventas_paquetes (id, nombre, descripcion, precio, activo, orden, created_at, updated_at)
VALUES
  ('e0000001-0000-0000-0000-000000000001', 'Starter',    'Paquete básico',          500,  true, 1, now(), now()),
  ('e0000001-0000-0000-0000-000000000002', 'Growth',     'Paquete crecimiento',    1000,  true, 2, now(), now()),
  ('e0000001-0000-0000-0000-000000000003', 'Premium',    'Paquete premium',        1500,  true, 3, now(), now()),
  ('e0000001-0000-0000-0000-000000000004', 'Enterprise', 'Paquete empresarial',    2500,  true, 4, now(), now()),
  ('e0000001-0000-0000-0000-000000000005', 'Custom',     'Precio personalizado',      0,  true, 5, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── 6. LEADS (30) ───────────────────────────────────────────
-- Setter María: 2d6f164d, Setter Carlos: be645ebe
-- Closer Ana: b886e833, Closer Pedro: 0098bf8e
INSERT INTO ventas_leads (id, nombre, email, telefono, nombre_negocio, categoria_id, fuente, setter_asignado_id, closer_asignado_id, notas, created_at, updated_at)
VALUES
  -- Leads 1-5: Ventas cerradas / Propuesta (closers)
  ('b0000001-0000-0000-0000-000000000001', 'Elena Rodríguez',      'elena@foto.es',        '+34 612 345 001', 'Elena Fotografía',      'c0000001-0000-0000-0000-000000000001', 'Instagram',  '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Interesada en paquete de fotos para boda en junio 2026. Presupuesto alto.',          '2025-12-05 10:30:00+00', now()),
  ('b0000001-0000-0000-0000-000000000002', 'Marcos Sánchez',       'marcos@visual.es',     '+34 612 345 002', 'Marcos Visual Studio',  'c0000001-0000-0000-0000-000000000002', 'Google Ads', 'be645ebe-3055-4565-971f-2c6b8e2206eb', '0098bf8e-1db7-4900-aee1-5174595182f4', 'Videógrafo con experiencia en bodas rurales. Quiere crecer con marketing digital.',  '2025-12-08 14:15:00+00', now()),
  ('b0000001-0000-0000-0000-000000000003', 'Lucía Martínez',       'info@bodasconalma.es', '+34 612 345 003', 'Bodas con Alma',        'c0000001-0000-0000-0000-000000000003', 'Referido',   '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Wedding planner con 5 años de experiencia. Busca más visibilidad online.',           '2025-12-12 09:00:00+00', now()),
  ('b0000001-0000-0000-0000-000000000004', 'Antonio López',        'lamesa@catering.es',   '+34 612 345 004', 'Catering La Mesa',      'c0000001-0000-0000-0000-000000000004', 'Web',        'be645ebe-3055-4565-971f-2c6b8e2206eb', '0098bf8e-1db7-4900-aee1-5174595182f4', 'Catering especializado en bodas. Quiere expandir a toda Cataluña.',                  '2025-12-15 11:45:00+00', now()),
  ('b0000001-0000-0000-0000-000000000005', 'Carmen Navarro',       'hola@silvestre.es',    '+34 612 345 005', 'Florería Silvestre',    'c0000001-0000-0000-0000-000000000005', 'Instagram',  '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Floristería artesanal. Interesada en redes sociales y web.',                         '2025-12-18 16:20:00+00', now()),
  -- Leads 6-10: Negociación / Seguimiento (closers)
  ('b0000001-0000-0000-0000-000000000006', 'Raúl Fernández',       'raul@djbeats.es',      '+34 612 345 006', 'DJ Raúl Beats',         'c0000001-0000-0000-0000-000000000006', 'Facebook',   'be645ebe-3055-4565-971f-2c6b8e2206eb', '0098bf8e-1db7-4900-aee1-5174595182f4', 'DJ profesional para bodas y eventos. Quiere posicionarse como referente en Málaga.', '2025-12-20 13:00:00+00', now()),
  ('b0000001-0000-0000-0000-000000000007', 'Isabel Ruiz',          'info@losolivos.es',    '+34 612 345 007', 'Finca Los Olivos',      'c0000001-0000-0000-0000-000000000007', 'Google Ads', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Finca para bodas en Alicante. Necesita web nueva y gestión de redes.',               '2025-12-22 10:30:00+00', now()),
  ('b0000001-0000-0000-0000-000000000008', 'Marta Gómez',          'marta@makeup.es',      '+34 612 345 008', 'Marta Makeup',          'c0000001-0000-0000-0000-000000000008', 'Instagram',  'be645ebe-3055-4565-971f-2c6b8e2206eb', '0098bf8e-1db7-4900-aee1-5174595182f4', 'Maquilladora profesional. Quiere aumentar reservas para temporada 2026.',            '2025-12-28 15:45:00+00', now()),
  ('b0000001-0000-0000-0000-000000000009', 'Pablo Jiménez',        'hola@invitabonito.es', '+34 612 345 009', 'Invita Bonito',         'c0000001-0000-0000-0000-000000000009', 'Boca a boca','2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Invitaciones personalizadas. Buena reputación local. Quiere vender online.',         '2026-01-03 09:15:00+00', now()),
  ('b0000001-0000-0000-0000-00000000000a', 'Sofía Herrero',        'sur@fotoeventos.es',   '+34 612 345 010', 'Foto Eventos Sur',      'c0000001-0000-0000-0000-000000000001', 'Web',        'be645ebe-3055-4565-971f-2c6b8e2206eb', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Fotógrafa de eventos en Cádiz. Busca más presencia en Google.',                      '2026-01-06 12:00:00+00', now()),
  -- Leads 11-14: Agendados (setters) / Demo agendada (closers)
  ('b0000001-0000-0000-0000-00000000000b', 'Diego Moreno',         'lumina@video.es',      '+34 612 345 011', 'Producciones Lumina',   'c0000001-0000-0000-0000-000000000002', 'Google Ads', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', '0098bf8e-1db7-4900-aee1-5174595182f4', 'Productora audiovisual en Zaragoza. Quiere especializarse en bodas.',                '2026-01-10 14:30:00+00', now()),
  ('b0000001-0000-0000-0000-00000000000c', 'Laura Vega',           'dreams@wedding.es',    '+34 612 345 012', 'Wedding Dreams',        'c0000001-0000-0000-0000-000000000003', 'Referido',   'be645ebe-3055-4565-971f-2c6b8e2206eb', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Wedding planner en Murcia. Referida por cliente anterior.',                          '2026-01-15 10:00:00+00', now()),
  ('b0000001-0000-0000-0000-00000000000d', 'Fernando Castro',      'sabores@boda.es',      '+34 612 345 013', 'Sabores de Boda',       'c0000001-0000-0000-0000-000000000004', 'Facebook',   '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', '0098bf8e-1db7-4900-aee1-5174595182f4', 'Catering gourmet para bodas en Córdoba. Alta calidad.',                              '2026-01-18 16:00:00+00', now()),
  ('b0000001-0000-0000-0000-00000000000e', 'Cristina Pérez',       'jardin@flores.es',     '+34 612 345 014', 'Jardín de Flores',      'c0000001-0000-0000-0000-000000000005', 'Instagram',  'be645ebe-3055-4565-971f-2c6b8e2206eb', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Floristería premium en Valladolid. Interesada en branding.',                         '2026-01-20 11:30:00+00', now()),
  -- Leads 15-17: Nurturing (setters)
  ('b0000001-0000-0000-0000-00000000000f', 'Miguel Torres',        'info@soundlove.es',    '+34 612 345 015', 'Sound & Love',          'c0000001-0000-0000-0000-000000000006', 'Web',        '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'DJ y sonido para bodas en Palma. Necesita más tiempo para decidir.',                                  '2026-01-25 09:45:00+00', now()),
  ('b0000001-0000-0000-0000-000000000010', 'Adriana Serrano',      'hacienda@sanmiguel.es','+34 612 345 016', 'Hacienda San Miguel',   'c0000001-0000-0000-0000-000000000007', 'Google Ads', 'be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'Finca rústica en Toledo. Pidiendo presupuesto a varias agencias.',                                    '2026-01-28 14:00:00+00', now()),
  ('b0000001-0000-0000-0000-000000000011', 'Patricia Molina',      'bride@beauty.es',      '+34 612 345 017', 'Beauty Bride',          'c0000001-0000-0000-0000-000000000008', 'Instagram',  '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'Estudio de maquillaje nupcial en Pamplona. Interés moderado.',                                        '2026-02-01 10:15:00+00', now()),
  -- Leads 18-20: Seguimiento (setters)
  ('b0000001-0000-0000-0000-000000000012', 'Roberto Díaz',         'nupcial@papel.es',     '+34 612 345 018', 'Papelería Nupcial',     'c0000001-0000-0000-0000-000000000009', 'Boca a boca','be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'Invitaciones artesanales en Gijón. Está comparando servicios.',                                       '2026-02-03 13:30:00+00', now()),
  ('b0000001-0000-0000-0000-000000000013', 'Verónica Sanz',        'clicks@amor.es',       '+34 612 345 019', 'Clicks de Amor',        'c0000001-0000-0000-0000-000000000001', 'Facebook',   '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'Fotógrafa de bodas en Vigo. Busca mejorar su posicionamiento web.',                                   '2026-02-05 09:00:00+00', now()),
  ('b0000001-0000-0000-0000-000000000014', 'Javier Romero',        'cine@bodas.es',        '+34 612 345 020', 'Cine Bodas',            'c0000001-0000-0000-0000-000000000002', 'Web',        'be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'Cinematografía de bodas en Santander. Interesado en campañas de ads.',                                '2026-02-07 15:45:00+00', now()),
  -- Leads 21-22: Ghosting (setters)
  ('b0000001-0000-0000-0000-000000000015', 'Alejandra Ruiz',       'info@tubodaperf.es',   '+34 612 345 021', 'Tu Boda Perfecta',      'c0000001-0000-0000-0000-000000000003', 'Instagram',  '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'Wedding planner en San Sebastián. No responde desde hace 2 semanas.',                                 '2026-02-10 11:00:00+00', now()),
  ('b0000001-0000-0000-0000-000000000016', 'Óscar Blanco',         'delicias@nup.es',      '+34 612 345 022', 'Delicias Nupciales',    'c0000001-0000-0000-0000-000000000004', 'Google Ads', 'be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'Catering en Salamanca. Dejó de contestar después del primer contacto.',                               '2026-02-12 16:30:00+00', now()),
  -- Leads 23-26: Contactados (setters)
  ('b0000001-0000-0000-0000-000000000017', 'Natalia Flores',       'rosa@eterna.es',       '+34 612 345 023', 'Rosa Eterna',           'c0000001-0000-0000-0000-000000000005', 'Referido',   '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'Floristería artística en Oviedo. Contactada ayer, buena receptividad.',                                '2026-02-15 10:00:00+00', now()),
  ('b0000001-0000-0000-0000-000000000018', 'Samuel Ortega',        'fiesta@total.es',      '+34 612 345 024', 'Fiesta Total',          'c0000001-0000-0000-0000-000000000006', 'Facebook',   'be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'DJ y animación en Logroño. Contactado, quiere más info.',                                              '2026-02-17 14:20:00+00', now()),
  ('b0000001-0000-0000-0000-000000000019', 'Beatriz Campos',       'info@masdelsol.es',    '+34 612 345 025', 'Mas del Sol',           'c0000001-0000-0000-0000-000000000007', 'Web',        '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'Finca para eventos en Castellón. Primera llamada realizada.',                                          '2026-02-19 09:30:00+00', now()),
  ('b0000001-0000-0000-0000-00000000001a', 'Hugo Méndez',          'glam@studio.es',       '+34 612 345 026', 'Glam Studio',           'c0000001-0000-0000-0000-000000000008', 'Instagram',  'be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'Estudio de maquillaje en A Coruña. Respondió al primer email.',                                        '2026-02-21 12:15:00+00', now()),
  -- Leads 27-30: Por Contactar (setters)
  ('b0000001-0000-0000-0000-00000000001b', 'Andrea Gil',           'letras@suenos.es',     '+34 612 345 027', 'Letras y Sueños',       'c0000001-0000-0000-0000-000000000009', 'Boca a boca','2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'Papelería creativa en León. Nuevo lead sin contactar.',                                                '2026-02-24 10:00:00+00', now()),
  ('b0000001-0000-0000-0000-00000000001c', 'Daniel Reyes',         'pixel@bodas.es',       '+34 612 345 028', 'Pixel Bodas',           'c0000001-0000-0000-0000-000000000001', 'Google Ads', 'be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'Fotógrafo digital en Almería. Recién llegado.',                                                        '2026-02-26 08:45:00+00', now()),
  ('b0000001-0000-0000-0000-00000000001d', 'Eva Martín',           'sabor@med.es',         '+34 612 345 029', 'Sabor Mediterráneo',    'c0000001-0000-0000-0000-000000000004', 'Web',        '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', NULL, 'Catering mediterráneo en Tarragona. Formulario web.',                                                  '2026-02-28 11:30:00+00', now()),
  ('b0000001-0000-0000-0000-00000000001e', 'Álvaro Prieto',        'jardines@amor.es',     '+34 612 345 030', 'Jardines del Amor',     'c0000001-0000-0000-0000-000000000007', 'Facebook',   'be645ebe-3055-4565-971f-2c6b8e2206eb', NULL, 'Finca y jardines para bodas en Huelva. Lead reciente.',                                                '2026-03-01 09:00:00+00', now())
ON CONFLICT (id) DO NOTHING;

-- ── 7. LEAD PIPELINE (Setters) ──────────────────────────────
-- Pipeline Setters: a0000000-0000-0000-0000-000000000001
-- Etapas: Por Contactar=86426696, Contactado=27565840, Ghosting=cadbcc64,
--         Seguimiento=67883eab, Nurturing=ba757014, Agendado=a4c071d0
INSERT INTO ventas_lead_pipeline (id, lead_id, pipeline_id, etapa_id, contador_intentos, fecha_entrada, created_at, updated_at)
VALUES
  -- Por Contactar (leads 27-30)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001b', 'a0000000-0000-0000-0000-000000000001', '86426696-28a8-492f-85e6-6857fce68f3f', 0, '2026-02-24 10:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001c', 'a0000000-0000-0000-0000-000000000001', '86426696-28a8-492f-85e6-6857fce68f3f', 0, '2026-02-26 08:45:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001d', 'a0000000-0000-0000-0000-000000000001', '86426696-28a8-492f-85e6-6857fce68f3f', 0, '2026-02-28 11:30:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001e', 'a0000000-0000-0000-0000-000000000001', '86426696-28a8-492f-85e6-6857fce68f3f', 0, '2026-03-01 09:00:00+00', now(), now()),
  -- Contactado (leads 23-26)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', '27565840-01d2-4bab-9aa0-9c8c4576790a', 1, '2026-02-16 10:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001', '27565840-01d2-4bab-9aa0-9c8c4576790a', 1, '2026-02-18 14:20:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001', '27565840-01d2-4bab-9aa0-9c8c4576790a', 1, '2026-02-20 09:30:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001a', 'a0000000-0000-0000-0000-000000000001', '27565840-01d2-4bab-9aa0-9c8c4576790a', 1, '2026-02-22 12:15:00+00', now(), now()),
  -- Ghosting (leads 21-22)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'cadbcc64-9115-49bb-831b-feea5449250c', 3, '2026-02-14 11:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 'cadbcc64-9115-49bb-831b-feea5449250c', 2, '2026-02-15 16:30:00+00', now(), now()),
  -- Seguimiento (leads 18-20)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', '67883eab-18bd-4f93-b59f-28e5cb3cece0', 2, '2026-02-06 13:30:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', '67883eab-18bd-4f93-b59f-28e5cb3cece0', 2, '2026-02-08 09:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', '67883eab-18bd-4f93-b59f-28e5cb3cece0', 1, '2026-02-10 15:45:00+00', now(), now()),
  -- Nurturing (leads 15-17)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', 'ba757014-fb92-4086-8fb3-dab12b8045c4', 3, '2026-01-30 09:45:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'ba757014-fb92-4086-8fb3-dab12b8045c4', 2, '2026-02-01 14:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'ba757014-fb92-4086-8fb3-dab12b8045c4', 2, '2026-02-04 10:15:00+00', now(), now()),
  -- Agendado (leads 11-14)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001', 'a4c071d0-3756-4d13-89a8-cb3abb1b8f73', 2, '2026-01-20 14:30:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', 'a4c071d0-3756-4d13-89a8-cb3abb1b8f73', 1, '2026-01-22 10:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000001', 'a4c071d0-3756-4d13-89a8-cb3abb1b8f73', 2, '2026-01-25 16:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000001', 'a4c071d0-3756-4d13-89a8-cb3abb1b8f73', 1, '2026-01-27 11:30:00+00', now(), now()),
  -- Venta en setters (leads 1-2)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '98e08e55-5410-45df-99d4-56150265ba77', 2, '2026-02-16 10:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '98e08e55-5410-45df-99d4-56150265ba77', 1, '2026-02-18 14:00:00+00', now(), now()),
  -- Leads 3-10 in Cita Realizada (setters)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '39e6f76e-3258-4b51-8077-b47af762db3c', 2, '2026-01-15 09:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '39e6f76e-3258-4b51-8077-b47af762db3c', 1, '2026-01-18 11:45:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', '39e6f76e-3258-4b51-8077-b47af762db3c', 2, '2026-01-20 16:20:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', '98e08e55-5410-45df-99d4-56150265ba77', 1, '2026-02-20 13:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', '39e6f76e-3258-4b51-8077-b47af762db3c', 2, '2026-01-05 10:30:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', '39e6f76e-3258-4b51-8077-b47af762db3c', 1, '2026-01-10 15:45:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'eb70cd16-bf17-4493-9063-a9fe2269ca88', 2, '2026-02-18 09:15:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', '98e08e55-5410-45df-99d4-56150265ba77', 1, '2026-03-01 12:00:00+00', now(), now())
ON CONFLICT DO NOTHING;

-- ── 8. LEAD PIPELINE (Closers) ──────────────────────────────
-- Pipeline Closers: a0000000-0000-0000-0000-000000000002
-- Etapas: LlamadaAgendada=1caa76b4, Contactado=3ac1f9c2, Seguimiento=a02c7696,
--         Nurturing=f6001ab0, Reserva=d5d11335, Venta=4df481ee, Lost=46dba9b3
INSERT INTO ventas_lead_pipeline (id, lead_id, pipeline_id, etapa_id, contador_intentos, fecha_entrada, created_at, updated_at)
VALUES
  -- Llamada Agendada (leads 11-12)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000002', '1caa76b4-2afe-49a9-a55e-f92da01d5545', 0, '2026-01-22 14:30:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000002', '1caa76b4-2afe-49a9-a55e-f92da01d5545', 0, '2026-01-24 10:00:00+00', now(), now()),
  -- Contactado / Demo (leads 9-10)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', '3ac1f9c2-77da-4f1d-b4da-6e3afc735b5c', 1, '2026-01-10 09:15:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', '3ac1f9c2-77da-4f1d-b4da-6e3afc735b5c', 1, '2026-01-12 12:00:00+00', now(), now()),
  -- Seguimiento (leads 7-8)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'a02c7696-62ab-478d-8d35-46c5f3fd5a9f', 2, '2026-01-08 10:30:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'a02c7696-62ab-478d-8d35-46c5f3fd5a9f', 1, '2026-01-12 15:45:00+00', now(), now()),
  -- Nurturing (leads 5-6)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'f6001ab0-b8f7-4b6c-b9cc-8b9d52ec4d23', 2, '2026-01-05 16:20:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'f6001ab0-b8f7-4b6c-b9cc-8b9d52ec4d23', 1, '2026-01-08 13:00:00+00', now(), now()),
  -- Reserva (leads 3-4)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'd5d11335-7d09-410a-b06b-9c58060844ec', 2, '2026-01-02 09:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'd5d11335-7d09-410a-b06b-9c58060844ec', 1, '2026-01-05 11:45:00+00', now(), now()),
  -- Venta (leads 1-2)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '4df481ee-429f-4f0e-929a-cda5c1af40b7', 2, '2026-02-15 10:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '4df481ee-429f-4f0e-929a-cda5c1af40b7', 1, '2026-02-17 14:00:00+00', now(), now()),
  -- Lost (leads 13-14)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000002', '46dba9b3-8546-4882-bc28-cca16f30788a', 3, '2026-02-10 16:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000002', '46dba9b3-8546-4882-bc28-cca16f30788a', 2, '2026-02-12 11:30:00+00', now(), now()),
  -- Devolución en closers (lead 9)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', '4de1d108-37c9-4743-b619-10448e70fd69', 2, '2026-02-18 09:15:00+00', now(), now()),
  -- Venta en closers (leads 6, 10)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', '4df481ee-429f-4f0e-929a-cda5c1af40b7', 1, '2026-02-19 13:00:00+00', now(), now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', '4df481ee-429f-4f0e-929a-cda5c1af40b7', 1, '2026-02-28 12:00:00+00', now(), now())
ON CONFLICT DO NOTHING;

-- ── 9. LEAD ETIQUETAS ───────────────────────────────────────
INSERT INTO ventas_lead_etiquetas (id, lead_id, etiqueta_id, created_at)
VALUES
  -- Leads 1-5: VIP + Boda 2026
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000003', now()),
  -- Leads 6-10: Boda 2026 + Instagram
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000008', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000008', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000008', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000008', 'd0000001-0000-0000-0000-000000000008', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000009', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000009', 'd0000001-0000-0000-0000-000000000008', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000a', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000a', 'd0000001-0000-0000-0000-000000000008', now()),
  -- Leads 11-15: Boda 2027 + Google Ads
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000b', 'd0000001-0000-0000-0000-000000000004', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000b', 'd0000001-0000-0000-0000-000000000009', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000c', 'd0000001-0000-0000-0000-000000000004', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000c', 'd0000001-0000-0000-0000-000000000009', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000d', 'd0000001-0000-0000-0000-000000000004', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000d', 'd0000001-0000-0000-0000-000000000009', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000e', 'd0000001-0000-0000-0000-000000000004', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000e', 'd0000001-0000-0000-0000-000000000009', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000f', 'd0000001-0000-0000-0000-000000000004', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000f', 'd0000001-0000-0000-0000-000000000009', now()),
  -- Leads 16-20: Presupuesto alto + Referido
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000010', 'd0000001-0000-0000-0000-000000000005', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000010', 'd0000001-0000-0000-0000-000000000007', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000011', 'd0000001-0000-0000-0000-000000000005', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000011', 'd0000001-0000-0000-0000-000000000007', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000012', 'd0000001-0000-0000-0000-000000000005', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000012', 'd0000001-0000-0000-0000-000000000007', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000013', 'd0000001-0000-0000-0000-000000000005', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000013', 'd0000001-0000-0000-0000-000000000007', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000014', 'd0000001-0000-0000-0000-000000000005', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000014', 'd0000001-0000-0000-0000-000000000007', now()),
  -- Leads 21-25: Segundo contacto
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000015', 'd0000001-0000-0000-0000-000000000006', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000016', 'd0000001-0000-0000-0000-000000000006', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000017', 'd0000001-0000-0000-0000-000000000006', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000018', 'd0000001-0000-0000-0000-000000000006', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000019', 'd0000001-0000-0000-0000-000000000006', now()),
  -- Leads 26-30: Boda 2026 + Urgente
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001a', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001a', 'd0000001-0000-0000-0000-000000000002', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001b', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001b', 'd0000001-0000-0000-0000-000000000002', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001c', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001c', 'd0000001-0000-0000-0000-000000000002', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001d', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001d', 'd0000001-0000-0000-0000-000000000002', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001e', 'd0000001-0000-0000-0000-000000000003', now()),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001e', 'd0000001-0000-0000-0000-000000000002', now())
ON CONFLICT DO NOTHING;

-- ── 10. VENTAS (8) ──────────────────────────────────────────
INSERT INTO ventas_ventas (id, lead_id, closer_id, setter_id, paquete_id, fecha_venta, importe, metodo_pago, estado, es_pago_unico, aprobada_por_id, fecha_aprobacion, fecha_rechazo, es_devolucion, fecha_devolucion, notas, created_at, updated_at)
VALUES
  -- V1: Elena Fotografía, Premium 1500€, aprobada (Feb 15)
  ('f0000001-0000-0000-0000-000000000001',
   'b0000001-0000-0000-0000-000000000001', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699',
   'e0000001-0000-0000-0000-000000000003', '2026-02-15', 1500, 'stripe', 'aprobada', false,
   '5740c65b-c37f-42d6-b518-eda4251054d5', '2026-02-16 10:00:00+00', NULL, false, NULL,
   'Paquete Premium para campaña completa de bodas', '2026-02-15 14:30:00+00', now()),
  -- V2: Marcos Visual, Enterprise 2500€, aprobada (Feb 17)
  ('f0000001-0000-0000-0000-000000000002',
   'b0000001-0000-0000-0000-000000000002', '0098bf8e-1db7-4900-aee1-5174595182f4', 'be645ebe-3055-4565-971f-2c6b8e2206eb',
   'e0000001-0000-0000-0000-000000000004', '2026-02-17', 2500, 'sequra', 'aprobada', false,
   '5740c65b-c37f-42d6-b518-eda4251054d5', '2026-02-18 09:00:00+00', NULL, false, NULL,
   'Contrato Enterprise anual', '2026-02-17 16:00:00+00', now()),
  -- V3: Bodas con Alma, Growth 1000€, pendiente (Feb 25)
  ('f0000001-0000-0000-0000-000000000003',
   'b0000001-0000-0000-0000-000000000003', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699',
   'e0000001-0000-0000-0000-000000000002', '2026-02-25', 1000, 'transferencia', 'pendiente', false,
   NULL, NULL, NULL, false, NULL,
   'Pendiente de verificar pago por transferencia', '2026-02-25 11:00:00+00', now()),
  -- V4: Catering La Mesa, Starter 500€, pendiente (Feb 26)
  ('f0000001-0000-0000-0000-000000000004',
   'b0000001-0000-0000-0000-000000000004', '0098bf8e-1db7-4900-aee1-5174595182f4', 'be645ebe-3055-4565-971f-2c6b8e2206eb',
   'e0000001-0000-0000-0000-000000000001', '2026-02-26', 500, 'stripe', 'pendiente', false,
   NULL, NULL, NULL, false, NULL,
   'Paquete Starter para arrancar', '2026-02-26 09:30:00+00', now()),
  -- V5: Florería Silvestre, Premium 1500€, rechazada (Feb 22)
  ('f0000001-0000-0000-0000-000000000005',
   'b0000001-0000-0000-0000-000000000005', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699',
   'e0000001-0000-0000-0000-000000000003', '2026-02-22', 1500, 'sequra', 'rechazada', false,
   NULL, NULL, '2026-02-24 15:00:00+00', false, NULL,
   'Rechazada: cliente canceló antes del pago', '2026-02-22 10:15:00+00', now()),
  -- V6: DJ Raúl Beats, Growth 1000€, aprobada, pago único (Feb 19)
  ('f0000001-0000-0000-0000-000000000006',
   'b0000001-0000-0000-0000-000000000006', '0098bf8e-1db7-4900-aee1-5174595182f4', 'be645ebe-3055-4565-971f-2c6b8e2206eb',
   'e0000001-0000-0000-0000-000000000002', '2026-02-19', 1000, 'efectivo', 'aprobada', true,
   '5740c65b-c37f-42d6-b518-eda4251054d5', '2026-02-20 09:00:00+00', NULL, false, NULL,
   'Pago único en efectivo. Bonus aplicado.', '2026-02-19 17:00:00+00', now()),
  -- V7: Invita Bonito, Starter 500€, aprobada → devolución (Feb 10)
  ('f0000001-0000-0000-0000-000000000007',
   'b0000001-0000-0000-0000-000000000009', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699',
   'e0000001-0000-0000-0000-000000000001', '2026-02-10', 500, 'transferencia', 'aprobada', false,
   '5740c65b-c37f-42d6-b518-eda4251054d5', '2026-02-11 10:00:00+00', NULL, true, '2026-02-18 14:00:00+00',
   'Devolución solicitada por el cliente', '2026-02-10 12:00:00+00', now()),
  -- V8: Foto Eventos Sur, Enterprise 2500€, aprobada (Mar 1 — comisiones retenidas)
  ('f0000001-0000-0000-0000-000000000008',
   'b0000001-0000-0000-0000-00000000000a', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'be645ebe-3055-4565-971f-2c6b8e2206eb',
   'e0000001-0000-0000-0000-000000000004', '2026-03-01', 2500, 'stripe', 'aprobada', false,
   '5740c65b-c37f-42d6-b518-eda4251054d5', '2026-03-02 09:00:00+00', NULL, false, NULL,
   'Gran cliente, Enterprise completo', '2026-03-01 15:30:00+00', now())
ON CONFLICT (id) DO NOTHING;

-- ── 11. COMISIONES CONFIG (actualizar) ──────────────────────
UPDATE ventas_comisiones_config SET comision_fija = 50,  bonus_pago_unico = 25  WHERE rol = 'setter';
UPDATE ventas_comisiones_config SET comision_fija = 100, bonus_pago_unico = 50  WHERE rol = 'closer';
UPDATE ventas_comisiones_config SET comision_fija = 30,  bonus_pago_unico = 15  WHERE rol = 'director_ventas';

-- ── 12. COMISIONES ──────────────────────────────────────────
-- V1 (aprobada Feb 16, no pago unico) → disponible desde Feb 17 +48h = Feb 17
INSERT INTO ventas_comisiones (id, venta_id, usuario_id, rol, monto, concepto, es_bonus, es_bonus_manual, disponible_desde, created_at)
VALUES
  -- V1
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000001', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'closer', 100, 'Comisión closer - Elena Fotografía', false, false, '2026-02-17 14:30:00+00', '2026-02-16 10:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000001', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'setter', 50, 'Comisión setter - Elena Fotografía', false, false, '2026-02-17 14:30:00+00', '2026-02-16 10:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000001', '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', 30, 'Comisión director - Elena Fotografía', false, false, '2026-02-17 14:30:00+00', '2026-02-16 10:00:00+00'),
  -- V2
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000002', '0098bf8e-1db7-4900-aee1-5174595182f4', 'closer', 100, 'Comisión closer - Marcos Visual', false, false, '2026-02-19 16:00:00+00', '2026-02-18 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000002', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'setter', 50, 'Comisión setter - Marcos Visual', false, false, '2026-02-19 16:00:00+00', '2026-02-18 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000002', '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', 30, 'Comisión director - Marcos Visual', false, false, '2026-02-19 16:00:00+00', '2026-02-18 09:00:00+00'),
  -- V6 (pago unico → fija + bonus)
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000006', '0098bf8e-1db7-4900-aee1-5174595182f4', 'closer', 100, 'Comisión closer - DJ Raúl Beats', false, false, '2026-02-21 17:00:00+00', '2026-02-20 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000006', '0098bf8e-1db7-4900-aee1-5174595182f4', 'closer', 50, 'Bonus pago único closer - DJ Raúl Beats', true, false, '2026-02-21 17:00:00+00', '2026-02-20 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000006', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'setter', 50, 'Comisión setter - DJ Raúl Beats', false, false, '2026-02-21 17:00:00+00', '2026-02-20 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000006', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'setter', 25, 'Bonus pago único setter - DJ Raúl Beats', true, false, '2026-02-21 17:00:00+00', '2026-02-20 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000006', '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', 30, 'Comisión director - DJ Raúl Beats', false, false, '2026-02-21 17:00:00+00', '2026-02-20 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000006', '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', 15, 'Bonus pago único director - DJ Raúl Beats', true, false, '2026-02-21 17:00:00+00', '2026-02-20 09:00:00+00'),
  -- V7 (aprobada → devolución)
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000007', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'closer', 100, 'Comisión closer - Invita Bonito', false, false, '2026-02-12 12:00:00+00', '2026-02-11 10:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000007', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'setter', 50, 'Comisión setter - Invita Bonito', false, false, '2026-02-12 12:00:00+00', '2026-02-11 10:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000007', '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', 30, 'Comisión director - Invita Bonito', false, false, '2026-02-12 12:00:00+00', '2026-02-11 10:00:00+00'),
  -- V7 devolución (negative comisiones)
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000007', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'closer', -100, 'Devolución closer - Invita Bonito', false, false, '2026-02-18 14:00:00+00', '2026-02-18 14:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000007', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'setter', -50, 'Devolución setter - Invita Bonito', false, false, '2026-02-18 14:00:00+00', '2026-02-18 14:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000007', '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', -30, 'Devolución director - Invita Bonito', false, false, '2026-02-18 14:00:00+00', '2026-02-18 14:00:00+00'),
  -- V8 (aprobada Mar 2 — comisiones retenidas 48h hasta Mar 3)
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000008', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'closer', 100, 'Comisión closer - Foto Eventos Sur', false, false, '2026-03-03 15:30:00+00', '2026-03-02 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000008', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'setter', 50, 'Comisión setter - Foto Eventos Sur', false, false, '2026-03-03 15:30:00+00', '2026-03-02 09:00:00+00'),
  (gen_random_uuid(), 'f0000001-0000-0000-0000-000000000008', '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'director_ventas', 30, 'Comisión director - Foto Eventos Sur', false, false, '2026-03-03 15:30:00+00', '2026-03-02 09:00:00+00')
ON CONFLICT DO NOTHING;

-- ── 13. WALLETS ─────────────────────────────────────────────
-- Ana:   +100(V1) +100(V7) -100(V7dev) +100(V8) = 200 ganado, 100 descontado, -100 retirado
-- Pedro: +100(V2) +100(V6) +50(V6bon) = 250
-- María: +50(V1)  +50(V7)  -50(V7dev) = 50 ganado, 50 descontado
-- Carlos: +50(V2) +50(V6) +25(V6bon) +50(V8) = 175
-- Laura: +30(V1) +30(V2) +30(V6) +15(V6bon) +30(V7) -30(V7dev) +30(V8) = 135 ganado, 30 descontado

INSERT INTO ventas_wallet (id, usuario_id, saldo, total_ganado, total_retirado, total_descontado, updated_at)
VALUES
  (gen_random_uuid(), 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 100, 300, 100, 100, now()),
  (gen_random_uuid(), '0098bf8e-1db7-4900-aee1-5174595182f4', 250, 250, 0, 0, now()),
  (gen_random_uuid(), '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 50, 100, 0, 50, now()),
  (gen_random_uuid(), 'be645ebe-3055-4565-971f-2c6b8e2206eb', 175, 175, 0, 0, now()),
  (gen_random_uuid(), '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 135, 165, 0, 30, now())
ON CONFLICT (usuario_id) DO UPDATE SET
  saldo = EXCLUDED.saldo,
  total_ganado = EXCLUDED.total_ganado,
  total_retirado = EXCLUDED.total_retirado,
  total_descontado = EXCLUDED.total_descontado,
  updated_at = now();

-- ── 14. DATOS FISCALES ──────────────────────────────────────
INSERT INTO ventas_datos_fiscales (id, usuario_id, nombre_fiscal, nif_cif, direccion, ciudad, codigo_postal, pais, tipo_cuenta, cuenta_bancaria_iban, titular_cuenta, serie_factura, siguiente_numero_factura, iva_porcentaje, iva_incluido, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'Ana García López', '12345678A', 'Calle Gran Vía 15, 3ºB', 'Madrid', '28013', 'España', 'iban', 'ES1234567890123456789012', 'Ana García López', 'F', 2, 21, false, now(), now()),
  (gen_random_uuid(), '0098bf8e-1db7-4900-aee1-5174595182f4', 'Pedro Martín Rodríguez', '87654321B', 'Av. de la Constitución 22', 'Sevilla', '41001', 'España', 'iban', 'ES9876543210987654321098', 'Pedro Martín Rodríguez', 'F', 1, 21, true, now(), now())
ON CONFLICT (usuario_id) DO UPDATE SET
  nombre_fiscal = EXCLUDED.nombre_fiscal,
  nif_cif = EXCLUDED.nif_cif,
  direccion = EXCLUDED.direccion,
  ciudad = EXCLUDED.ciudad,
  codigo_postal = EXCLUDED.codigo_postal,
  pais = EXCLUDED.pais,
  tipo_cuenta = EXCLUDED.tipo_cuenta,
  cuenta_bancaria_iban = EXCLUDED.cuenta_bancaria_iban,
  titular_cuenta = EXCLUDED.titular_cuenta,
  iva_porcentaje = EXCLUDED.iva_porcentaje,
  iva_incluido = EXCLUDED.iva_incluido,
  updated_at = now();

-- ── 15. EMPRESA FISCAL ──────────────────────────────────────
UPDATE ventas_empresa_fiscal SET
  nombre_fiscal = 'Estrategias Madrigal Marketing S.L.',
  cif = 'B12345678',
  direccion = 'Calle del Emprendedor 10',
  ciudad = 'Elche',
  codigo_postal = '03201',
  pais = 'España',
  concepto_factura = 'Servicios de intermediación comercial',
  updated_at = now()
WHERE id = 'd1068cbc-00dd-464d-88f1-902dd743ae12';

-- ── 16. RETIROS ─────────────────────────────────────────────
-- Retiro 1: Ana, 100€, aprobado hace ~2 semanas
INSERT INTO ventas_retiros (id, usuario_id, monto, estado, cuenta_bancaria_iban, tipo_cuenta, titular_cuenta, aprobado_por_id, fecha_aprobacion, created_at, updated_at)
VALUES
  ('f1000001-0000-0000-0000-000000000001', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 100, 'aprobado', 'ES1234567890123456789012', 'iban', 'Ana García López', '5740c65b-c37f-42d6-b518-eda4251054d5', '2026-02-17 10:00:00+00', '2026-02-16 09:00:00+00', now())
ON CONFLICT (id) DO NOTHING;

-- Retiro 2: Pedro, 150€, pendiente hace ~3 días
INSERT INTO ventas_retiros (id, usuario_id, monto, estado, cuenta_bancaria_iban, tipo_cuenta, titular_cuenta, created_at, updated_at)
VALUES
  ('f1000001-0000-0000-0000-000000000002', '0098bf8e-1db7-4900-aee1-5174595182f4', 150, 'pendiente', 'ES9876543210987654321098', 'iban', 'Pedro Martín Rodríguez', '2026-02-27 14:00:00+00', now())
ON CONFLICT (id) DO NOTHING;

-- Retiro 3: Ana, 50€, rechazado hace ~1 semana
INSERT INTO ventas_retiros (id, usuario_id, monto, estado, cuenta_bancaria_iban, tipo_cuenta, titular_cuenta, fecha_rechazo, motivo_rechazo, created_at, updated_at)
VALUES
  ('f1000001-0000-0000-0000-000000000003', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 50, 'rechazado', 'ES1234567890123456789012', 'iban', 'Ana García López', '2026-02-24 11:00:00+00', 'IBAN incorrecto, verificar datos bancarios', '2026-02-23 16:00:00+00', now())
ON CONFLICT (id) DO NOTHING;

-- ── 17. FACTURA (del retiro aprobado de Ana) ────────────────
INSERT INTO ventas_facturas (id, retiro_id, usuario_id, numero_factura, fecha_emision, emisor_nombre, emisor_nif, emisor_direccion, emisor_ciudad, emisor_cp, emisor_pais, receptor_nombre, receptor_cif, receptor_direccion, receptor_ciudad, receptor_cp, receptor_pais, concepto, base_imponible, iva_porcentaje, iva_monto, total, datos_bancarios_texto, created_at)
VALUES
  ('f2000001-0000-0000-0000-000000000001', 'f1000001-0000-0000-0000-000000000001', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6',
   'F-001', '2026-02-17',
   'Ana García López', '12345678A', 'Calle Gran Vía 15, 3ºB', 'Madrid', '28013', 'España',
   'Estrategias Madrigal Marketing S.L.', 'B12345678', 'Calle del Emprendedor 10', 'Elche', '03201', 'España',
   'Servicios de intermediación comercial', 100, 21, 21, 121,
   'IBAN: ES1234567890123456789012 | Titular: Ana García López',
   '2026-02-17 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Link factura to retiro
UPDATE ventas_retiros SET factura_id = 'f2000001-0000-0000-0000-000000000001' WHERE id = 'f1000001-0000-0000-0000-000000000001';

-- ── 18. ACTIVIDAD ───────────────────────────────────────────
INSERT INTO ventas_actividad (id, lead_id, usuario_id, tipo, descripcion, datos, created_at)
VALUES
  -- Lead 1: Elena Fotografía
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2025-12-05 10:30:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'cambio_etapa', 'Movido a Contactado', '{"etapa": "Contactado"}'::jsonb, '2025-12-06 11:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'nota', 'Muy interesada en el paquete Premium. Tiene boda en junio.', NULL, '2025-12-08 09:30:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000001', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'cambio_etapa', 'Movido a Venta', '{"etapa": "Venta"}'::jsonb, '2026-02-15 14:30:00+00'),
  -- Lead 2: Marcos Visual
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000002', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'creacion', 'Lead creado', NULL, '2025-12-08 14:15:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000002', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'cambio_etapa', 'Movido a Agendado', '{"etapa": "Agendado"}'::jsonb, '2025-12-15 10:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000002', '0098bf8e-1db7-4900-aee1-5174595182f4', 'cambio_etapa', 'Movido a Venta', '{"etapa": "Venta"}'::jsonb, '2026-02-17 16:00:00+00'),
  -- Lead 3
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000003', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2025-12-12 09:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000003', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'nota', 'Referida por Wedding Dreams. Busca más visibilidad.', NULL, '2025-12-14 10:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000003', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'cambio_etapa', 'Movido a Reserva', '{"etapa": "Reserva"}'::jsonb, '2026-01-02 09:00:00+00'),
  -- Lead 5
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000005', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2025-12-18 16:20:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000005', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'cambio_etapa', 'Movido a Nurturing', '{"etapa": "Nurturing"}'::jsonb, '2026-01-05 16:20:00+00'),
  -- Lead 6
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'creacion', 'Lead creado', NULL, '2025-12-20 13:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', '0098bf8e-1db7-4900-aee1-5174595182f4', 'cambio_etapa', 'Movido a Venta', '{"etapa": "Venta"}'::jsonb, '2026-02-19 17:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000006', '0098bf8e-1db7-4900-aee1-5174595182f4', 'nota', 'Pago único en efectivo. Cliente satisfecho.', NULL, '2026-02-20 09:30:00+00'),
  -- Lead 7
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000007', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2025-12-22 10:30:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000007', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'cambio_etapa', 'Movido a Seguimiento', '{"etapa": "Seguimiento"}'::jsonb, '2026-01-08 10:30:00+00'),
  -- Lead 9 (devolución)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000009', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2026-01-03 09:15:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000009', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'cambio_etapa', 'Movido a Devolución', '{"etapa": "Devolución"}'::jsonb, '2026-02-18 14:00:00+00'),
  -- Lead 10
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000a', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'creacion', 'Lead creado', NULL, '2026-01-06 12:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000a', 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'cambio_etapa', 'Movido a Venta', '{"etapa": "Venta"}'::jsonb, '2026-03-01 15:30:00+00'),
  -- Lead 11
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000b', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2026-01-10 14:30:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000b', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'cambio_etapa', 'Movido a Agendado', '{"etapa": "Agendado"}'::jsonb, '2026-01-20 14:30:00+00'),
  -- Lead 13 (lost)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000d', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2026-01-18 16:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000d', '0098bf8e-1db7-4900-aee1-5174595182f4', 'cambio_etapa', 'Movido a Lost', '{"etapa": "Lost", "motivo": "Presupuesto insuficiente"}'::jsonb, '2026-02-10 16:00:00+00'),
  -- Lead 15
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000f', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2026-01-25 09:45:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000000f', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'cambio_etapa', 'Movido a Nurturing', '{"etapa": "Nurturing"}'::jsonb, '2026-01-30 09:45:00+00'),
  -- Lead 21 (ghosting)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000015', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2026-02-10 11:00:00+00'),
  (gen_random_uuid(), 'b0000001-0000-0000-0000-000000000015', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'cambio_etapa', 'Movido a Ghosting', '{"etapa": "Ghosting"}'::jsonb, '2026-02-14 11:00:00+00'),
  -- Lead 27 (nuevo)
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001b', '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'creacion', 'Lead creado', NULL, '2026-02-24 10:00:00+00'),
  -- Lead 30
  (gen_random_uuid(), 'b0000001-0000-0000-0000-00000000001e', 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'creacion', 'Lead creado', NULL, '2026-03-01 09:00:00+00')
ON CONFLICT DO NOTHING;

-- ── 19. NOTIFICACIONES ──────────────────────────────────────
-- Limpiar notificaciones existentes
DELETE FROM ventas_notificaciones;

INSERT INTO ventas_notificaciones (id, usuario_id, tipo, titulo, mensaje, datos, leida, created_at)
VALUES
  -- Para admin
  (gen_random_uuid(), '5740c65b-c37f-42d6-b518-eda4251054d5', 'venta_pendiente', 'Nueva venta pendiente', 'Bodas con Alma - Growth (1.000 €)', '{"venta_id": "f0000001-0000-0000-0000-000000000003"}'::jsonb, false, '2026-02-25 11:00:00+00'),
  (gen_random_uuid(), '5740c65b-c37f-42d6-b518-eda4251054d5', 'venta_pendiente', 'Nueva venta pendiente', 'Catering La Mesa - Starter (500 €)', '{"venta_id": "f0000001-0000-0000-0000-000000000004"}'::jsonb, false, '2026-02-26 09:30:00+00'),
  (gen_random_uuid(), '5740c65b-c37f-42d6-b518-eda4251054d5', 'retiro_pendiente', 'Nuevo retiro pendiente', 'Pedro Martín solicita retiro de 150 €', '{"retiro_id": "f1000001-0000-0000-0000-000000000002"}'::jsonb, false, '2026-02-27 14:00:00+00'),
  (gen_random_uuid(), '5740c65b-c37f-42d6-b518-eda4251054d5', 'venta_aprobada', 'Venta aprobada', 'Elena Fotografía - Premium (1.500 €)', '{"venta_id": "f0000001-0000-0000-0000-000000000001"}'::jsonb, true, '2026-02-16 10:00:00+00'),
  (gen_random_uuid(), '5740c65b-c37f-42d6-b518-eda4251054d5', 'venta_aprobada', 'Venta aprobada', 'Marcos Visual - Enterprise (2.500 €)', '{"venta_id": "f0000001-0000-0000-0000-000000000002"}'::jsonb, true, '2026-02-18 09:00:00+00'),
  -- Para Ana
  (gen_random_uuid(), 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'retiro_aprobado', 'Retiro aprobado', 'Tu retiro de 100 € ha sido aprobado y procesado', '{"retiro_id": "f1000001-0000-0000-0000-000000000001"}'::jsonb, true, '2026-02-17 10:00:00+00'),
  (gen_random_uuid(), 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'retiro_rechazado', 'Retiro rechazado', 'Tu retiro de 50 € ha sido rechazado: IBAN incorrecto', '{"retiro_id": "f1000001-0000-0000-0000-000000000003"}'::jsonb, false, '2026-02-24 11:00:00+00'),
  (gen_random_uuid(), 'b886e833-15bf-4e3e-8372-1a8a8b6611a6', 'comision', 'Nueva comisión', 'Comisión de 100 € por venta de Elena Fotografía', '{"venta_id": "f0000001-0000-0000-0000-000000000001"}'::jsonb, true, '2026-02-16 10:00:00+00'),
  -- Para Pedro
  (gen_random_uuid(), '0098bf8e-1db7-4900-aee1-5174595182f4', 'comision', 'Nueva comisión', 'Comisión de 100 € por venta de Marcos Visual', '{"venta_id": "f0000001-0000-0000-0000-000000000002"}'::jsonb, true, '2026-02-18 09:00:00+00'),
  (gen_random_uuid(), '0098bf8e-1db7-4900-aee1-5174595182f4', 'comision', 'Nuevo bonus', 'Bonus pago único de 50 € por DJ Raúl Beats', '{"venta_id": "f0000001-0000-0000-0000-000000000006"}'::jsonb, false, '2026-02-20 09:00:00+00'),
  -- Para María
  (gen_random_uuid(), '2d6f164d-fb87-43fc-b8bd-dff9fb38f699', 'comision', 'Nueva comisión', 'Comisión de 50 € por venta de Elena Fotografía', '{"venta_id": "f0000001-0000-0000-0000-000000000001"}'::jsonb, true, '2026-02-16 10:00:00+00'),
  -- Para Carlos
  (gen_random_uuid(), 'be645ebe-3055-4565-971f-2c6b8e2206eb', 'comision', 'Nueva comisión', 'Comisión de 50 € por venta de Marcos Visual', '{"venta_id": "f0000001-0000-0000-0000-000000000002"}'::jsonb, true, '2026-02-18 09:00:00+00'),
  -- Para Laura
  (gen_random_uuid(), '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'comision', 'Nueva comisión', 'Comisión director de 30 € por Elena Fotografía', '{"venta_id": "f0000001-0000-0000-0000-000000000001"}'::jsonb, true, '2026-02-16 10:00:00+00'),
  (gen_random_uuid(), '808ccab3-7ec9-4efe-a19d-ceb6d2d628fb', 'comision', 'Nueva comisión', 'Comisión director de 30 € por Marcos Visual', '{"venta_id": "f0000001-0000-0000-0000-000000000002"}'::jsonb, true, '2026-02-18 09:00:00+00')
ON CONFLICT DO NOTHING;
