-- Candidate only. Does not create a cron job, activate a worker, or change Reservation.
-- Stores private planning drafts, never customers, orders or payments.
create table public.hana_monthly_drafts(
 owner_id uuid not null references auth.users(id),
 month text not null check(month ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
 revision integer not null check(revision>0),
 policy jsonb not null default '{}',overrides jsonb not null default '{}',generated jsonb not null,
 state text not null check(state in ('pending','unverified','approved_internal','rejected')),
 schedule_enabled boolean not null default false,
 updated_at timestamptz not null default now(),primary key(owner_id,month)
);
alter table public.hana_monthly_drafts enable row level security;
create policy hana_monthly_owner_read on public.hana_monthly_drafts for select to authenticated
 using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
revoke all on public.hana_monthly_drafts from anon,authenticated;
grant select on public.hana_monthly_drafts to authenticated;
grant all on public.hana_monthly_drafts to service_role;
create function public.hana_monthly_save(p_owner uuid,p_month text,p_revision integer,p_request uuid,p_policy jsonb,p_overrides jsonb,p_generated jsonb,p_changed jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare old public.hana_monthly_drafts%rowtype;receipt public.hana_automation_events%rowtype;new_state text;
begin
 if p_owner is null or p_request is null or p_month is null or p_month!~'^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' or p_revision is null or p_revision<0 or p_policy is null or p_overrides is null or p_generated is null or p_changed is null or jsonb_typeof(p_policy)<>'object' or jsonb_typeof(p_overrides)<>'object' or jsonb_typeof(p_changed)<>'array' or octet_length(p_generated::text)>250000 then raise exception 'invalid_monthly';end if;
 if (p_generated->>'month') is distinct from p_month or (p_generated->>'externalWrites') is distinct from 'false' or (p_generated->>'published') is distinct from 'false' then raise exception 'invalid_monthly';end if;
 if not exists(select 1 from auth.users where id=p_owner and deleted_at is null and raw_app_meta_data->>'hana_office_access'='true') then raise exception 'access_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_month,73));
 select * into receipt from public.hana_automation_events where id=p_request;
 if found then
  if receipt.owner_id<>p_owner or receipt.code<>'monthly_saved' or receipt.details->>'month' is distinct from p_month then raise exception 'monthly_conflict';end if;
  return (select to_jsonb(d) from public.hana_monthly_drafts d where owner_id=p_owner and month=p_month);
 end if;
 select * into old from public.hana_monthly_drafts where owner_id=p_owner and month=p_month for update;
 if coalesce(old.revision,0)<>p_revision then raise exception 'monthly_conflict';end if;
 new_state:=case when p_generated->>'sourceVerified'='true' and p_generated->>'policyConfigured'='true' then 'pending' else 'unverified' end;
 insert into public.hana_monthly_drafts(owner_id,month,revision,policy,overrides,generated,state)
 values(p_owner,p_month,p_revision+1,p_policy,p_overrides,p_generated,new_state)
 on conflict(owner_id,month) do update set revision=excluded.revision,policy=excluded.policy,overrides=excluded.overrides,generated=excluded.generated,state=excluded.state,updated_at=now();
 insert into public.hana_automation_events(id,owner_id,project,code,details)
 values(p_request,p_owner,'課程預約','monthly_saved',jsonb_build_object('month',p_month,'action','monthly_generate','revision',p_revision+1,'previous_revision',p_revision,'changed_dates',p_changed,'previous_state',old.state,'external_writes',false));
 return (select to_jsonb(d) from public.hana_monthly_drafts d where owner_id=p_owner and month=p_month);
end $$;
create function public.hana_monthly_review(p_owner uuid,p_month text,p_revision integer,p_decision text,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare draft public.hana_monthly_drafts%rowtype;
begin
 if p_decision is null or p_decision not in ('approved','rejected') or p_request is null then raise exception 'invalid_monthly';end if;
 select * into draft from public.hana_monthly_drafts where owner_id=p_owner and month=p_month for update;
 if not found or draft.revision<>p_revision or draft.state not in ('pending','unverified') then raise exception 'monthly_conflict';end if;
 if p_decision='approved' and (draft.state<>'pending' or (draft.generated->>'sourceVerified') is distinct from 'true' or (draft.generated->>'policyConfigured') is distinct from 'true' or draft.generated->>'checkedAt' is null or (draft.generated->>'checkedAt')::timestamptz<now()-interval '30 minutes') then raise exception 'monthly_unavailable';end if;
 update public.hana_monthly_drafts set state=case when p_decision='approved' then 'approved_internal' else 'rejected' end,updated_at=now() where owner_id=p_owner and month=p_month;
 insert into public.hana_automation_events(id,owner_id,project,code,details) values(p_request,p_owner,'課程預約','monthly_reviewed',jsonb_build_object('month',p_month,'action','monthly_review','revision',p_revision,'decision',p_decision,'external_writes',false));
 return (select to_jsonb(d) from public.hana_monthly_drafts d where owner_id=p_owner and month=p_month);
end $$;
create function public.hana_monthly_scheduled() returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select distinct on(d.owner_id) d.owner_id,d.policy from public.hana_monthly_drafts d join auth.users u on u.id=d.owner_id
 where d.schedule_enabled and d.policy<>'{}'::jsonb and u.deleted_at is null and u.raw_app_meta_data->>'hana_office_access'='true'
 order by d.owner_id,d.updated_at desc limit 10
 ) x;
$$;
create function public.hana_monthly_claim_day(p_owner uuid,p_clock timestamptz) returns boolean language plpgsql security invoker set search_path='' as $$
declare local_day date:=(p_clock at time zone 'Asia/Taipei')::date;last_day date;target text;
begin
 if p_clock is null or extract(hour from p_clock at time zone 'Asia/Taipei')<>8 then return false;end if;
 last_day:=(date_trunc('month',local_day::timestamp)+interval '1 month - 1 day')::date;
 if local_day<last_day-4 then return false;end if;
 if not exists(select 1 from public.hana_monthly_drafts d join auth.users u on u.id=d.owner_id where d.owner_id=p_owner and d.schedule_enabled and d.policy<>'{}'::jsonb and u.deleted_at is null and u.raw_app_meta_data->>'hana_office_access'='true') then return false;end if;
 target:=to_char(local_day+interval '1 month','YYYY-MM');
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||local_day::text,74));
 if exists(select 1 from public.hana_automation_events where owner_id=p_owner and code='monthly_day_claimed' and details->>'run_day'=local_day::text) then return false;end if;
 insert into public.hana_automation_events(owner_id,project,code,details) values(p_owner,'課程預約','monthly_day_claimed',jsonb_build_object('run_day',local_day,'target_month',target,'external_writes',false));
 return true;
end $$;
revoke all on function public.hana_monthly_save(uuid,text,integer,uuid,jsonb,jsonb,jsonb,jsonb),public.hana_monthly_review(uuid,text,integer,text,uuid),public.hana_monthly_scheduled(),public.hana_monthly_claim_day(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.hana_monthly_save(uuid,text,integer,uuid,jsonb,jsonb,jsonb,jsonb),public.hana_monthly_review(uuid,text,integer,text,uuid),public.hana_monthly_scheduled(),public.hana_monthly_claim_day(uuid,timestamptz) to service_role;
