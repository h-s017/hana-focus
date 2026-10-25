-- Release candidate only. No cron, paid calls, existing task changes or external writes.
-- Invoker RPCs need only these three Auth columns to reject revoked/deleted owners.
-- Supabase service_role does not have auth.users SELECT by default; do not grant email or other columns.
grant select(id,deleted_at,raw_app_meta_data) on auth.users to service_role;
create table public.hana_automation_settings (
 owner_id uuid not null references auth.users(id), project text not null check(length(btrim(project)) between 1 and 100 and project=btrim(project)),
 enabled boolean not null default false, daily_limit integer not null default 3 check(daily_limit between 1 and 6),
 scope_note text not null default '' check(length(scope_note)<=2000),
 source_item_id text check(length(source_item_id) between 1 and 200),
 source_read_allowed boolean not null default false,
 updated_at timestamptz not null default now(), primary key(owner_id,project),
 check(not source_read_allowed or source_item_id is not null)
);
create table public.hana_connector_credentials (
 owner_id uuid not null references auth.users(id), kind text not null check(kind in ('pending','microsoft','google')),
 ciphertext text not null, version uuid not null default gen_random_uuid(),
 primary key(owner_id,kind)
);
create table public.hana_automation_events (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 project text not null,task_id uuid references public.hana_tasks(id),run_id uuid references public.hana_task_runs(id),
 code text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.hana_automation_settings enable row level security;
alter table public.hana_connector_credentials enable row level security;
alter table public.hana_automation_events enable row level security;
revoke all on public.hana_automation_settings,public.hana_connector_credentials,public.hana_automation_events from anon,authenticated;
grant all on public.hana_automation_settings,public.hana_connector_credentials,public.hana_automation_events to service_role;
grant select on public.hana_automation_settings,public.hana_automation_events to authenticated;
create policy automation_settings_owner on public.hana_automation_settings for select to authenticated
using ((select auth.uid())=owner_id and (select auth.jwt()->'app_metadata'->>'hana_office_access')='true');
create policy automation_events_owner on public.hana_automation_events for select to authenticated
using ((select auth.uid())=owner_id and (select auth.jwt()->'app_metadata'->>'hana_office_access')='true');

-- Both reservation and spend caps are checked atomically. A single owner has at most one running task.
create function public.hana_automation_claim(p_cap integer default 3) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t record; v_run uuid; v_day timestamptz := date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
begin
 if p_cap is null or p_cap not between 1 and 10 then raise exception 'invalid_cap'; end if;
 for t in select q.*,s.daily_limit,s.scope_note,s.source_item_id,s.source_read_allowed
 from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='queued' and u.deleted_at is null
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

create function public.hana_automation_advance() returns integer
language plpgsql security invoker set search_path='' as $$
declare t record; n integer:=0; v_child uuid;
begin
 for t in select q.* from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='approved' and u.deleted_at is null and u.raw_app_meta_data->>'hana_office_access'='true'
 and not(q.role='Project Manager' and q.parent_task_id is not null)
 and not exists(select 1 from public.hana_tasks c where c.parent_task_id=q.id)
 order by q.created_at limit 10 for update of q,s skip locked
 loop
  v_child:=public.hana_handoff_task(t.owner_id,t.id,gen_random_uuid());
  insert into public.hana_automation_events(owner_id,project,task_id,code,details) values(t.owner_id,t.project,t.id,'handoff',jsonb_build_object('child_task_id',v_child));
  n:=n+1;
 end loop;
 return n;
end $$;

-- Stale/failed work is never silently rerun or automatically billed again.
create function public.hana_automation_recover() returns integer
language plpgsql security invoker set search_path='' as $$
declare t record; n integer:=0;
begin
 for t in select q.* from public.hana_tasks q
 where q.status='running' and q.updated_at<now()-interval '10 minutes'
 and exists(select 1 from public.hana_automation_events e where e.task_id=q.id and e.run_id=q.active_run_id and e.code='claimed')
 order by q.updated_at limit 10 for update skip locked
 loop
  perform public.hana_recover_task(t.owner_id,t.id);
  insert into public.hana_automation_events(owner_id,project,task_id,code) values(t.owner_id,t.project,t.id,'stale_requires_review');n:=n+1;
 end loop;
 return n;
end $$;
create function public.hana_automation_retry(p_owner uuid,p_task uuid) returns text
language plpgsql security invoker set search_path='' as $$
begin
 update public.hana_tasks set status='queued',updated_at=now() where id=p_task and owner_id=p_owner and status='failed'
 and (select count(*) from public.hana_task_runs r where r.task_id=p_task)<3;
 if not found then raise exception 'retry_not_available'; end if;
 insert into public.hana_automation_events(owner_id,project,task_id,code) select owner_id,project,id,'human_retry' from public.hana_tasks where id=p_task;
 return 'queued';
end $$;
revoke all on function public.hana_automation_claim(integer),public.hana_automation_advance(),public.hana_automation_recover(),public.hana_automation_retry(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_automation_claim(integer),public.hana_automation_advance(),public.hana_automation_recover(),public.hana_automation_retry(uuid,uuid) to service_role;
