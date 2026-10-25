\i supabase/schema/hana-work-intake.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000005','{"hana_office_access":true}');
set local role service_role;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000005';req uuid:=gen_random_uuid();t uuid;v jsonb;other uuid;before_runs integer;
begin
 if has_function_privilege('authenticated','public.hana_begin_work(uuid,uuid,text,text,text)','execute') or has_function_privilege('anon','public.hana_work_history(uuid)','execute') then raise exception 'work_rpc_exposed';end if;
 begin perform public.hana_begin_work(o,null,'fixture','input','project_progress');raise exception 'null_request_accepted';exception when others then if SQLERRM='null_request_accepted' then raise;end if;end;
 v:=public.hana_begin_work(o,req,'intake-fixture','整理專案進度','project_progress');t:=(v->>'task_id')::uuid;
 if v->>'fresh'<>'true' or t is null then raise exception 'not_queued';end if;
 if (public.hana_begin_work(o,req,'intake-fixture','整理專案進度','project_progress')->>'fresh')::boolean then raise exception 'duplicate_task';end if;
 if (select count(*) from public.hana_tasks where owner_id=o and request_id=req)<>1 then raise exception 'duplicate_insert';end if;
 begin perform public.hana_begin_work(o,req,'other','整理專案進度','project_progress');raise exception 'changed_input_accepted';exception when others then if SQLERRM='changed_input_accepted' then raise;end if;end;
 if jsonb_array_length(public.hana_work_history('10000000-0000-4000-8000-000000000002'))<>0 then raise exception 'other_owner_leaked';end if;
 insert into public.hana_tasks(owner_id,project,role,title,brief,status,result) values(o,'intake-fixture','Brand Strategist','approved evidence','fixture','approved','approved report'),(o,'intake-fixture','Creative Producer','needs review','fixture','review','draft');
 -- Pausing a project cannot be undone by a new command.
 update public.hana_automation_settings set enabled=false where owner_id=o and project='intake-fixture';
 other:=gen_random_uuid();perform public.hana_begin_work(o,other,'intake-fixture','整理專案進度','project_progress');
 if exists(select 1 from public.hana_automation_settings where owner_id=o and enabled) then raise exception 'pause_overridden';end if;
 if not exists(select 1 from jsonb_array_elements(public.hana_work_history(o)) x where x->>'waiting_reason'='paused') then raise exception 'pause_hidden';end if;
 update public.hana_automation_settings set enabled=true where owner_id=o;
 -- Tick produces actual counts, stops at review, keeps duplicate receipt request stable.
 v:=public.hana_run_free_pm_tick();
 if v->>'status'<>'review' then raise exception 'tick_did_not_work';end if;
 if not exists(select 1 from public.hana_tasks where owner_id=o and status='review' and title='交辦｜專案進度整理' and result like '%approved：1%' and result like '%review：1%' and result like '%needs review%') then raise exception 'report_not_from_tasks';end if;
 if not exists(select 1 from jsonb_array_elements(public.hana_work_history(o)) x where x->>'status'='review' and x->>'summary' like '%approved：1%') then raise exception 'history_not_updated';end if;
 t:=(v->>'task_id')::uuid;perform public.hana_review_task(o,t,'approved','fixture only');
 begin perform public.hana_handoff_task(o,t,gen_random_uuid());raise exception 'report_became_strategy';exception when others then if SQLERRM='report_became_strategy' then raise;end if;end;
 perform public.hana_automation_advance();
 if exists(select 1 from public.hana_tasks where parent_task_id=t) then raise exception 'automatic_report_handoff';end if;
 -- Real non-intake approved evidence may hand off, preserving legacy flow.
 if not exists(select 1 from public.hana_tasks where owner_id=o and title like '交接｜approved evidence%') then raise exception 'legacy_handoff_broken';end if;
 select count(*) into before_runs from public.hana_task_runs where owner_id=o;
 v:=public.hana_run_free_pm_tick();
 if v->>'status'<>'review' then raise exception 'second_report_not_run';end if;
 v:=public.hana_run_free_pm_tick();
 if v->>'status'<>'idle_or_limited' then raise exception 'non_pm_or_repeat_executed';end if;
 if (select count(*) from public.hana_task_runs where owner_id=o)<>before_runs+1 then raise exception 'duplicate_run';end if;
 insert into public.hana_automation_events(owner_id,project,code,details,created_at) values(o,'intake-fixture','work_running','{"instruction":"stale-fixture"}',now()-interval '11 minutes');
 if not exists(select 1 from jsonb_array_elements(public.hana_work_history(o)) x where x->>'instruction'='stale-fixture' and x->>'status'='needs_human') then raise exception 'stale_command_not_flagged';end if;
 -- Immediate/read-only results never enqueue a task; immutable idempotent receipt.
 req:=gen_random_uuid();perform public.hana_begin_work(o,req,'intake-fixture','arbitrary request','needs_human');perform public.hana_finish_work(o,req,'needs_human','not executed');
 if exists(select 1 from public.hana_tasks where owner_id=o and request_id=req) then raise exception 'unknown_task_executed';end if;
 begin perform public.hana_finish_work(o,req,'completed','overwrite');raise exception 'receipt_overwritten';exception when others then if SQLERRM='receipt_overwritten' then raise;end if;end;
 -- Remaining daily allowance allows one more run only; queued history exposes daily cap.
 perform public.hana_begin_work(o,gen_random_uuid(),'intake-fixture','整理專案進度','project_progress');perform public.hana_run_free_pm_tick();
 perform public.hana_begin_work(o,gen_random_uuid(),'intake-fixture','整理專案進度','project_progress');
 if not exists(select 1 from jsonb_array_elements(public.hana_work_history(o)) x where x->>'waiting_reason'='daily_limit') then raise exception 'daily_limit_hidden';end if;
 if public.hana_run_free_pm_tick()->>'status'<>'idle_or_limited' then raise exception 'daily_limit_bypassed';end if;
end $$;
reset role;
select 'PASS: private idempotent intake, actual project evidence, pause/daily cap, human review, terminal progress reports, legacy handoff preserved' as work_result;
