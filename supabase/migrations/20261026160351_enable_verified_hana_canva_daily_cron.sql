-- Production migration already applied and verified on 2026-10-26.
-- Only enable after the protected Canva Worker has passed live
-- anonymous 401 and Vault-authenticated HTTP 200 tests.
DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM cron.job
   WHERE jobname='hana-canva-daily-import' AND schedule='45 0-15 * * *' AND active=false
 ) THEN RAISE EXCEPTION 'Canva Cron schedule is not in reviewed paused state'; END IF;
 IF to_regclass('public.hana_canva_import_jobs') IS NULL
    OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='hana_canva_daily_worker_secret')
 THEN RAISE EXCEPTION 'Required private import storage or Vault token is missing'; END IF;
END $$;
SELECT cron.alter_job(
 (SELECT jobid FROM cron.job WHERE jobname='hana-canva-daily-import'),
 active => true
);
