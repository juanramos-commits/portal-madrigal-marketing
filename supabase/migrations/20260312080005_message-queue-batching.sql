-- Message queue for batching/debounce (7-second window)
-- When a lead sends multiple messages quickly, they get batched into one Claude call

CREATE TABLE IF NOT EXISTS ia_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES ia_conversaciones(id),
  mensaje_id UUID NOT NULL REFERENCES ia_mensajes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_ia_mq_conv_unprocessed ON ia_message_queue (conversacion_id, created_at DESC) WHERE processed = FALSE;
