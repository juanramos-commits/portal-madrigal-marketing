-- Anti No-Show cron schedule
-- EXECUTE THIS ONLY WHEN READY TO ACTIVATE THE SYSTEM
-- Run every 5 minutes

SELECT cron.schedule(
  'noshow-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/noshow-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdG5jZ3RjdnducnNrcXRhbWFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3NzAyNiwiZXhwIjoyMDg0MjUzMDI2fQ.kgycS-nYJhQmSzjv3wjo-H8kAg56F1dRxKCtrD03FiI'
    ),
    body := '{}'::jsonb
  );
  $$
);
