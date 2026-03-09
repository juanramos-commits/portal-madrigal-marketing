-- ============================================================================
-- 048 - Email Marketing: Cron Jobs (pg_cron + pg_net)
-- Tareas programadas para envío de campañas, automatizaciones,
-- scoring con IA y rollup de analytics.
-- ============================================================================


-- ─── 1. Envío de campañas — cada 1 minuto ─────────────────────────────────────

SELECT cron.schedule(
    'em-send-campaign',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/em-send-campaign',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{"action":"send"}'::jsonb
    );
    $$
);


-- ─── 2. Worker de automatizaciones — cada 5 minutos ──────────────────────────

SELECT cron.schedule(
    'em-automation-worker',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/em-automation-worker',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);


-- ─── 3. Scoring con IA — diario a las 01:00 UTC ──────────────────────────────

SELECT cron.schedule(
    'em-ai-scoring',
    '0 1 * * *',
    $$
    SELECT net.http_post(
        url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/em-ai-scoring',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);


-- ─── 4. Rollup de analytics — diario a las 02:00 UTC ─────────────────────────

SELECT cron.schedule(
    'em-analytics-rollup',
    '0 2 * * *',
    $$
    SELECT net.http_post(
        url := 'https://ootncgtcvwnrskqtamak.supabase.co/functions/v1/em-analytics-rollup',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);


-- ============================================================================
-- FIN 048
-- ============================================================================
