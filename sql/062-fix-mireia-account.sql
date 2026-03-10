-- Fix: Create Mireia's usuarios row if it doesn't exist
-- She exists in auth.users but may be missing from usuarios table
-- Run AFTER confirming with diagnostic (061)

-- Get her auth UUID and create the usuarios row
INSERT INTO usuarios (id, email, nombre, tipo, activo, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'nombre', 'Mireia'),
  'equipo',
  true,
  au.created_at,
  now()
FROM auth.users au
WHERE au.email = 'mireia@madrigalmarketing.es'
ON CONFLICT (id) DO UPDATE SET activo = true, updated_at = now();

-- Ensure she has her ventas role (setter)
INSERT INTO ventas_roles_comerciales (id, usuario_id, rol, activo, created_at)
SELECT
  gen_random_uuid(),
  u.id,
  'setter',
  true,
  now()
FROM usuarios u
WHERE u.email = 'mireia@madrigalmarketing.es'
AND NOT EXISTS (
  SELECT 1 FROM ventas_roles_comerciales vrc
  WHERE vrc.usuario_id = u.id AND vrc.activo = true
);

-- Verify
SELECT u.id, u.email, u.nombre, u.tipo, u.activo, vrc.rol
FROM usuarios u
LEFT JOIN ventas_roles_comerciales vrc ON vrc.usuario_id = u.id AND vrc.activo = true
WHERE u.email = 'mireia@madrigalmarketing.es';
