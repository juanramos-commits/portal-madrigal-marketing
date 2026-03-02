-- ============================================================================
-- 014 — Snapshot bancario completo en retiros + facturas
-- ============================================================================
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-03-02
-- Cambios:
--   1. Añade campos bancarios internacionales a ventas_retiros
--   2. Añade datos_bancarios_texto a ventas_facturas (snapshot formateado)
--   3. Actualiza ventas_solicitar_retiro para snapshot completo
--   4. Actualiza ventas_aprobar_retiro para guardar datos bancarios en factura
-- ============================================================================

-- ── 1. Campos bancarios en ventas_retiros ──────────────────────────────────
ALTER TABLE ventas_retiros
  ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT,
  ADD COLUMN IF NOT EXISTS swift_bic TEXT,
  ADD COLUMN IF NOT EXISTS routing_number TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS sort_code TEXT,
  ADD COLUMN IF NOT EXISTS titular_cuenta TEXT;

-- ── 2. Snapshot formateado en ventas_facturas ──────────────────────────────
ALTER TABLE ventas_facturas
  ADD COLUMN IF NOT EXISTS datos_bancarios_texto TEXT;

-- ── 3. Actualizar ventas_solicitar_retiro ──────────────────────────────────
CREATE OR REPLACE FUNCTION ventas_solicitar_retiro(p_usuario_id UUID, p_monto DECIMAL)
RETURNS JSONB AS $$
DECLARE
    v_saldo_disponible DECIMAL;
    v_al_dia BOOLEAN;
    v_datos_fiscales RECORD;
    v_retiro_id UUID;
