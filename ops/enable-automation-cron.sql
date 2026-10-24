-- DO NOT RUN UNTIL HANA approves the reviewed SHA, budget and source-transfer scope.
-- Create a strong HANA_WORKER_TOKEN server-side; store the same value in Vault as
-- hana_worker_token. Store the existing publishable API key as hana_publishable_key.
-- Neither value belongs in this SQL file, the chat or GitHub.
-- Enable pg_cron / pg_net in Dashboard first; keep free plan, do not upgrade.
select cron.schedule('hana-automation-tick','*/5 * * * *',$cron$
 select net.http_post(
  url:='https://ihmvziqisputjnjkuhvm.supabase.co/functions/v1/hana-automation',
  headers:=jsonb_build_object('Content-Type','application/json',
   'apikey',(select decrypted_secret from vault.decrypted_secrets where name='hana_publishable_key'),
   'x-hana-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='hana_worker_token')),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 );
$cron$);
-- Emergency stop: set HANA_AUTOMATION_ENABLED=false, then pause the project in WORKSPACE.
-- Inspect any already-running provider call; pausing does not undo a request already sent.
