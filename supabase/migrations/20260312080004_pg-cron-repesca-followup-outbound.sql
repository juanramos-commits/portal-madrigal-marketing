-- =====================================================
-- pg_cron: Schedule repesca, followup, and outbound crons
-- =====================================================

-- ia-repesca-cron: every 30 minutes
SELECT cron.schedule(
  'ia-repesca-cron',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/ia-repesca-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdG5jZ3RjdnducnNrcXRhbWFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3NzAyNiwiZXhwIjoyMDg0MjUzMDI2fQ.kgycS-nYJhQmSzjv3wjo-H8kAg56F1dRxKCtrD03FiI'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ia-followup-cron: every 15 minutes
SELECT cron.schedule(
  'ia-followup-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/ia-followup-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdG5jZ3RjdnducnNrcXRhbWFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3NzAyNiwiZXhwIjoyMDg0MjUzMDI2fQ.kgycS-nYJhQmSzjv3wjo-H8kAg56F1dRxKCtrD03FiI'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ia-secuencia-outbound-cron: every 15 minutes
SELECT cron.schedule(
  'ia-secuencia-outbound-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/ia-secuencia-outbound-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdG5jZ3RjdnducnNrcXRhbWFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3NzAyNiwiZXhwIjoyMDg0MjUzMDI2fQ.kgycS-nYJhQmSzjv3wjo-H8kAg56F1dRxKCtrD03FiI'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Storage RLS: allow authenticated users to upload to ia-media bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ia-media', 'ia-media', true, 10485760, ARRAY['image/*','audio/*','video/*','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
DO $$ BEGIN
  DROP POLICY IF EXISTS "ia_media_insert" ON storage.objects;
  CREATE POLICY "ia_media_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ia-media');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Allow public read access
DO $$ BEGIN
  DROP POLICY IF EXISTS "ia_media_select" ON storage.objects;
  CREATE POLICY "ia_media_select" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'ia-media');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
