-- Additive P0.1: reuse tasks/runs/reviews; no data rewrites, cron or external operations.
alter table public.hana_task_runs add column if not exists skill_id text;
alter table public.hana_task_runs add column if not exists skill_version text;
alter table public.hana_task_runs add column if not exists skill_hash text;
alter table public.hana_task_runs add column if not exists skill_source text;
alter table public.hana_task_runs add column if not exists skill_state text;
alter table public.hana_task_runs add column if not exists skill_input jsonb;
alter table public.hana_task_runs add column if not exists skill_input_hash text;
alter table public.hana_task_runs add column if not exists skill_sources jsonb not null default '[]';
alter table public.hana_task_runs add column if not exists skill_tool_results jsonb not null default '[]';
alter table public.hana_task_runs add column if not exists skill_output jsonb;
alter table public.hana_task_runs add column if not exists skill_error_code text;
alter table public.hana_task_runs add column if not exists skill_attempt integer;
alter table public.hana_task_runs add column if not exists skill_attempt_token uuid;
alter table public.hana_task_runs add column if not exists skill_started_at timestamptz;
alter table public.hana_task_runs add column if not exists skill_history jsonb not null default '[]';
create unique index if not exists hana_tasks_owner_id_unique on public.hana_tasks(owner_id,id);
create index if not exists hana_hq_runs_owner on public.hana_task_runs(owner_id,created_at desc) where skill_id is not null;

create table if not exists public.hana_business_opportunities(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 workspace text not null default 'work' check(workspace='work'),
 company_name text not null check(length(company_name) between 2 and 140),
 website text not null check(website like 'https://%' and length(website)<=2000),
 canonical_domain text not null check(canonical_domain=lower(canonical_domain) and canonical_domain ~ '^[a-z0-9][a-z0-9.-]+\.[a-z]+$'),
 branch_key text not null default '' check(length(branch_key)<=100),branch_reason text not null default '' check(length(branch_reason)<=500),
 public_business_contact text,source_url text check(source_url like 'https://%'),source_checked_at timestamptz,
 evidence_excerpt_or_summary text,evidence jsonb not null default '[]' check(jsonb_typeof(evidence)='array'),
 fit_reason text not null,fit_score integer check(fit_score between 0 and 10),score_components jsonb,
 stage text not null default 'identified' check(stage in ('identified','qualified','proposal_draft','approved','contacted','negotiating','won','lost')),
 draft text,next_followup_at timestamptz,linked_task_id uuid not null,revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(owner_id,linked_task_id) references public.hana_tasks(owner_id,id),unique(owner_id,canonical_domain,branch_key),
 check(branch_key='' or length(branch_reason)>0),
 check(stage='identified' or (source_url is not null and source_checked_at is not null and fit_score is not null and jsonb_array_length(evidence)>0))
);
create index if not exists hana_opportunity_followup on public.hana_business_opportunities(owner_id,stage,next_followup_at);
alter table public.hana_business_opportunities enable row level security;
revoke all on public.hana_business_opportunities from public,anon,authenticated;
grant select on public.hana_business_opportunities to authenticated;
grant all on public.hana_business_opportunities to service_role;
drop policy if exists hq_owner_read on public.hana_business_opportunities;
create policy hq_owner_read on public.hana_business_opportunities for select to authenticated using(
 (select auth.uid())=owner_id and workspace='work' and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');

-- New skill tasks cannot be advanced/reviewed by legacy Agent workers.
create or replace function public.hana_hq_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.source_system='business_hq' and coalesce(current_setting('hana.hq_write',true),'')<>old.id::text then raise exception 'hq_state_conflict';end if;
 return new;
end $$;
drop trigger if exists hana_hq_task_guard on public.hana_tasks;
create trigger hana_hq_task_guard before update on public.hana_tasks for each row execute function public.hana_hq_guard();

create or replace function public.hana_hq_start(p_owner uuid,p_request uuid,p_input jsonb,p_skill jsonb,p_retry boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.hana_task_runs%rowtype;t uuid;token uuid:=gen_random_uuid();h text;history jsonb;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 if p_input->>'workspace' is distinct from 'work' or p_request is null or length(p_input::text)>60000 or coalesce(p_skill->>'id','') not in ('corporate-strategy','operations-management','sales-marketing','people-management','research-development','financial-management','business-systemization') or coalesce(p_skill->>'hash','') !~ '^[0-9a-f]{64}$' then raise exception 'hq_invalid_input';end if;
 h:=public.hana_focus_hash(jsonb_build_object('input',p_input,'skill',p_skill));
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_request::text,0));
 select * into r from public.hana_task_runs where owner_id=p_owner and request_id=p_request for update;
 if found then
  if r.skill_input_hash is distinct from h then raise exception 'hq_request_conflict';end if;
  if not coalesce(p_retry,false) or r.skill_state not in ('blocked','failed','rejected','running') or (r.skill_state='running' and coalesce(r.skill_started_at,r.created_at)>now()-interval '5 minutes') then return jsonb_build_object('claimed',false,'run_id',r.id,'state',r.skill_state);end if;
  if r.skill_attempt>=5 then raise exception 'hq_state_conflict';end if;
  history:=r.skill_history||jsonb_build_array(jsonb_build_object('attempt',r.skill_attempt,'state',r.skill_state,'sources',r.skill_sources,'tools',r.skill_tool_results,'output',r.skill_output,'error',r.skill_error_code,'finished_at',r.finished_at));
  perform set_config('hana.hq_write',r.task_id::text,true);
  update public.hana_tasks set status='running',active_run_id=r.id,updated_at=now() where id=r.task_id and owner_id=p_owner;
  update public.hana_task_runs set status='running',skill_state='running',skill_attempt=skill_attempt+1,skill_attempt_token=token,skill_history=history,skill_started_at=now(),finished_at=null,skill_error_code=null where id=r.id;
  return jsonb_build_object('claimed',true,'run_id',r.id,'task_id',r.task_id,'attempt_token',token,'state','running');
 end if;
 t:=gen_random_uuid();
 insert into public.hana_tasks(id,owner_id,project,role,title,brief,status,source_system,assigned_role,request_id)
 values(t,p_owner,'HQ · '||t::text,'Project Manager',left(p_input->>'goal',140),left(p_input::text,12000),'running','business_hq',p_skill->>'id',p_request);
 insert into public.hana_task_runs(task_id,owner_id,request_id,status,skill_id,skill_version,skill_hash,skill_source,skill_state,skill_input,skill_input_hash,skill_attempt,skill_attempt_token,skill_started_at)
 values(t,p_owner,p_request,'running',p_skill->>'id',p_skill->>'version',p_skill->>'hash',p_skill->>'source','running',p_input,h,1,token,now()) returning * into r;
 perform set_config('hana.hq_write',t::text,true);update public.hana_tasks set active_run_id=r.id where id=t;
 return jsonb_build_object('claimed',true,'run_id',r.id,'task_id',t,'attempt_token',token,'state','running');
