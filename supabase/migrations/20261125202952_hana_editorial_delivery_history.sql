-- Versioned assets and review receipts for the existing HANA FOCUS.
-- Scheduling, provider authorization and publication are outside this migration.
create table if not exists public.hana_editorial_versions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 local_day date not null,
 kind text not null check(kind in ('sensory','service_marketing','founder_story')),
 version integer not null check(version between 1 and 20),
 state text not null check(state in ('scheduled','running','partial','blocked','failed','ready_for_review','approved','revision_required','published')),
 payload jsonb not null default '{}',
 evidence jsonb not null default '{}',
 missing jsonb not null default '[]',
 error_code text,
 started_at timestamptz,
 finished_at timestamptz,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 unique(owner_id,local_day,kind,version)
);
alter table public.hana_editorial_versions enable row level security;
revoke all on public.hana_editorial_versions from public,anon,authenticated;
grant select,insert,update on public.hana_editorial_versions to service_role;

create or replace function public.hana_editorial_list(p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'editorial_owner_required';end if;
 return coalesce((select jsonb_agg(to_jsonb(v)-'owner_id' order by v.local_day desc,v.kind,v.version desc)
 from (select * from public.hana_editorial_versions where owner_id=p_owner order by local_day desc,kind,version desc limit 180) v),'[]'::jsonb);
end $$;

create or replace function public.hana_editorial_claim(p_owner uuid,p_day date,p_kind text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.hana_editorial_versions%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'editorial_owner_required';end if;
 if p_day is null or p_kind not in ('sensory','service_marketing','founder_story') then raise exception 'editorial_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_day::text||p_kind,0));
 select * into r from public.hana_editorial_versions where owner_id=p_owner and local_day=p_day and kind=p_kind order by version desc limit 1 for update;
 if not found then
  insert into public.hana_editorial_versions(owner_id,local_day,kind,version,state,started_at)
  values(p_owner,p_day,p_kind,1,'running',now()) returning * into r;
 elsif r.state='scheduled' then
  update public.hana_editorial_versions set state='running',started_at=now() where id=r.id returning * into r;
 else
  if r.state='running' and r.started_at<now()-interval '45 minutes' then
   update public.hana_editorial_versions set state='failed',error_code='worker_timeout',finished_at=now() where id=r.id returning * into r;
  end if;
  return jsonb_build_object('claimed',false,'id',r.id,'state',r.state);
 end if;
 return jsonb_build_object('claimed',true,'id',r.id,'state',r.state,'version',r.version);
end $$;

create or replace function public.hana_editorial_finish(p_owner uuid,p_id uuid,p_state text,p_payload jsonb,p_evidence jsonb,p_missing jsonb,p_error text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.hana_editorial_versions%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'editorial_owner_required';end if;
 if p_state not in ('partial','blocked','failed','ready_for_review') or length(p_payload::text)>90000 or length(p_evidence::text)>24000
  or jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_evidence)<>'object' or jsonb_typeof(p_missing)<>'array' then raise exception 'editorial_invalid';end if;
 if p_state='ready_for_review' and (p_missing<>'[]'::jsonb or p_evidence->>'verified' is distinct from 'true') then raise exception 'editorial_evidence_required';end if;
 update public.hana_editorial_versions set state=p_state,payload=p_payload,evidence=p_evidence,missing=p_missing,error_code=p_error,finished_at=now()
 where owner_id=p_owner and id=p_id and state='running' returning * into r;
 if not found then raise exception 'editorial_conflict';end if;
 return to_jsonb(r)-'owner_id';
end $$;

create or replace function public.hana_editorial_decide(p_owner uuid,p_id uuid,p_action text,p_note text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.hana_editorial_versions%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'editorial_owner_required';end if;
 select * into r from public.hana_editorial_versions where owner_id=p_owner and id=p_id;
 if not found then raise exception 'editorial_conflict';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||r.local_day::text||r.kind,0));
 select * into r from public.hana_editorial_versions where owner_id=p_owner and local_day=r.local_day and kind=r.kind order by version desc limit 1 for update;
 if r.id<>p_id then raise exception 'editorial_conflict';end if;
 if p_action in ('approve','revise') and r.state='ready_for_review' then
  update public.hana_editorial_versions set state=case when p_action='approve' then 'approved' else 'revision_required' end,
   reviewed_at=now(),review_note=left(coalesce(p_note,''),2000) where id=r.id returning * into r;
 elsif p_action='retry' and (r.state in ('partial','blocked','failed','revision_required') or (r.state='running' and r.started_at<now()-interval '45 minutes')) and r.version<20 then
  if r.state='running' then update public.hana_editorial_versions set state='failed',error_code='worker_timeout',finished_at=now() where id=r.id;end if;
  insert into public.hana_editorial_versions(owner_id,local_day,kind,version,state) values(p_owner,r.local_day,r.kind,r.version+1,'scheduled') returning * into r;
 else raise exception 'editorial_conflict';
 end if;
 return to_jsonb(r)-'owner_id';
end $$;

revoke all on function public.hana_editorial_list(uuid),public.hana_editorial_claim(uuid,date,text),public.hana_editorial_finish(uuid,uuid,text,jsonb,jsonb,jsonb,text),public.hana_editorial_decide(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hana_editorial_list(uuid),public.hana_editorial_claim(uuid,date,text),public.hana_editorial_finish(uuid,uuid,text,jsonb,jsonb,jsonb,text),public.hana_editorial_decide(uuid,uuid,text,text) to service_role;
