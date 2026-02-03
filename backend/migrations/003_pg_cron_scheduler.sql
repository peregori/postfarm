-- Migration: Enable pg_cron and schedule post publishing
-- Run this in Supabase SQL Editor after enabling pg_cron extension

-- Step 1: Enable pg_cron extension (do this in Dashboard → Database → Extensions first)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Enable pg_net extension for HTTP requests from pg_cron
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 3: Schedule the Edge Function to run every minute
-- Replace <PROJECT_REF> with your Supabase project reference
-- Replace <SERVICE_ROLE_KEY> with your service role key

/*
SELECT cron.schedule(
  'publish-scheduled-posts',    -- job name
  '* * * * *',                   -- every minute
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/publish-scheduled-posts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To view job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To unschedule:
-- SELECT cron.unschedule('publish-scheduled-posts');
