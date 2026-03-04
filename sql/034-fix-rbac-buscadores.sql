-- ============================================================================
-- 034 - FIX SEGURIDAD: Buscadores no confían en p_user_role del cliente
-- ============================================================================
-- PROBLEMA: Las funciones de búsqueda aceptaban p_user_role como parámetro
-- del frontend, permitiendo a cualquier usuario autenticado pasar
-- 'super_admin' y ver todos los datos.
-- FIX: Se ignora p_user_role y se usa ventas_es_admin_o_director() que
-- consulta auth.uid() internamente.
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ventas_buscar_leads — FIX RBAC
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_leads(
  p_query TEXT,
  p_pipeline_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,      -- se mantiene la firma para no romper el frontend
  p_user_role TEXT DEFAULT NULL,     -- IGNORADO: se calcula internamente
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  lead_id UUID,
  relevancia INTEGER
) AS $fn$
DECLARE
  v_terms TEXT[];
  v_normalized_query TEXT;
  v_is_admin BOOLEAN;
  v_real_user_id UUID;
BEGIN
  v_normalized_query := public.normalize_text(TRIM(COALESCE(p_query, '')));
  v_is_admin := ventas_es_admin_o_director();
  v_real_user_id := auth.uid()::uuid;

  -- Empty query: return all leads with RBAC
  IF v_normalized_query = '' THEN
    RETURN QUERY
      SELECT l.id AS lead_id, 0::INTEGER AS relevancia
      FROM public.ventas_leads l
      WHERE (p_pipeline_id IS NULL OR EXISTS (
        SELECT 1 FROM public.ventas_lead_pipeline lp2
        WHERE lp2.lead_id = l.id AND lp2.pipeline_id = p_pipeline_id
      ))
      AND (
        v_is_admin
        OR l.setter_asignado_id = v_real_user_id
        OR l.closer_asignado_id = v_real_user_id
      )
      ORDER BY l.created_at DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Split query into individual terms
  v_terms := array_remove(string_to_array(v_normalized_query, ' '), '');

  RETURN QUERY
    SELECT
      sub.id AS lead_id,
      sub.score::INTEGER AS relevancia
    FROM (
      SELECT
        l.id,
        (
          public.normalize_text(COALESCE(l.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(l.email, '')) || ' ' ||
          public.normalize_text(COALESCE(l.nombre_negocio, '')) || ' ' ||
          public.normalize_text(COALESCE(cat.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(l.fuente, '')) || ' ' ||
          public.normalize_text(COALESCE(setter_u.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(closer_u.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(etapa.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(l.notas, '')) || ' ' ||
          public.normalize_text(COALESCE(l.contactos_adicionales, '')) || ' ' ||
          public.normalize_text(COALESCE(l.resumen_setter, '')) || ' ' ||
          public.normalize_text(COALESCE(l.resumen_closer, '')) || ' ' ||
          public.normalize_text(COALESCE(l.enlace_grabacion, '')) || ' ' ||
          COALESCE((
            SELECT string_agg(public.normalize_text(et.nombre), ' ')
            FROM public.ventas_lead_etiquetas le
            JOIN public.ventas_etiquetas et ON et.id = le.etiqueta_id
            WHERE le.lead_id = l.id
          ), '')
        ) AS search_text,
        regexp_replace(COALESCE(l.telefono, ''), '[^0-9]', '', 'g') AS phone_digits,
        (
          CASE WHEN public.normalize_text(COALESCE(l.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 100 ELSE 0 END +
          CASE WHEN regexp_replace(v_normalized_query, '[^0-9]', '', 'g') != ''
               AND regexp_replace(COALESCE(l.telefono, ''), '[^0-9]', '', 'g')
                   LIKE '%' || regexp_replace(v_normalized_query, '[^0-9]', '', 'g') || '%'
               THEN 90 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.email, '')) LIKE '%' || v_normalized_query || '%' THEN 80 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.nombre_negocio, '')) LIKE '%' || v_normalized_query || '%' THEN 70 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(cat.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 60 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.fuente, '')) LIKE '%' || v_normalized_query || '%' THEN 50 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(setter_u.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 40 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(closer_u.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 40 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(etapa.nombre, '')) LIKE '%' || v_normalized_query || '%' THEN 30 ELSE 0 END +
          CASE WHEN EXISTS (
            SELECT 1 FROM public.ventas_lead_etiquetas le
            JOIN public.ventas_etiquetas et ON et.id = le.etiqueta_id
            WHERE le.lead_id = l.id AND public.normalize_text(et.nombre) LIKE '%' || v_normalized_query || '%'
          ) THEN 30 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.notas, '')) LIKE '%' || v_normalized_query || '%' THEN 20 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.contactos_adicionales, '')) LIKE '%' || v_normalized_query || '%' THEN 20 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.resumen_setter, '')) LIKE '%' || v_normalized_query || '%' THEN 10 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.resumen_closer, '')) LIKE '%' || v_normalized_query || '%' THEN 10 ELSE 0 END +
          CASE WHEN public.normalize_text(COALESCE(l.enlace_grabacion, '')) LIKE '%' || v_normalized_query || '%' THEN 5 ELSE 0 END
        ) AS score,
        l.created_at
      FROM public.ventas_leads l
      LEFT JOIN public.ventas_categorias cat ON cat.id = l.categoria_id
      LEFT JOIN public.usuarios setter_u ON setter_u.id = l.setter_asignado_id
      LEFT JOIN public.usuarios closer_u ON closer_u.id = l.closer_asignado_id
      LEFT JOIN public.ventas_lead_pipeline lp ON lp.lead_id = l.id AND lp.pipeline_id = p_pipeline_id
      LEFT JOIN public.ventas_etapas etapa ON etapa.id = lp.etapa_id
      WHERE
        (p_pipeline_id IS NULL OR lp.pipeline_id IS NOT NULL)
        AND (
          v_is_admin
          OR l.setter_asignado_id = v_real_user_id
          OR l.closer_asignado_id = v_real_user_id
        )
    ) sub
    WHERE COALESCE((
      SELECT bool_and(
        sub.search_text LIKE '%' || t || '%'
        OR (
          regexp_replace(t, '[^0-9]', '', 'g') != ''
          AND sub.phone_digits LIKE '%' || regexp_replace(t, '[^0-9]', '', 'g') || '%'
        )
      )
      FROM unnest(v_terms) AS t
    ), FALSE)
    ORDER BY sub.score DESC, sub.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. ventas_buscar_ventas — FIX RBAC
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_ventas(
  p_query TEXT,
  p_estado TEXT DEFAULT NULL,
  p_es_devolucion BOOLEAN DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,      -- se mantiene la firma
  p_user_role TEXT DEFAULT NULL,     -- IGNORADO
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  venta_id UUID,
  relevancia INTEGER,
  total_count BIGINT
) AS $fn$
DECLARE
  v_normalized_query TEXT;
  v_terms TEXT[];
  v_is_admin BOOLEAN;
  v_real_user_id UUID;