BEGIN
    -- Verificar que es el propio usuario o super_admin
    IF auth.uid()::uuid <> p_usuario_id AND NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
    END IF;

    IF p_monto <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El monto debe ser mayor a 0');
    END IF;

    -- Verificar que el closer tiene al día sus reuniones
    v_al_dia := ventas_verificar_closer_al_dia(p_usuario_id);
    IF NOT v_al_dia THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Debes marcar el estado de todas tus reuniones pasadas antes de solicitar un retiro');
    END IF;

    -- Verificar saldo disponible
    v_saldo_disponible := ventas_obtener_saldo_disponible(p_usuario_id);
    IF v_saldo_disponible < p_monto THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente. Disponible: ' || v_saldo_disponible || '€');
    END IF;

    -- Obtener datos fiscales completos
    SELECT * INTO v_datos_fiscales FROM ventas_datos_fiscales WHERE usuario_id = p_usuario_id;

    -- Crear retiro con snapshot bancario completo
    INSERT INTO ventas_retiros (
        usuario_id, monto,
        cuenta_bancaria_iban, tipo_cuenta, swift_bic,
        routing_number, account_number, sort_code, titular_cuenta
    )
    VALUES (
        p_usuario_id, p_monto,
        v_datos_fiscales.cuenta_bancaria_iban,
        v_datos_fiscales.tipo_cuenta,
        v_datos_fiscales.swift_bic,
        v_datos_fiscales.routing_number,
        v_datos_fiscales.account_number,
        v_datos_fiscales.sort_code,
        v_datos_fiscales.titular_cuenta
    )
    RETURNING id INTO v_retiro_id;

    -- Notificar a super_admins
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    SELECT vrc.usuario_id, 'retiro_pendiente', 'Nuevo retiro solicitado',
           'Se ha solicitado un retiro de ' || p_monto || '€',
           jsonb_build_object('retiro_id', v_retiro_id, 'usuario_id', p_usuario_id)
    FROM ventas_roles_comerciales vrc
    WHERE vrc.rol = 'super_admin' AND vrc.activo = true
    UNION
    SELECT u.id, 'retiro_pendiente', 'Nuevo retiro solicitado',
           'Se ha solicitado un retiro de ' || p_monto || '€',
           jsonb_build_object('retiro_id', v_retiro_id, 'usuario_id', p_usuario_id)
    FROM usuarios u WHERE u.tipo = 'super_admin';

    RETURN jsonb_build_object('ok', true, 'retiro_id', v_retiro_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Actualizar ventas_aprobar_retiro ────────────────────────────────────
CREATE OR REPLACE FUNCTION ventas_aprobar_retiro(p_retiro_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_retiro RECORD;
    v_datos_fiscales RECORD;
    v_empresa RECORD;
    v_numero_factura VARCHAR;
    v_base DECIMAL;
    v_iva_monto DECIMAL;
    v_total DECIMAL;
    v_factura_id UUID;
    v_datos_bancarios TEXT;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede aprobar retiros');
    END IF;

    SELECT * INTO v_retiro FROM ventas_retiros WHERE id = p_retiro_id;
    IF v_retiro IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Retiro no encontrado');
    END IF;
    IF v_retiro.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El retiro no está pendiente');
    END IF;

    -- Obtener datos fiscales del usuario
    SELECT * INTO v_datos_fiscales FROM ventas_datos_fiscales WHERE usuario_id = v_retiro.usuario_id;
    SELECT * INTO v_empresa FROM ventas_empresa_fiscal LIMIT 1;

    -- Calcular factura
    IF v_datos_fiscales IS NOT NULL AND v_datos_fiscales.iva_incluido THEN
        v_total := v_retiro.monto;
        v_iva_monto := ROUND(v_retiro.monto * COALESCE(v_datos_fiscales.iva_porcentaje, 0) / (100 + COALESCE(v_datos_fiscales.iva_porcentaje, 0)), 2);
        v_base := v_total - v_iva_monto;
    ELSE
        v_base := v_retiro.monto;
        v_iva_monto := ROUND(v_retiro.monto * COALESCE(v_datos_fiscales.iva_porcentaje, 0) / 100, 2);
        v_total := v_base + v_iva_monto;
    END IF;

    -- Generar número de factura
    v_numero_factura := COALESCE(v_datos_fiscales.serie_factura, 'F') || '-' ||
                        LPAD(COALESCE(v_datos_fiscales.siguiente_numero_factura, 1)::text, 3, '0');

    -- Formatear datos bancarios desde snapshot del retiro
    v_datos_bancarios := CASE COALESCE(v_retiro.tipo_cuenta, 'iban')
        WHEN 'iban' THEN
            'IBAN: ' || COALESCE(v_retiro.cuenta_bancaria_iban, '-')
            || CASE WHEN v_retiro.swift_bic IS NOT NULL AND v_retiro.swift_bic != ''
               THEN ' · SWIFT: ' || v_retiro.swift_bic ELSE '' END
        WHEN 'us' THEN
            'Routing: ' || COALESCE(v_retiro.routing_number, '-')
            || ' · Account: ' || COALESCE(v_retiro.account_number, '-')
            || CASE WHEN v_retiro.swift_bic IS NOT NULL AND v_retiro.swift_bic != ''
               THEN ' · SWIFT: ' || v_retiro.swift_bic ELSE '' END
        WHEN 'uk' THEN
            'Sort Code: ' || COALESCE(v_retiro.sort_code, '-')
            || ' · Account: ' || COALESCE(v_retiro.account_number, '-')
            || CASE WHEN v_retiro.swift_bic IS NOT NULL AND v_retiro.swift_bic != ''
               THEN ' · SWIFT: ' || v_retiro.swift_bic ELSE '' END
        WHEN 'other' THEN
            'SWIFT: ' || COALESCE(v_retiro.swift_bic, '-')
            || ' · Account: ' || COALESCE(v_retiro.account_number, '-')
        ELSE COALESCE(v_retiro.cuenta_bancaria_iban, '-')
    END;

    -- Crear factura con datos bancarios snapshot
    INSERT INTO ventas_facturas (
        retiro_id, usuario_id, numero_factura, fecha_emision,
        emisor_nombre, emisor_nif, emisor_direccion, emisor_ciudad, emisor_cp, emisor_pais,
        receptor_nombre, receptor_cif, receptor_direccion, receptor_ciudad, receptor_cp, receptor_pais,
        concepto, base_imponible, iva_porcentaje, iva_monto, total,
        datos_bancarios_texto
    )
    VALUES (
        p_retiro_id, v_retiro.usuario_id, v_numero_factura, CURRENT_DATE,
        v_datos_fiscales.nombre_fiscal, v_datos_fiscales.nif_cif, v_datos_fiscales.direccion,
        v_datos_fiscales.ciudad, v_datos_fiscales.codigo_postal, v_datos_fiscales.pais,
        COALESCE(v_empresa.nombre_fiscal, 'Madrigal Marketing'), COALESCE(v_empresa.cif, ''),
        v_empresa.direccion, v_empresa.ciudad, v_empresa.codigo_postal, v_empresa.pais,
        COALESCE(v_empresa.concepto_factura, 'Servicios de intermediación comercial'),
        v_base, COALESCE(v_datos_fiscales.iva_porcentaje, 0), v_iva_monto, v_total,
        v_datos_bancarios
    )
    RETURNING id INTO v_factura_id;

    -- Incrementar número de factura
    UPDATE ventas_datos_fiscales
    SET siguiente_numero_factura = COALESCE(siguiente_numero_factura, 1) + 1
    WHERE usuario_id = v_retiro.usuario_id;

    -- Actualizar retiro
    UPDATE ventas_retiros
    SET estado = 'aprobado',
        factura_id = v_factura_id,
        aprobado_por_id = auth.uid()::uuid,
        fecha_aprobacion = now()
    WHERE id = p_retiro_id;

    -- Actualizar wallet
    UPDATE ventas_wallet
    SET total_retirado = total_retirado + v_retiro.monto
    WHERE usuario_id = v_retiro.usuario_id;

    -- Notificación al usuario
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (v_retiro.usuario_id, 'retiro_aprobado', 'Retiro aprobado',
            'Tu retiro de ' || v_retiro.monto || '€ ha sido aprobado. Factura: ' || v_numero_factura,
            jsonb_build_object('retiro_id', p_retiro_id, 'factura_id', v_factura_id));

    RETURN jsonb_build_object('ok', true, 'factura_id', v_factura_id, 'numero_factura', v_numero_factura);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
