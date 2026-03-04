-- Columnas para sincronizacion bidireccional Google Calendar (push notifications)
ALTER TABLE ventas_calendario_config
  ADD COLUMN IF NOT EXISTS google_channel_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_resource_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_channel_expiration BIGINT,
  ADD COLUMN IF NOT EXISTS google_sync_token TEXT;
