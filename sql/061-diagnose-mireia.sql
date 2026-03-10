-- Diagnostic: check if Mireia exists and her status
-- Run this in Supabase SQL Editor

-- 1. Check if she exists in usuarios
SELECT id, email, nombre, tipo, activo, rol_id, created_at
FROM usuarios
WHERE email = 'mireia@madrigalmarketing.es';

-- 2. Check if she exists in auth.users
SELECT id, email, created_at, last_sign_in_at, email_confirmed_at
FROM auth.users
WHERE email = 'mireia@madrigalmarketing.es';

-- 3. Check her ventas role
SELECT vrc.*
FROM ventas_roles_comerciales vrc
JOIN usuarios u ON u.id = vrc.usuario_id
WHERE u.email = 'mireia@madrigalmarketing.es';

-- 4. Test the RPC directly
SELECT obtener_usuario_completo('mireia@madrigalmarketing.es');
