-- Apply only after approval of the production schedule and target owner.
-- Use the same dedicated worker token in Vault and the Edge Function secret.
-- Store the approved owner UUID in Vault as hana_hq_worker_owner_id and set the same Edge owner.
-- Keep HANA_HQ_SCHEDULE_AI_ENABLED off until model costs and data scope are approved.
select cron.schedule('hana-hq-daily-research','*/5 * * * *',$tick$
 select net.http_post(
  url:='https://ihmvziqisputjnjkuhvm.supabase.co/functions/v1/hana-automation/hq-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-hana-hq-worker',secret.decrypted_secret),
  body:='{}'::jsonb,
  timeout_milliseconds:=90000
 )
 from vault.decrypted_secrets secret
 where secret.name='hana_hq_worker_token'
   and exists (
    select 1 from public.hana_hq_profiles p
    where p.owner_id::text=(select decrypted_secret from vault.decrypted_secrets where name='hana_hq_worker_owner_id')
     and p.enabled and p.run_at<=(now() at time zone 'Asia/Taipei')::time
     and not exists (select 1 from public.hana_hq_daily_runs r where r.owner_id=p.owner_id
      and r.local_day=(now() at time zone 'Asia/Taipei')::date and
      (r.status<>'running' or r.started_at>=now()-interval '5 minutes'))
   );
$tick$);
