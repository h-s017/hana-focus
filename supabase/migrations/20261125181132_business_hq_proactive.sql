-- Schema only. Production scheduling is a separate, approved operation.
create table if not exists public.hana_hq_profiles (
 owner_id uuid primary key references auth.users(id),
 positioning text not null check (length(positioning) between 1 and 1000),
 ideal_customer text not null check (length(ideal_customer) between 1 and 1000),
 offer text not null check (length(offer) between 1 and 600),
 district text not null default '' check (length(district)<=30),
 signals text not null check (length(signals) between 1 and 240),
 daily_limit integer not null default 3 check (daily_limit between 1 and 5),
 run_at time not null default '08:00',
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);

create table if not exists public.hana_hq_daily_runs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.hana_hq_profiles(owner_id),
 local_day date not null,
 status text not null check (status in ('running','completed','partial','failed')),
 scheduled_for timestamptz not null,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 report jsonb not null default '{}',
 unique(owner_id,local_day)
);

alter table public.hana_hq_profiles enable row level security;
alter table public.hana_hq_daily_runs enable row level security;
revoke all on public.hana_hq_profiles,public.hana_hq_daily_runs from public,anon,authenticated;
grant select,insert,update on public.hana_hq_profiles,public.hana_hq_daily_runs to service_role;

create or replace function public.hana_hq_profile(p_owner uuid,p_profile jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 if p_profile is not null then
  insert into public.hana_hq_profiles(owner_id,positioning,ideal_customer,offer,district,signals,daily_limit,run_at,enabled)
  values(p_owner,p_profile->>'positioning',p_profile->>'ideal_customer',p_profile->>'offer',p_profile->>'district',p_profile->>'signals',
   (p_profile->>'daily_limit')::integer,(p_profile->>'run_at')::time,(p_profile->>'enabled')::boolean)
  on conflict(owner_id) do update set positioning=excluded.positioning,ideal_customer=excluded.ideal_customer,
   offer=excluded.offer,district=excluded.district,signals=excluded.signals,daily_limit=excluded.daily_limit,run_at=excluded.run_at,
   enabled=excluded.enabled,updated_at=now();
 end if;
 return jsonb_build_object('profile',(select to_jsonb(p)-'owner_id' from public.hana_hq_profiles p where owner_id=p_owner),
  'runs',coalesce((select jsonb_agg(to_jsonb(r)-'owner_id' order by r.local_day desc)
   from (select * from public.hana_hq_daily_runs where owner_id=p_owner order by local_day desc limit 14) r),'[]'::jsonb));
end $$;

create or replace function public.hana_hq_daily_claim(p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 local_now timestamp := now() at time zone 'Asia/Taipei';
 profile public.hana_hq_profiles%rowtype;
 run_id uuid;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 update public.hana_hq_daily_runs set status='failed',finished_at=now(),report=jsonb_build_object('errors',jsonb_build_array('worker_timeout'))
 where owner_id=p_owner and status='running' and started_at<now()-interval '5 minutes';
 select * into profile from public.hana_hq_profiles where owner_id=p_owner and enabled;
 if not found or local_now::time<profile.run_at then return null;end if;
 insert into public.hana_hq_daily_runs(owner_id,local_day,status,scheduled_for)
 values(p_owner,local_now::date,'running',(local_now::date+profile.run_at) at time zone 'Asia/Taipei')
 on conflict(owner_id,local_day) do nothing returning id into run_id;
 if run_id is null then return null;end if;
 return jsonb_build_object('id',run_id,'profile',to_jsonb(profile)-'owner_id',
  'known',coalesce((select jsonb_agg(jsonb_build_object('domain',canonical_domain,'branch',branch_key,'record',evidence->0->>'record_id'))
   from public.hana_business_opportunities where owner_id=p_owner),'[]'::jsonb));
end $$;

create or replace function public.hana_hq_daily_finish(p_owner uuid,p_id uuid,p_status text,p_report jsonb,p_candidates jsonb,p_skill jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 r public.hana_hq_daily_runs%rowtype;
 c jsonb;
 claim jsonb;
 receipt jsonb;
 task_id uuid;
 opportunity_id uuid;
 saved jsonb:='[]';
 duplicates integer:=0;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 if p_status is null or p_status not in ('completed','partial','failed') or jsonb_typeof(p_candidates) is distinct from 'array' or
    jsonb_array_length(p_candidates)>5 or length(p_candidates::text)>120000 or length(p_report::text)>18000 then raise exception 'hq_invalid_input';end if;
 select * into r from public.hana_hq_daily_runs where owner_id=p_owner and id=p_id for update;
 if not found or r.status<>'running' then raise exception 'hq_stale_attempt';end if;
 for c in select value from jsonb_array_elements(p_candidates) loop
  if exists(select 1 from public.hana_business_opportunities where owner_id=p_owner and
   ((canonical_domain=c->>'canonical_domain' and (branch_key='' or branch_key=c->>'branch_key')) or evidence->0->>'record_id'=c->'evidence'->0->>'record_id')) then
   duplicates:=duplicates+1;
   continue;
  end if;
  claim:=public.hana_hq_start(p_owner,gen_random_uuid(),jsonb_build_object('workspace','work','goal','審核商機及安排後續聯繫：'||(c->>'company_name'),'daily_run_id',p_id),p_skill,false);
  task_id:=(claim->>'task_id')::uuid;
  receipt:=public.hana_hq_finish(p_owner,(claim->>'run_id')::uuid,(claim->>'attempt_token')::uuid,
   jsonb_build_object('state','review','sources',c->'evidence','tool_results',jsonb_build_array(jsonb_build_object('tool','government-directory','status','verified')),
    'output',jsonb_build_object('goal','商務開發候選｜待人工審核','mode','daily_research','daily_run_id',p_id,
     'deliverables',jsonb_build_array(jsonb_build_object('company_name',c->>'company_name','stage','proposal_draft')),'approval_required',true),
    'opportunities',jsonb_build_array(c)));
  opportunity_id:=(receipt->'opportunity_ids'->>0)::uuid;
  -- A concurrent manual save can win hq_finish's existing unique-key race.
  update public.hana_business_opportunities set next_followup_at=r.scheduled_for+interval '1 day'
   where owner_id=p_owner and id=opportunity_id and linked_task_id=task_id;
  if found then
   saved:=saved||jsonb_build_array(jsonb_build_object('opportunity_id',opportunity_id,'task_id',task_id,'company_name',c->>'company_name',
    'fit_score',c->'fit_score','source_url',c->>'source_url','development_rank',jsonb_array_length(saved)+1));
  else
   -- Roll back the entire transaction instead of leaving an orphan review task.
   raise exception 'hq_state_conflict';
  end if;
 end loop;
 update public.hana_hq_daily_runs set status=p_status,finished_at=now(),
  report=p_report||jsonb_build_object('saved',saved,'duplicates_at_save',duplicates,'external_messages_sent',0) where id=p_id;
 return jsonb_build_object('status',p_status,'saved',jsonb_array_length(saved));
end $$;

revoke all on function public.hana_hq_profile(uuid,jsonb),public.hana_hq_daily_claim(uuid),public.hana_hq_daily_finish(uuid,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hana_hq_profile(uuid,jsonb),public.hana_hq_daily_claim(uuid),public.hana_hq_daily_finish(uuid,uuid,text,jsonb,jsonb,jsonb) to service_role;
