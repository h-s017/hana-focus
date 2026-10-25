-- Change requests only: never duplicates or modifies the reservation system's orders/slots.
create table public.hana_booking_changes (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),request_id uuid not null,
 target text not null check(target in ('slot','order')),target_id text not null check(length(target_id) between 1 and 140),
 proposal jsonb not null,source_snapshot jsonb not null,source_verified boolean not null default false,
 state text not null default 'pending' check(state in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),reviewed_at timestamptz,
 unique(owner_id,request_id)
);
alter table public.hana_booking_changes enable row level security;
revoke all on public.hana_booking_changes from anon,authenticated;
grant select on public.hana_booking_changes to authenticated;
grant all on public.hana_booking_changes to service_role;
create policy booking_changes_owner on public.hana_booking_changes for select to authenticated
using ((select auth.uid())=owner_id and (select auth.jwt()->'app_metadata'->>'hana_office_access')='true');
create function public.hana_booking_save(p_owner uuid,p_request uuid,p_target text,p_target_id text,p_proposal jsonb,p_snapshot jsonb,p_verified boolean) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v uuid; old public.hana_booking_changes%rowtype;
begin
 insert into public.hana_booking_changes(owner_id,request_id,target,target_id,proposal,source_snapshot,source_verified)
 values(p_owner,p_request,p_target,p_target_id,p_proposal,p_snapshot,p_verified)
 on conflict(owner_id,request_id) do nothing returning id into v;
 if v is null then
  select * into old from public.hana_booking_changes where owner_id=p_owner and request_id=p_request;
  if old.target<>p_target or old.target_id<>p_target_id or old.proposal<>p_proposal then raise exception 'request_conflict';end if;
  return old.id;
 end if;
 insert into public.hana_automation_events(owner_id,project,code,details) values(p_owner,'課程預約','booking_change_draft',jsonb_build_object('change_id',v,'external_writes',false));
 return v;
end $$;
create function public.hana_booking_review(p_owner uuid,p_change uuid,p_decision text) returns text
language plpgsql security invoker set search_path='' as $$
declare t public.hana_booking_changes%rowtype;
begin
 if p_decision not in ('approved','rejected') then raise exception 'invalid_decision';end if;
 select * into t from public.hana_booking_changes where id=p_change and owner_id=p_owner for update;
 if not found or t.state<>'pending' then raise exception 'state_conflict';end if;
 if p_decision='approved' and not t.source_verified then raise exception 'source_unverified';end if;
 update public.hana_booking_changes set state=p_decision,reviewed_at=now() where id=t.id;
 insert into public.hana_automation_events(owner_id,project,code,details) values(p_owner,'課程預約','booking_change_review',jsonb_build_object('change_id',t.id,'decision',p_decision,'external_writes',false));
 return p_decision;
end $$;
revoke all on function public.hana_booking_save(uuid,uuid,text,text,jsonb,jsonb,boolean),public.hana_booking_review(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.hana_booking_save(uuid,uuid,text,text,jsonb,jsonb,boolean),public.hana_booking_review(uuid,uuid,text) to service_role;
