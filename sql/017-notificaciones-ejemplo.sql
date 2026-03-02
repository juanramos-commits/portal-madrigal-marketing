-- ==========================================================================
-- NOTIFICACIONES DE EJEMPLO — info@madrigalmarketing.es
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-02
-- ==========================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM usuarios WHERE email = 'info@madrigalmarketing.es' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario info@madrigalmarketing.es no encontrado';
    RETURN;
  END IF;

  INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos, leida, created_at)
  VALUES
    -- No leídas (aparecerán como nuevas)
    (v_user_id, 'venta_pendiente', 'Nueva venta pendiente',
     'Bodas con Alma - Growth (1.000 €)', '{"venta_id": null}'::jsonb,
     false, NOW() - INTERVAL '15 minutes'),

    (v_user_id, 'retiro_pendiente', 'Nuevo retiro solicitado',
     'Pedro Martín solicita retiro de 150 €', '{"retiro_id": null}'::jsonb,
     false, NOW() - INTERVAL '2 hours'),

    (v_user_id, 'lead_asignado', 'Nuevo lead asignado',
     'Se te ha asignado el lead Elena Fotografía', '{"lead_id": null}'::jsonb,
     false, NOW() - INTERVAL '4 hours'),

    (v_user_id, 'cita_agendada', 'Cita agendada',
     'Reunión con Marcos Visual mañana a las 10:00', '{}'::jsonb,
     false, NOW() - INTERVAL '6 hours'),

    -- Leídas (historial)
    (v_user_id, 'venta_aprobada', 'Venta aprobada',
     'Elena Fotografía - Premium (1.500 €)', '{"venta_id": null}'::jsonb,
     true, NOW() - INTERVAL '1 day'),

    (v_user_id, 'venta_aprobada', 'Venta aprobada',
     'Marcos Visual - Enterprise (2.500 €)', '{"venta_id": null}'::jsonb,
     true, NOW() - INTERVAL '2 days'),

    (v_user_id, 'venta_rechazada', 'Venta rechazada',
     'La venta de DJ Raúl Beats ha sido rechazada', '{"venta_id": null}'::jsonb,
     true, NOW() - INTERVAL '3 days'),

    (v_user_id, 'retiro_aprobado', 'Retiro aprobado',
     'Tu retiro de 200 € ha sido aprobado. Factura: FAC-2026-0012', '{"retiro_id": null}'::jsonb,
     true, NOW() - INTERVAL '4 days'),

    (v_user_id, 'retiro_rechazado', 'Retiro rechazado',
     'Tu retiro de 50 € ha sido rechazado: IBAN incorrecto', '{"retiro_id": null}'::jsonb,
     true, NOW() - INTERVAL '5 days');

  RAISE NOTICE 'Insertadas 9 notificaciones de ejemplo para %', v_user_id;
END $$;
