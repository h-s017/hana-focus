-- Ephemeral PG17 fixtures only; no network calls or real credentials.
alter table auth.users add column deleted_at timestamptz;
alter table auth.users add column raw_app_meta_data jsonb not null default '{}';
\i supabase/schema/hana-automation.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000003','{"hana_office_access":true}');
set local role service_role;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000003'; t uuid; v jsonb; child uuid;
begin
 insert into public.hana_automation_settings(owner_id,project,daily_limit,scope_note) values(o,'__AUTO_TEST__',1,'only wall');
 insert into public.hana_tasks(owner_id,project,role,title,brief) values(o,'__AUTO_TEST__','Project Manager','fixture','synthetic') returning id into t;
 if public.hana_automation_claim(10) is not null then raise exception 'disabled_claim'; end if;
 update public.hana_automation_settings set enabled=true where owner_id=o;
 v:=public.hana_automation_claim(10);
 if (v->>'id')::uuid<>t then raise exception 'claim_missing'; end if;
 if public.hana_automation_claim(10) is not null then raise exception 'concurrent_owner_claim'; end if;
 perform public.hana_finish_task(o,t,(v->>'run_id')::uuid,'synthetic draft');
 if public.hana_automation_advance()<>0 then raise exception 'unreviewed_handoff'; end if;
 perform public.hana_review_task(o,t,'approved','human fixture');
 if public.hana_automation_advance()<>1 or public.hana_automation_advance()<>0 then raise exception 'duplicate_handoff'; end if;
 if public.hana_automation_claim(10) is not null then raise exception 'project_budget_bypassed'; end if;
 update public.hana_automation_settings set daily_limit=6 where owner_id=o;
 if public.hana_automation_claim(1) is not null then raise exception 'owner_budget_bypassed'; end if;
 v:=public.hana_automation_claim(10);child:=(v->>'id')::uuid;
 if v->>'role'<>'Brand Strategist' then raise exception 'wrong_role'; end if;
 perform public.hana_finish_task(o,child,(v->>'run_id')::uuid,null,'provider_failed');
 if public.hana_automation_claim(10) is not null then raise exception 'automatic_failure_retry'; end if;
 perform public.hana_automation_retry(o,child);
 v:=public.hana_automation_claim(10);
 update public.hana_tasks set updated_at=now()-interval '11 minutes' where id=child;
 if public.hana_automation_recover()<>1 then raise exception 'stale_recovery_failed'; end if;
 if public.hana_automation_claim(10) is not null then raise exception 'stale_auto_rebilled'; end if;
 perform public.hana_automation_retry(o,child);v:=public.hana_automation_claim(10);
 perform public.hana_finish_task(o,child,(v->>'run_id')::uuid,null,'provider_failed');
 begin
  perform public.hana_automation_retry(o,child);
  raise exception using errcode='ZX001',message='unbounded_retry';
 exception when sqlstate 'P0001' then null;end;
 if has_function_privilege('authenticated','public.hana_automation_claim(integer)','execute') then raise exception 'worker_rpc_exposed'; end if;
 if has_table_privilege('authenticated','public.hana_connector_credentials','select') then raise exception 'credential_exposed'; end if;
 if has_table_privilege('authenticated','public.hana_automation_settings','update') then raise exception 'direct_enable_exposed'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"app_metadata":{"hana_office_access":true}}',true);
do $$ begin
 if (select count(*) from public.hana_automation_settings)<>1 then raise exception 'owner_settings_missing'; end if;
 if (select count(*) from public.hana_automation_events)<1 then raise exception 'owner_log_missing'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.hana_automation_settings)<>0 then raise exception 'cross_owner_settings'; end if;
 if (select count(*) from public.hana_automation_events)<>0 then raise exception 'cross_owner_logs'; end if;
end $$;
reset role;
select 'PASS: automation defaults off, atomic claims, daily caps, approval gates, bounded manual retries, credential isolation' as automation_result;
