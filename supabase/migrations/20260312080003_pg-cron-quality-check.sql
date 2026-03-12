-- =====================================================
-- pg_cron: Schedule ia-quality-check-cron hourly
-- =====================================================

-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule ia-quality-check-cron to run every hour
SELECT cron.schedule(
  'ia-quality-check-cron',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/ia-quality-check-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdG5jZ3RjdnducnNrcXRhbWFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3NzAyNiwiZXhwIjoyMDg0MjUzMDI2fQ.kgycS-nYJhQmSzjv3wjo-H8kAg56F1dRxKCtrD03FiI'
    ),
    body := '{}'::jsonb
  );
  $$
);
