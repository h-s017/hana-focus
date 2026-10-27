-- Additive; no production activation or schedule. All writes pass authenticated Edge controls.
alter table public.hana_connector_credentials drop constraint hana_connector_credentials_kind_check;
alter table public.hana_connector_credentials add constraint hana_connector_credentials_kind_check check(kind in ('pending','microsoft','google','canva','google_sync'));
alter table public.hana_tasks add column schedule_start_at timestamptz;
alter table public.hana_tasks add column schedule_end_at timestamptz;
alter table public.hana_tasks add constraint hana_task_schedule_window check(
 (schedule_start_at is null and schedule_end_at is null) or
 (schedule_start_at is not null and schedule_end_at is not null and schedule_end_at>schedule_start_at and schedule_end_at<=schedule_start_at+interval '7 days'));
create table public.hana_calendar_links(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 kind text not null check(kind in ('slot','task')),source_id text not null,month text not null,
 event_id text not null,base_source jsonb,base_google jsonb,
 pending jsonb,status text not null default 'ready' check(status in ('ready','pending','rejected','conflict','unknown')),
 revision integer not null default 1,updated_at timestamptz not null default now(),
 unique(owner_id,kind,source_id),unique(owner_id,event_id)
);
alter table public.hana_calendar_links enable row level security;
revoke all on public.hana_calendar_links from public,anon,authenticated;
grant all on public.hana_calendar_links to service_role;
create table public.hana_calendar_sync_locks(owner_id uuid primary key references auth.users(id),token uuid not null,expires_at timestamptz not null);
alter table public.hana_calendar_sync_locks enable row level security;
revoke all on public.hana_calendar_sync_locks from public,anon,authenticated;
grant all on public.hana_calendar_sync_locks to service_role;
create function public.hana_calendar_sync_lock(p_owner uuid,p_token uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'office_access_required';end if;
 insert into public.hana_calendar_sync_locks values(p_owner,p_token,now()+interval '10 minutes')
 on conflict(owner_id) do update set token=p_token,expires_at=now()+interval '10 minutes' where public.hana_calendar_sync_locks.expires_at<now();
 return found;
end $$;
revoke all on function public.hana_calendar_sync_lock(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_calendar_sync_lock(uuid,uuid) to service_role;