end $$;

create or replace function public.hana_hq_finish(p_owner uuid,p_run uuid,p_attempt uuid,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.hana_task_runs%rowtype;c jsonb;v_id uuid;ids jsonb:='[]';v_state text:=p_payload->>'state';v_result text;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 select * into r from public.hana_task_runs where id=p_run and owner_id=p_owner and skill_id is not null for update;
 if not found or r.skill_state<>'running' or r.skill_attempt_token is distinct from p_attempt then raise exception 'hq_stale_attempt';end if;
 if v_state is null or v_state not in ('blocked','failed','review') or length(p_payload::text)>200000 or coalesce(jsonb_array_length(p_payload->'opportunities'),0)>10 then raise exception 'hq_invalid_input';end if;
 for c in select value from jsonb_array_elements(p_payload->'opportunities') loop
  if c->>'stage' not in ('identified','proposal_draft','qualified') then raise exception 'hq_invalid_stage';end if;
  if c->>'stage'<>'identified' and (c->>'source_checked_at' is null or not exists(select 1 from jsonb_array_elements(c->'evidence') e where e->>'verified'='true' and e->>'company_name_confirmed'='true')) then raise exception 'hq_invalid_stage';end if;
  insert into public.hana_business_opportunities as existing(owner_id,company_name,website,canonical_domain,branch_key,branch_reason,public_business_contact,source_url,source_checked_at,evidence_excerpt_or_summary,evidence,fit_reason,fit_score,score_components,stage,draft,next_followup_at,linked_task_id)
  values(p_owner,c->>'company_name',c->>'website',c->>'canonical_domain',coalesce(c->>'branch_key',''),coalesce(c->>'branch_reason',''),c->>'public_business_contact',c->>'source_url',(c->>'source_checked_at')::timestamptz,c->>'evidence_excerpt_or_summary',c->'evidence',c->>'fit_reason',(c->>'fit_score')::integer,c->'score_components',c->>'stage',c->>'draft',null,r.task_id)
  on conflict(owner_id,canonical_domain,branch_key) do update set public_business_contact=excluded.public_business_contact,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,evidence_excerpt_or_summary=excluded.evidence_excerpt_or_summary,evidence=excluded.evidence,fit_reason=excluded.fit_reason,fit_score=excluded.fit_score,score_components=excluded.score_components,stage=excluded.stage,draft=excluded.draft,revision=existing.revision+1,updated_at=now()
  where existing.linked_task_id=r.task_id and existing.stage in ('identified','qualified','proposal_draft') returning id into v_id;
  if v_id is null then select id into v_id from public.hana_business_opportunities where owner_id=p_owner and canonical_domain=c->>'canonical_domain' and branch_key=coalesce(c->>'branch_key','');end if;
  ids:=ids||jsonb_build_array(v_id);v_id:=null;
 end loop;
 v_result:=left('規則式商務草稿｜待 HANA 審核，未聯絡客戶'||E'\n'||coalesce(p_payload->'output'->>'goal','')||E'\n'||coalesce((p_payload->'output'->'deliverables')::text,''),45000);
 perform set_config('hana.hq_write',r.task_id::text,true);
 update public.hana_task_runs set status=case when v_state='review' then 'review' else 'failed' end,skill_state=v_state,skill_sources=p_payload->'sources',skill_tool_results=p_payload->'tool_results',skill_output=(p_payload->'output')||jsonb_build_object('opportunity_ids',ids),skill_error_code=p_payload->>'error_code',result=v_result,finished_at=now() where id=r.id;
 update public.hana_tasks set status=case when v_state='review' then 'review' else 'failed' end,result=v_result,active_run_id=null,updated_at=now() where id=r.task_id and owner_id=p_owner;
 return jsonb_build_object('status',v_state,'run_id',r.id,'opportunity_ids',ids,'external_delivery',false);
end $$;

create or replace function public.hana_hq_snapshot(p_owner uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 return jsonb_build_object(
  'opportunities',coalesce((select jsonb_agg(x order by x.updated_at desc) from (select * from public.hana_business_opportunities where owner_id=p_owner and workspace='work' order by updated_at desc limit 200) x),'[]'::jsonb),
  'runs',coalesce((select jsonb_agg(x order by x.created_at desc) from (select * from public.hana_task_runs where owner_id=p_owner and skill_id is not null order by created_at desc limit 100) x),'[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(x order by x.created_at desc) from (select v.* from public.hana_reviews v join public.hana_task_runs r on r.task_id=v.task_id and r.owner_id=v.owner_id where v.owner_id=p_owner and r.skill_id is not null order by v.created_at desc limit 200) x),'[]'::jsonb));
end $$;

create or replace function public.hana_hq_review(p_owner uuid,p_run uuid,p_decision text,p_note text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.hana_task_runs%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 select * into r from public.hana_task_runs where owner_id=p_owner and id=p_run and skill_id is not null for update;
 if not found or r.skill_state<>'review' or p_decision not in ('approved','rejected') then raise exception 'hq_state_conflict';end if;
 perform set_config('hana.hq_write',r.task_id::text,true);perform public.hana_review_task(p_owner,r.task_id,p_decision,p_note);
 update public.hana_task_runs set skill_state=p_decision where id=r.id;
 if p_decision='approved' then update public.hana_business_opportunities set stage='approved',revision=revision+1,updated_at=now() where owner_id=p_owner and linked_task_id=r.task_id and stage='proposal_draft';end if;
 return jsonb_build_object('status',p_decision,'external_delivery',false,'contacted',false);
end $$;

create or replace function public.hana_hq_followup(p_owner uuid,p_id uuid,p_revision integer,p_next timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 if p_next is not null and p_next<now() then raise exception 'hq_invalid_input';end if;
 update public.hana_business_opportunities set next_followup_at=p_next,revision=revision+1,updated_at=now() where owner_id=p_owner and id=p_id and revision=p_revision;
 get diagnostics n=row_count;if n<>1 then raise exception 'hq_state_conflict';end if;
 return jsonb_build_object('saved',true,'external_delivery',false);
end $$;

create or replace function public.hana_hq_track(p_owner uuid,p_id uuid,p_revision integer,p_stage text,p_note text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.hana_business_opportunities%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required';end if;
 if length(btrim(coalesce(p_note,'')))<10 or length(p_note)>2000 then raise exception 'hq_manual_record_required';end if;
 select * into c from public.hana_business_opportunities where owner_id=p_owner and id=p_id and revision=p_revision for update;
 if not found then raise exception 'hq_state_conflict';end if;
 if p_stage is null or not ((c.stage='approved' and p_stage='contacted') or (c.stage in ('contacted','negotiating') and p_stage in ('negotiating','won','lost'))) then raise exception 'hq_invalid_stage';end if;
 update public.hana_business_opportunities set stage=p_stage,revision=revision+1,updated_at=now() where id=c.id;
 insert into public.hana_reviews(owner_id,task_id,decision,note) values(p_owner,c.linked_task_id,'comment','人工紀錄：'||p_stage||E'\n'||p_note);
 return jsonb_build_object('status',p_stage,'record_source','human_record','external_delivery',false);
end $$;
revoke all on function public.hana_hq_start(uuid,uuid,jsonb,jsonb,boolean),public.hana_hq_finish(uuid,uuid,uuid,jsonb),public.hana_hq_snapshot(uuid),public.hana_hq_review(uuid,uuid,text,text),public.hana_hq_followup(uuid,uuid,integer,timestamptz),public.hana_hq_track(uuid,uuid,integer,text,text),public.hana_hq_guard() from public,anon,authenticated;
grant execute on function public.hana_hq_start(uuid,uuid,jsonb,jsonb,boolean),public.hana_hq_finish(uuid,uuid,uuid,jsonb),public.hana_hq_snapshot(uuid),public.hana_hq_review(uuid,uuid,text,text),public.hana_hq_followup(uuid,uuid,integer,timestamptz),public.hana_hq_track(uuid,uuid,integer,text,text),public.hana_hq_guard() to service_role;
