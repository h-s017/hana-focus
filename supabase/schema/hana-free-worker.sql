-- NT$0 worker: PM rules only. No provider key or paid request.
create function public.hana_automation_claim_rules(p_cap integer default 3) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t record; v_run uuid; v_day timestamptz := date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
begin
 if p_cap is null or p_cap not between 1 and 10 then raise exception 'invalid_cap'; end if;
 for t in select q.*,s.daily_limit,s.scope_note,s.source_item_id,s.source_read_allowed
 from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='queued' and q.role='Project Manager' and u.deleted_at is null
 and u.raw_app_meta_data->>'hana_office_access'='true'
 and (q.parent_task_id is null or exists(select 1 from public.hana_tasks p where p.id=q.parent_task_id and p.owner_id=q.owner_id and p.status='approved'))
 order by q.created_at limit 100 for update of q,s skip locked
 loop
  if not pg_try_advisory_xact_lock(hashtextextended(t.owner_id::text,41)) then continue; end if;
  if exists(select 1 from public.hana_tasks r where r.owner_id=t.owner_id and r.status='running') then continue; end if;
  if (select count(*) from public.hana_task_runs r where r.owner_id=t.owner_id and r.created_at>=v_day)>=p_cap then continue; end if;
  if (select count(*) from public.hana_task_runs r join public.hana_tasks q on q.id=r.task_id where r.owner_id=t.owner_id and q.project=t.project and r.created_at>=v_day)>=t.daily_limit then continue; end if;
  if (select count(*) from public.hana_task_runs r where r.task_id=t.id)>=3 then continue; end if;
  v_run:=public.hana_claim_task(t.owner_id,t.id,gen_random_uuid());
  insert into public.hana_automation_events(owner_id,project,task_id,run_id,code) values(t.owner_id,t.project,t.id,v_run,'claimed');
  return to_jsonb(t)||jsonb_build_object('run_id',v_run);
 end loop;
 return null;
end $$;

revoke all on function public.hana_automation_claim_rules(integer) from public,anon,authenticated;
grant execute on function public.hana_automation_claim_rules(integer) to service_role;
create schema if not exists hana_private;
revoke all on schema hana_private from public,anon,authenticated;
grant usage on schema hana_private to service_role;
-- Narrow private definer is necessary to compare one Vault secret without granting
-- service_role access to decrypted secrets. Never returns the secret or digest.
create function hana_private.worker_token_matches(p_token text) returns boolean
language sql security definer set search_path='' as $$
 select length(p_token) between 32 and 256 and exists(
  select 1 from vault.decrypted_secrets where name='hana_worker_token'
  and length(decrypted_secret)>=32
  and extensions.digest(p_token,'sha256')=extensions.digest(decrypted_secret,'sha256')
 );
$$;
revoke all on function hana_private.worker_token_matches(text) from public,anon,authenticated;
grant execute on function hana_private.worker_token_matches(text) to service_role;
create function public.hana_worker_authorized(p_token text) returns boolean
language sql security invoker set search_path='' as $$select hana_private.worker_token_matches(p_token)$$;
revoke all on function public.hana_worker_authorized(text) from public,anon,authenticated;
grant execute on function public.hana_worker_authorized(text) to service_role;