BEGIN
  v_normalized_query := public.normalize_text(TRIM(COALESCE(p_query, '')));
  v_is_admin := ventas_es_admin_o_director();
  v_real_user_id := auth.uid()::uuid;

  IF v_normalized_query = '' THEN
    RETURN QUERY
      SELECT
        v.id,
        0::INTEGER,
        COUNT(*) OVER ()
      FROM public.ventas_ventas v
      WHERE
        (p_estado IS NULL OR v.estado = p_estado)
        AND (p_es_devolucion IS NULL OR v.es_devolucion = p_es_devolucion)
        AND (
          v_is_admin
          OR v.setter_id = v_real_user_id
          OR v.closer_id = v_real_user_id
        )
      ORDER BY v.fecha_venta DESC, v.created_at DESC
      LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  v_terms := array_remove(string_to_array(v_normalized_query, ' '), '');

  RETURN QUERY
    WITH base AS (
      SELECT
        v.id AS vid,
        (
          public.normalize_text(COALESCE(lead.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(lead.email, '')) || ' ' ||
          public.normalize_text(COALESCE(lead.nombre_negocio, '')) || ' ' ||
          public.normalize_text(COALESCE(paq.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(v.metodo_pago, '')) || ' ' ||
          public.normalize_text(COALESCE(v.estado, '')) || ' ' ||
          public.normalize_text(COALESCE(setter.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(closer.nombre, '')) || ' ' ||
          public.normalize_text(COALESCE(v.notas, '')) || ' ' ||
          CAST(v.importe AS TEXT) || ' ' ||
          TO_CHAR(v.fecha_venta, 'DD/MM/YYYY')
        ) AS search_text,
        regexp_replace(COALESCE(lead.telefono, ''), '[^0-9]', '', 'g') AS phone_digits,
        COALESCE((
          SELECT SUM(
            CASE WHEN public.normalize_text(COALESCE(lead.nombre, '')) LIKE '%' || t || '%' THEN 100 ELSE 0 END
            + CASE WHEN regexp_replace(t, '[^0-9]', '', 'g') != ''
                 AND regexp_replace(COALESCE(lead.telefono, ''), '[^0-9]', '', 'g')
                     LIKE '%' || regexp_replace(t, '[^0-9]', '', 'g') || '%'
                 THEN 90 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(lead.email, '')) LIKE '%' || t || '%' THEN 80 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(lead.nombre_negocio, '')) LIKE '%' || t || '%' THEN 70 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(paq.nombre, '')) LIKE '%' || t || '%' THEN 60 ELSE 0 END
            + CASE WHEN CAST(v.importe AS TEXT) LIKE '%' || t || '%' THEN 50 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(v.metodo_pago, '')) LIKE '%' || t || '%' THEN 40 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(v.estado, '')) LIKE '%' || t || '%' THEN 30 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(setter.nombre, '')) LIKE '%' || t || '%' THEN 30 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(closer.nombre, '')) LIKE '%' || t || '%' THEN 30 ELSE 0 END
            + CASE WHEN TO_CHAR(v.fecha_venta, 'DD/MM/YYYY') LIKE '%' || t || '%' THEN 20 ELSE 0 END
            + CASE WHEN public.normalize_text(COALESCE(v.notas, '')) LIKE '%' || t || '%' THEN 10 ELSE 0 END
          )
          FROM unnest(v_terms) AS t
        ), 0)::INTEGER AS rel
      FROM public.ventas_ventas v
      LEFT JOIN public.ventas_leads lead ON lead.id = v.lead_id
      LEFT JOIN public.ventas_paquetes paq ON paq.id = v.paquete_id
      LEFT JOIN public.usuarios setter ON setter.id = v.setter_id
      LEFT JOIN public.usuarios closer ON closer.id = v.closer_id
      WHERE
        (p_estado IS NULL OR v.estado = p_estado)
        AND (p_es_devolucion IS NULL OR v.es_devolucion = p_es_devolucion)
        AND (
          v_is_admin
          OR v.setter_id = v_real_user_id
          OR v.closer_id = v_real_user_id
        )
    ),
    filtered AS (
      SELECT b.vid, b.rel FROM base b
      WHERE COALESCE((
        SELECT bool_and(
          b.search_text LIKE '%' || t || '%'
          OR (
            regexp_replace(t, '[^0-9]', '', 'g') != ''
            AND b.phone_digits LIKE '%' || regexp_replace(t, '[^0-9]', '', 'g') || '%'
          )
        )
        FROM unnest(v_terms) AS t
      ), FALSE)
    )
    SELECT
      f.vid,
      f.rel,
      COUNT(*) OVER () AS total_count
    FROM filtered f
    ORDER BY f.rel DESC
    LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. ventas_buscar_comisiones — FIX RBAC
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_comisiones(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,      -- se mantiene la firma
  p_user_role TEXT DEFAULT NULL,     -- IGNORADO
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
  v_is_admin BOOLEAN;
  v_real_user_id UUID;
BEGIN
  v_normalized := public.normalize_text(TRIM(COALESCE(p_query, '')));
  v_is_admin := ventas_es_admin_o_director();
  v_real_user_id := auth.uid()::uuid;

  -- Determine effective user: admins can filter by user, others see only their own
  IF v_is_admin THEN
    v_uid := NULLIF(p_filtro_usuario_id, NULL);
  ELSE
    v_uid := v_real_user_id;
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
-- 4. ventas_buscar_retiros — FIX RBAC
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_retiros(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,      -- se mantiene la firma
  p_user_role TEXT DEFAULT NULL,     -- IGNORADO
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
  v_real_user_id UUID;
BEGIN
  v_normalized := public.normalize_text(TRIM(COALESCE(p_query, '')));
  v_is_admin := ventas_es_admin_o_director();
  v_real_user_id := auth.uid()::uuid;

  -- Empty query
  IF v_normalized = '' THEN
    RETURN QUERY
      SELECT r.id AS retiro_id, 0::INTEGER AS relevancia
      FROM public.ventas_retiros r
      WHERE (v_is_admin OR r.usuario_id = v_real_user_id)
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
      WHERE (v_is_admin OR r.usuario_id = v_real_user_id)
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
-- 5. ventas_buscar_facturas — FIX RBAC
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ventas_buscar_facturas(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,      -- se mantiene la firma
  p_user_role TEXT DEFAULT NULL,     -- IGNORADO
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
  v_real_user_id UUID;
  v_uid UUID;
BEGIN
  v_normalized := public.normalize_text(TRIM(COALESCE(p_query, '')));
  v_is_admin := ventas_es_admin_o_director();
  v_real_user_id := auth.uid()::uuid;

  IF v_is_admin THEN
    v_uid := NULLIF(p_filtro_usuario_id, NULL);
  ELSE
    v_uid := v_real_user_id;
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

-- ══════════════════════════════════════════════════════════════════════════════
-- Permisos (mantener los existentes)
-- ══════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.ventas_buscar_leads(TEXT, UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_buscar_ventas(TEXT, TEXT, BOOLEAN, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_buscar_comisiones(TEXT, UUID, TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_buscar_retiros(TEXT, UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_buscar_facturas(TEXT, UUID, TEXT, UUID, INTEGER, INTEGER) TO authenticated;
