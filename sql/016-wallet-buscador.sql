-- ============================================================================
-- 016 - Buscador Potente para Wallet (Comisiones, Retiros, Facturas)
-- ============================================================================
-- Búsqueda en campos clave de cada tabla con relevancia, RBAC y multi-palabra.
-- Reutiliza normalize_text() de 011-buscador-ultra-potente.sql
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ventas_buscar_comisiones
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_comisiones(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_filtro_usuario_id UUID DEFAULT NULL,
  p_tipo TEXT DEFAULT 'todas',
  p_desde TEXT DEFAULT NULL,
  p_hasta TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  comision_id UUID,
  relevancia INTEGER
) AS $fn$
DECLARE
  v_terms TEXT[];
  v_normalized TEXT;
  v_uid UUID;
BEGIN
  v_normalized := public.normalize_text(TRIM(COALESCE(p_query, '')));

  -- Determine effective user
  IF COALESCE(p_user_role, '') IN ('super_admin', 'director_ventas') THEN
    v_uid := NULLIF(p_filtro_usuario_id, NULL);
  ELSE
    v_uid := p_user_id;
  END IF;

  -- Empty query: return paginated results with filters
  IF v_normalized = '' THEN
    RETURN QUERY
      SELECT c.id AS comision_id, 0::INTEGER AS relevancia
      FROM public.ventas_comisiones c
      WHERE (v_uid IS NULL OR c.usuario_id = v_uid)
        AND (p_tipo = 'todas'
             OR (p_tipo = 'fijas' AND c.es_bonus = false AND c.monto >= 0)
             OR (p_tipo = 'bonus' AND c.es_bonus = true)
             OR (p_tipo = 'negativas' AND c.monto < 0))
        AND (p_desde IS NULL OR c.created_at >= p_desde::TIMESTAMPTZ)
        AND (p_hasta IS NULL OR c.created_at <= (p_hasta || 'T23:59:59')::TIMESTAMPTZ)
      ORDER BY c.created_at DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  v_terms := array_remove(string_to_array(v_normalized, ' '), '');

  RETURN QUERY
    SELECT sub.id AS comision_id, sub.score::INTEGER AS relevancia
    FROM (
      SELECT
        c.id,
        (
          public.normalize_text(COALESCE(c.concepto, '')) || ' ' ||
          public.normalize_text(COALESCE(c.rol, '')) || ' ' ||
          public.normalize_text(COALESCE(l.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(u.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(u.email, ''))
        ) AS searchable,
        -- Relevance scoring
        (CASE WHEN public.normalize_text(COALESCE(c.concepto, '')) LIKE '%' || v_normalized || '%' THEN 10 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(l.nombre, '')) LIKE '%' || v_normalized || '%' THEN 8 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(c.rol, '')) LIKE '%' || v_normalized || '%' THEN 5 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(u.nombre, '')) LIKE '%' || v_normalized || '%' THEN 3 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(u.email, '')) LIKE '%' || v_normalized || '%' THEN 2 ELSE 0 END)
        AS score
      FROM public.ventas_comisiones c
      LEFT JOIN public.ventas_ventas v ON v.id = c.venta_id
      LEFT JOIN public.ventas_leads l ON l.id = v.lead_id
      LEFT JOIN public.usuarios u ON u.id = c.usuario_id
      WHERE (v_uid IS NULL OR c.usuario_id = v_uid)
        AND (p_tipo = 'todas'
             OR (p_tipo = 'fijas' AND c.es_bonus = false AND c.monto >= 0)
             OR (p_tipo = 'bonus' AND c.es_bonus = true)
             OR (p_tipo = 'negativas' AND c.monto < 0))
        AND (p_desde IS NULL OR c.created_at >= p_desde::TIMESTAMPTZ)
        AND (p_hasta IS NULL OR c.created_at <= (p_hasta || 'T23:59:59')::TIMESTAMPTZ)
    ) sub
    WHERE (
      SELECT bool_and(sub.searchable LIKE '%' || term || '%')
      FROM unnest(v_terms) AS term
    )
    ORDER BY sub.score DESC, sub.id
    LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. ventas_buscar_retiros
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_retiros(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  retiro_id UUID,
  relevancia INTEGER
) AS $fn$
DECLARE
  v_terms TEXT[];
  v_normalized TEXT;
  v_is_admin BOOLEAN;
