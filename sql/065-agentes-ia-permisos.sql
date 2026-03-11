-- =====================================================
-- Permisos para módulo Agentes IA
-- =====================================================

INSERT INTO permisos (id, codigo, modulo, nombre, descripcion, orden) VALUES
  (gen_random_uuid(), 'ventas.agentes_ia.ver',       'ventas_agentes_ia', 'Ver Agentes IA',        'Acceso al módulo de Agentes IA',          600),
  (gen_random_uuid(), 'ventas.agentes_ia.crear',      'ventas_agentes_ia', 'Crear agentes',         'Crear y configurar agentes de IA',        601),
  (gen_random_uuid(), 'ventas.agentes_ia.editar',     'ventas_agentes_ia', 'Editar agentes',        'Editar configuración de agentes',         602),
  (gen_random_uuid(), 'ventas.agentes_ia.eliminar',   'ventas_agentes_ia', 'Eliminar agentes',      'Eliminar agentes de IA',                  603),
  (gen_random_uuid(), 'ventas.agentes_ia.ejecutar',   'ventas_agentes_ia', 'Ejecutar agentes',      'Lanzar y detener ejecución de agentes',   604)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  modulo = EXCLUDED.modulo,
  orden = EXCLUDED.orden;
