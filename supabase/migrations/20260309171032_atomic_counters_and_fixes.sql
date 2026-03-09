-- ============================================================
-- 055: Atomic counter RPCs + security fixes
-- ============================================================

-- Atomic increment for inbox sent_today (cold outreach)
CREATE OR REPLACE FUNCTION co_increment_inbox_sent_today(p_inbox_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ventas_co_inboxes
  SET sent_today = COALESCE(sent_today, 0) + 1
  WHERE id = p_inbox_id;
$$;

-- Generic atomic increment for email marketing campaign counters
CREATE OR REPLACE FUNCTION em_increment_campaign_counter(
  p_campaign_id UUID,
  p_counter TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE ventas_em_campaigns SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
    p_counter, p_counter
  ) USING p_campaign_id;
END;
$$;

-- Generic atomic increment for email marketing contact counters
CREATE OR REPLACE FUNCTION em_increment_contact_counter(
  p_contact_id UUID,
  p_counter TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE ventas_em_contacts SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
    p_counter, p_counter
  ) USING p_contact_id;
END;
$$;

-- Aggregated contact stats (avoids fetching all rows to count in JS)
CREATE OR REPLACE FUNCTION em_contact_stats_agg()
RETURNS TABLE(
  total BIGINT,
  active BIGINT,
  unsubscribed BIGINT,
  bounced BIGINT,
  avg_engagement NUMERIC,
  avg_lead_score NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'active') AS active,
    COUNT(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribed,
    COUNT(*) FILTER (WHERE status = 'bounced') AS bounced,
    COALESCE(AVG(engagement_score), 0) AS avg_engagement,
    COALESCE(AVG(lead_score), 0) AS avg_lead_score
  FROM ventas_em_contacts;
$$;
