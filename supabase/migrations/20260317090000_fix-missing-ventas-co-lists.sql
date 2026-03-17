-- Fix: create missing ventas_co_lists table referenced by a trigger on ventas_leads
CREATE TABLE IF NOT EXISTS ventas_co_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES ventas_leads(id) ON DELETE CASCADE,
  list_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
