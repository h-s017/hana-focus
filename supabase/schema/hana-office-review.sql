-- Additive candidate schema. Review and run in a single transaction before deploying the Edge Function.
-- This file is NOT an applied migration. Existing tables/data are retained.
alter table public.hana_tasks add column if not exists parent_task_id uuid references public.hana_tasks(id);
alter table public.hana_tasks add column if not exists due_at timestamptz;
alter table public.hana_tasks add column if not exists request_id uuid default gen_random_uuid();
alter table public.hana_tasks add column if not exists active_run_id uuid;
create unique index if not exists hana_tasks_request_unique on public.hana_tasks(owner_id,request_id);
create unique index if not exists hana_tasks_handoff_unique on public.hana_tasks(parent_task_id,role) where parent_task_id is not null;
create table if not exists public.hana_task_runs (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.hana_tasks(id),
 owner_id uuid not null references auth.users(id),
 request_id uuid not null,
 status text not null check(status in ('running','review','failed')),
 result text,
 error_code text check(error_code in ('provider_failed','provider_timeout','stale_run')),
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 unique(owner_id,request_id)
);
alter table public.hana_task_runs enable row level security;
create policy hana_runs_owner_select on public.hana_task_runs for select to authenticated using ((select auth.uid())=owner_id);
grant select on public.hana_task_runs to authenticated;
revoke all on public.hana_task_runs from anon;
grant all on public.hana_task_runs to service_role;
-- Human decisions must pass the atomic review RPC; clients cannot forge an audit-only insert.
revoke insert,update,delete on public.hana_reviews from authenticated,anon;
revoke update,delete on public.hana_tasks from authenticated,anon;
-- Also guard forged parent links on otherwise permitted task inserts.
drop policy if exists hana_tasks_owner_insert on public.hana_tasks;
create policy hana_tasks_owner_insert on public.hana_tasks for insert to authenticated with check (
 (select auth.uid())=owner_id and status='queued' and result is null and parent_task_id is null and active_run_id is null
);
create function public.hana_claim_task(p_owner uuid,p_task uuid,p_request uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_run uuid := gen_random_uuid(); v_count integer;
begin
 update public.hana_tasks set status='running',active_run_id=v_run,updated_at=now()
 where id=p_task and owner_id=p_owner and status in ('queued','failed');
 get diagnostics v_count = row_count;
 if v_count<>1 then raise exception 'state_conflict'; end if;
 insert into public.hana_task_runs(id,task_id,owner_id,request_id,status) values(v_run,p_task,p_owner,p_request,'running');
 return v_run;
end $$;
create function public.hana_finish_task(p_owner uuid,p_task uuid,p_run uuid,p_result text,p_error text default null) returns text
language plpgsql security invoker set search_path='' as $$
declare v_state text := case when p_error is null then 'review' else 'failed' end; v_count integer;
begin
 if p_error is not null and p_error not in ('provider_failed','provider_timeout') then raise exception 'invalid_error'; end if;
 if p_error is null and (p_result is null or length(p_result)=0 or length(p_result)>50000) then raise exception 'invalid_result'; end if;
 update public.hana_tasks set status=v_state,result=case when p_error is null then p_result else result end,active_run_id=null,updated_at=now()
 where id=p_task and owner_id=p_owner and status='running' and active_run_id=p_run;
 get diagnostics v_count = row_count;
 if v_count<>1 then raise exception 'state_conflict'; end if;
 update public.hana_task_runs set status=v_state,result=case when p_error is null then p_result else null end,error_code=p_error,finished_at=now() where id=p_run and owner_id=p_owner and task_id=p_task and status='running';
 get diagnostics v_count = row_count;
 if v_count<>1 then raise exception 'run_conflict'; end if;
 return v_state;
end $$;
create function public.hana_review_task(p_owner uuid,p_task uuid,p_decision text,p_note text default '') returns text
language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
 update public.hana_tasks set status=p_decision,updated_at=now() where id=p_task and owner_id=p_owner and status='review';
 get diagnostics v_count = row_count;
 if v_count<>1 then raise exception 'state_conflict'; end if;
 insert into public.hana_reviews(task_id,owner_id,decision,note) values(p_task,p_owner,p_decision,left(p_note,2000));
 return p_decision;
end $$;
create function public.hana_recover_task(p_owner uuid,p_task uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare v_run uuid;
begin
 select active_run_id into v_run from public.hana_tasks where id=p_task and owner_id=p_owner and status='running' and updated_at<now()-interval '10 minutes' for update;
 if v_run is null then raise exception 'not_stale'; end if;
 update public.hana_task_runs set status='failed',error_code='stale_run',finished_at=now() where id=v_run and owner_id=p_owner and status='running';
 update public.hana_tasks set status='failed',active_run_id=null,updated_at=now() where id=p_task and owner_id=p_owner;
 return 'failed';
end $$;
create function public.hana_requeue_task(p_owner uuid,p_task uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 update public.hana_tasks set status='queued',updated_at=now() where id=p_task and owner_id=p_owner and status='rejected';
 get diagnostics v_count = row_count;
 if v_count<>1 then raise exception 'state_conflict'; end if;
 return 'queued';
end $$;
create function public.hana_handoff_task(p_owner uuid,p_task uuid,p_request uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare t public.hana_tasks%rowtype; v_role text; v_id uuid;
begin
 select * into t from public.hana_tasks where id=p_task and owner_id=p_owner and status='approved' for update;
 if not found then raise exception 'approval_required'; end if;
 if t.role='Project Manager' and t.parent_task_id is not null then raise exception 'workflow_finished'; end if;
 v_role := case t.role when 'Project Manager' then 'Brand Strategist' when 'Brand Strategist' then 'Creative Producer' when 'Creative Producer' then 'Project Manager' end;
 if v_role is null then raise exception 'invalid_role'; end if;
 insert into public.hana_tasks(owner_id,project,role,title,brief,parent_task_id,request_id)
 values(p_owner,t.project,v_role,'交接｜'||left(t.title,120),left('上游結果為內部審核核准，非客戶正式核准。保留G1–G5與B/C範圍待核對。來源任務：'||t.id::text||E'\n'||coalesce(t.result,''),12000),t.id,p_request)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.hana_claim_task(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.hana_finish_task(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.hana_review_task(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.hana_recover_task(uuid,uuid) from public,anon,authenticated;
revoke all on function public.hana_requeue_task(uuid,uuid) from public,anon,authenticated;
revoke all on function public.hana_handoff_task(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_claim_task(uuid,uuid,uuid),public.hana_finish_task(uuid,uuid,uuid,text,text),public.hana_review_task(uuid,uuid,text,text),public.hana_recover_task(uuid,uuid),public.hana_requeue_task(uuid,uuid),public.hana_handoff_task(uuid,uuid,uuid) to service_role;
