-- Composite index for ventas_notificaciones
-- Replaces the 3 single-column indexes with one composite that covers all query patterns:
--   1. Count unread:   WHERE usuario_id = X AND leida = false
--   2. Load all:       WHERE usuario_id = X ORDER BY created_at DESC
--   3. Load unread:    WHERE usuario_id = X AND leida = false ORDER BY created_at DESC

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vn_usuario_leida_created
  ON ventas_notificaciones (usuario_id, leida, created_at DESC);

-- Drop the now-redundant single-column indexes
DROP INDEX IF EXISTS idx_vn_usuario;
DROP INDEX IF EXISTS idx_vn_leida;
DROP INDEX IF EXISTS idx_vn_created;
