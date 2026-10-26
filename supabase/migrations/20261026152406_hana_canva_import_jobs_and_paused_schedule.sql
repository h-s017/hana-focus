-- HANA AI OFFICE Canva import jobs: idempotent per owner and lesson date.
-- Privileged Edge Function writes only; browser receives safe status and design URL.
CREATE TABLE IF NOT EXISTS public.hana_canva_import_jobs (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_date date NOT NULL,
  job_id text,
  status text NOT NULL DEFAULT 'reserved',
  design_id text,
  edit_url text,
  page_count integer,
  error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, lesson_date),
  CONSTRAINT hana_canva_import_status_chk CHECK (status IN ('reserved','submitting','in_progress','success','failed','needs_verification')),
  CONSTRAINT hana_canva_import_page_count_chk CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 150),
  CONSTRAINT hana_canva_import_design_id_chk CHECK (design_id IS NULL OR design_id ~ '^[A-Za-z0-9_-]{6,64}$')
);
ALTER TABLE public.hana_canva_import_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hana_canva_import_jobs FROM PUBLIC, anon, authenticated;
-- service_role, already bound by the Edge Function to a verified HANA owner, is sole writer.

-- Worker token is generated inside the database and encrypted with Supabase Vault.
-- No plaintext token is committed to GitHub or returned to the caller.

SELECT vault.create_secret(
  encode(extensions.gen_random_bytes(32),'hex'),
  'hana_canva_daily_worker_secret',
  'Internal HANA Canva daily import scheduler token; do not disclose'
)
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='hana_canva_daily_worker_secret');

CREATE OR REPLACE FUNCTION public.hana_canva_worker_verify(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, extensions, vault, public
AS $$
  SELECT coalesce(
    length(p_token)=64 AND EXISTS (
      SELECT 1 FROM vault.decrypted_secrets v
      WHERE v.name='hana_canva_daily_worker_secret'
      AND extensions.digest(convert_to(v.decrypted_secret,'UTF8'),'sha256')
       =extensions.digest(convert_to(p_token,'UTF8'),'sha256')
    ),false
  );
$$;
REVOKE ALL ON FUNCTION public.hana_canva_worker_verify(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hana_canva_worker_verify(text) TO service_role;

SELECT cron.schedule(
 'hana-canva-daily-import',
 '45 0-15 * * *',
 $job$
 SELECT net.http_post(
  url := 'https://ihmvziqisputjnjkuhvm.supabase.co/functions/v1/hana-automation/canva-worker',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'x-hana-canva-worker',(
       SELECT decrypted_secret FROM vault.decrypted_secrets
       WHERE name='hana_canva_daily_worker_secret'
       LIMIT 1
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 25000
 ) AS request_id;
 $job$
);

-- The Canva import Edge worker is not deployed yet. Register the schedule
-- but do NOT activate it until the worker has passed E2E verification.
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname='hana-canva-daily-import'),
  active => false
);

GRANT SELECT, INSERT, UPDATE ON TABLE public.hana_canva_import_jobs TO service_role;
