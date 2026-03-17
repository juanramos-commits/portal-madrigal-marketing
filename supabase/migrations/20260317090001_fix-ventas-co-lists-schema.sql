-- Drop and recreate ventas_co_lists with all expected columns
DROP TABLE IF EXISTS ventas_co_lists CASCADE;
CREATE TABLE ventas_co_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES ventas_leads(id) ON DELETE CASCADE,
  list_id UUID,
  name TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