BEGIN
  v_normalized := public.normalize_text(TRIM(COALESCE(p_query, '')));
  v_is_admin := COALESCE(p_user_role, '') IN ('super_admin', 'director_ventas');

  -- Empty query
  IF v_normalized = '' THEN
    RETURN QUERY
      SELECT r.id AS retiro_id, 0::INTEGER AS relevancia
      FROM public.ventas_retiros r
      WHERE (v_is_admin OR r.usuario_id = p_user_id)
        AND (p_estado IS NULL OR p_estado = 'todos' OR r.estado = p_estado)
      ORDER BY r.created_at DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  v_terms := array_remove(string_to_array(v_normalized, ' '), '');

  RETURN QUERY
    SELECT sub.id AS retiro_id, sub.score::INTEGER AS relevancia
    FROM (
      SELECT
        r.id,
        (
          public.normalize_text(COALESCE(r.cuenta_bancaria_iban, '')) || ' ' ||
          public.normalize_text(COALESCE(r.titular_cuenta, '')) || ' ' ||
          public.normalize_text(COALESCE(r.motivo_rechazo, '')) || ' ' ||
          public.normalize_text(COALESCE(f.numero_factura, '')) || ' ' ||
          public.normalize_text(COALESCE(u.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(u.email, '')) || ' ' ||
          COALESCE(r.monto::TEXT, '')
        ) AS searchable,
        (CASE WHEN public.normalize_text(COALESCE(u.nombre, '')) LIKE '%' || v_normalized || '%' THEN 10 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(r.cuenta_bancaria_iban, '')) LIKE '%' || v_normalized || '%' THEN 8 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(r.titular_cuenta, '')) LIKE '%' || v_normalized || '%' THEN 6 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(f.numero_factura, '')) LIKE '%' || v_normalized || '%' THEN 5 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(r.motivo_rechazo, '')) LIKE '%' || v_normalized || '%' THEN 3 ELSE 0 END)
        AS score
      FROM public.ventas_retiros r
      LEFT JOIN public.ventas_facturas f ON f.id = r.factura_id
      LEFT JOIN public.usuarios u ON u.id = r.usuario_id
      WHERE (v_is_admin OR r.usuario_id = p_user_id)
        AND (p_estado IS NULL OR p_estado = 'todos' OR r.estado = p_estado)
    ) sub
    WHERE (
      SELECT bool_and(sub.searchable LIKE '%' || term || '%')
      FROM unnest(v_terms) AS term
    )
    ORDER BY sub.score DESC, sub.id
    LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. ventas_buscar_facturas
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_facturas(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_filtro_usuario_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  factura_id UUID,
  relevancia INTEGER
) AS $fn$
DECLARE
  v_terms TEXT[];
  v_normalized TEXT;
  v_is_admin BOOLEAN;
  v_uid UUID;
BEGIN
  v_normalized := public.normalize_text(TRIM(COALESCE(p_query, '')));
  v_is_admin := COALESCE(p_user_role, '') IN ('super_admin', 'director_ventas');

  IF v_is_admin THEN
    v_uid := NULLIF(p_filtro_usuario_id, NULL);
  ELSE
    v_uid := p_user_id;
  END IF;

  -- Empty query
  IF v_normalized = '' THEN
    RETURN QUERY
      SELECT f.id AS factura_id, 0::INTEGER AS relevancia
      FROM public.ventas_facturas f
      WHERE (v_uid IS NULL OR f.usuario_id = v_uid)
      ORDER BY f.fecha_emision DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  v_terms := array_remove(string_to_array(v_normalized, ' '), '');

  RETURN QUERY
    SELECT sub.id AS factura_id, sub.score::INTEGER AS relevancia
    FROM (
      SELECT
        f.id,
        (
          public.normalize_text(COALESCE(f.numero_factura, '')) || ' ' ||
          public.normalize_text(COALESCE(f.concepto, '')) || ' ' ||
          public.normalize_text(COALESCE(f.emisor_nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(f.receptor_nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(u.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(u.email, '')) || ' ' ||
          COALESCE(f.total::TEXT, '')
        ) AS searchable,
        (CASE WHEN public.normalize_text(COALESCE(f.numero_factura, '')) LIKE '%' || v_normalized || '%' THEN 10 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(f.concepto, '')) LIKE '%' || v_normalized || '%' THEN 8 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(f.emisor_nombre, '')) LIKE '%' || v_normalized || '%' THEN 6 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(f.receptor_nombre, '')) LIKE '%' || v_normalized || '%' THEN 6 ELSE 0 END) +
        (CASE WHEN public.normalize_text(COALESCE(u.nombre, '')) LIKE '%' || v_normalized || '%' THEN 4 ELSE 0 END)
        AS score
      FROM public.ventas_facturas f
      LEFT JOIN public.usuarios u ON u.id = f.usuario_id
      WHERE (v_uid IS NULL OR f.usuario_id = v_uid)
    ) sub
    WHERE (
      SELECT bool_and(sub.searchable LIKE '%' || term || '%')
      FROM unnest(v_terms) AS term
    )
    ORDER BY sub.score DESC, sub.id
    LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
