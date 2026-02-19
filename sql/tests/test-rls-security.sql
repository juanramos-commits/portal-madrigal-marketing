-- =============================================
-- TESTS DE RLS - Ejecutar en SQL Editor
-- =============================================

-- TEST 1: Verificar que TODAS las tablas tienen RLS
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = false;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'FALLO: % tablas sin RLS activado', v_count;
  ELSE
    RAISE NOTICE 'OK: Todas las tablas tienen RLS activado';
  END IF;
END $$;

-- TEST 2: Verificar que TODAS las tablas con RLS tienen al menos una política
DO $$
DECLARE
  v_tabla RECORD;
  v_count INTEGER;
  v_fallos INTEGER := 0;
BEGIN
  FOR v_tabla IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = v_tabla.tablename;

    IF v_count = 0 THEN
      RAISE WARNING 'FALLO: Tabla "%" tiene RLS activado pero 0 políticas (BLOQUEADA)', v_tabla.tablename;
      v_fallos := v_fallos + 1;
    END IF;
  END LOOP;

  IF v_fallos = 0 THEN
    RAISE NOTICE 'OK: Todas las tablas con RLS tienen políticas';
  ELSE
    RAISE EXCEPTION 'FALLO: % tablas con RLS pero sin políticas', v_fallos;
  END IF;
END $$;

-- TEST 3: Verificar que tiene_permiso funciona correctamente
DO $$
DECLARE
  v_super_admin_id UUID;
  v_resultado BOOLEAN;
BEGIN
  SELECT id INTO v_super_admin_id FROM usuarios WHERE tipo = 'super_admin' LIMIT 1;

  IF v_super_admin_id IS NULL THEN
    RAISE WARNING 'No se encontró Super Admin para test';
    RETURN;
  END IF;

  SELECT tiene_permiso(v_super_admin_id, 'clientes.eliminar') INTO v_resultado;
  IF v_resultado = true THEN
    RAISE NOTICE 'OK: Super Admin tiene permiso clientes.eliminar';
  ELSE
    RAISE EXCEPTION 'FALLO: Super Admin NO tiene permiso clientes.eliminar';
  END IF;
END $$;

-- TEST 4: Contar permisos por módulo
SELECT modulo, COUNT(*) as total
FROM permisos
GROUP BY modulo
ORDER BY modulo;

-- TEST 5: Verificar triggers de auditoría activos
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'audit_%'
ORDER BY event_object_table;

-- TEST 6: Verificar triggers de alertas activos
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'alert_%'
ORDER BY event_object_table;

-- TEST 7: Verificar funciones de seguridad
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'tiene_permiso', 'obtener_permisos_usuario', 'registrar_auditoria',
    'fn_audit_trigger', 'get_user_protected_fields', 'check_rate_limit',
    'generar_alerta_seguridad', 'cuenta_bloqueada', 'limpiar_datos_temporales',
    'limpiar_rate_limits', 'verificar_integridad_seguridad'
  )
ORDER BY routine_name;

-- TEST 8: Verificar que no hay tablas sin políticas (con RLS activo)
SELECT t.tablename, t.rowsecurity,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') as num_policies
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY t.tablename;
