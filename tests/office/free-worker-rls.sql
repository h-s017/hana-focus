\i supabase/schema/hana-free-worker.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000004','{"hana_office_access":true}');
set local role service_role;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000004';v jsonb;
begin
 if has_function_privilege('authenticated','public.hana_run_free_pm_tick()','execute') then raise exception 'worker_rpc_exposed';end if;
 insert into public.hana_automation_settings(owner_id,project,enabled,scope_note) values(o,'free-fixture',true,'only wall');
 insert into public.hana_tasks(owner_id,project,role,title,brief) values(o,'free-fixture','Brand Strategist','not automatic','fixture'),(o,'free-fixture','Project Manager','free PM','fixture');
 v:=public.hana_run_free_pm_tick();
 if v->>'status'<>'review' or (v->>'paid_api_calls')::int<>0 then raise exception 'free_tick_failed';end if;
 if not exists(select 1 from public.hana_tasks where id=(v->>'task_id')::uuid and role='Project Manager' and status='review' and result like '免費 PM%') then raise exception 'wrong_role_or_state';end if;
 if public.hana_automation_claim_rules(3) is not null then raise exception 'strategy_auto_claimed';end if;
end $$;
reset role;
select 'PASS: NT$0 PM-only worker and database-local scheduled review draft' as free_result;
