\i supabase/migrations/20261025173059_focus_central_workspace.sql
\i supabase/migrations/20261025173059_focus_central_workspace.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000007','{"hana_office_access":true}');
set local role service_role;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000007';p jsonb;v jsonb;pr uuid;ver uuid;task uuid;blocked uuid;req uuid;items jsonb;c uuid;run jsonb;before_count int;
begin
 if has_function_privilege('authenticated','public.hana_focus_import(uuid,uuid,uuid,jsonb,text,uuid,text)','execute') then raise exception 'focus_rpc_exposed';end if;
 p:='{"name":"Fixture spatial project","legacy_name":"fixture-focus","workspace":"work","external_id":"fixture-project","version":{"label":"V3","version_date":"2026-10-25","contract":{"scheme":"B","net":1000,"gross":1050,"client_approved":true},"included_terms":["history wall","signage","menu"],"excluded_terms":["packaging","uniform"]},"documents":[{"source_system":"notion","external_id":"fixture-doc","source_url":"https://www.notion.so/fixture","content":"1979 background; 2002 founding; rights unverified"}]}'::jsonb;
 v:=public.hana_focus_bootstrap(o,p,gen_random_uuid());pr:=(v->>'project_id')::uuid;ver:=(v->>'version_id')::uuid;
 if exists(select 1 from public.hana_project_versions where id=ver and contract->>'client_approved'<>'false') then raise exception 'client_approval_forged';end if;
 req:=gen_random_uuid();items:='[{"external_id":"fixture-wall","title":"history wall","brief":"source","work_state":"todo","priority":1,"canonical_key":"history_wall"},{"external_id":"fixture-pack","title":"packaging","brief":"historical","work_state":"waiting","priority":2}]';
 v:=public.hana_focus_import(o,pr,ver,items,'notion',req,null);
 if v->>'added'<>'2' then raise exception 'import_failed';end if;
 if public.hana_focus_import(o,pr,ver,items,'notion',req,null)<>v then raise exception 'receipt_not_idempotent';end if;
 if public.hana_focus_import(o,pr,ver,items,'notion',gen_random_uuid(),null)->>'skipped'<>'2' then raise exception 'source_not_idempotent';end if;
 select id into task from public.hana_tasks where owner_id=o and title='history wall';select id into blocked from public.hana_tasks where owner_id=o and title='packaging';
 if public.hana_focus_agent_allowed(o,blocked) or not public.hana_focus_agent_allowed(o,task) then raise exception 'scope_guard_wrong';end if;
 begin perform public.hana_focus_run_start(o,blocked,'Project Manager',gen_random_uuid());raise exception 'outside_scope_executed';exception when others then if SQLERRM='outside_scope_executed' then raise;end if;end;
 begin perform public.hana_claim_task(o,blocked,gen_random_uuid());raise exception 'direct_claim_bypassed';exception when others then if SQLERRM='direct_claim_bypassed' then raise;end if;end;
 begin perform public.hana_focus_update(o,blocked,1,'{"scope_status":"in_scope"}',gen_random_uuid());raise exception 'out_scope_override';exception when others then if SQLERRM='out_scope_override' then raise;end if;end;
 -- A local edit and a changed Notion event must produce a pending conflict, not overwrite.
 perform public.hana_focus_update(o,task,1,'{"work_state":"in_progress"}',gen_random_uuid());
 items:='[{"external_id":"fixture-wall","title":"history wall","brief":"changed remote","work_state":"done","priority":1,"canonical_key":"history_wall"}]';
 v:=public.hana_focus_import(o,pr,ver,items,'notion',gen_random_uuid(),null);
 if v->>'conflicts'<>'1' or (select work_state from public.hana_tasks where id=task)<>'in_progress' then raise exception 'conflict_overwrote_local';end if;
 perform public.hana_focus_import(o,pr,ver,items,'notion',gen_random_uuid(),null);
 if (select count(*) from public.hana_sync_conflicts where owner_id=o and state='pending')<>1 then raise exception 'duplicate_conflict';end if;
 select id into c from public.hana_sync_conflicts where owner_id=o and state='pending';
 perform public.hana_focus_resolve(o,c,task,2,'keep_local',gen_random_uuid());
 if public.hana_focus_import(o,pr,ver,items,'notion',gen_random_uuid(),null)->>'skipped'<>'1' then raise exception 'resolved_conflict_repeated';end if;
 -- New linked analysis runs share the original task/run/review tables and cannot approve delivery.
 req:=gen_random_uuid();run:=public.hana_focus_run_start(o,task,'Brand Strategist',req);
 if run->>'fresh'<>'true' then raise exception 'tool_claim_failed';end if;
 if public.hana_focus_run_start(o,task,'Brand Strategist',req)->>'fresh'<>'false' then raise exception 'duplicate_agent_run';end if;
 perform public.hana_finish_task(o,task,(run->>'run_id')::uuid,'tool comparison draft',null);
 begin perform public.hana_focus_update(o,task,3,'{"work_state":"done"}',gen_random_uuid());raise exception 'draft_marked_done';exception when others then if SQLERRM='draft_marked_done' then raise;end if;end;
 perform public.hana_review_task(o,task,'approved','internal only');
 -- Tracking-only sources are not picked up by automatic Agent claims.
 insert into public.hana_automation_settings(owner_id,project,enabled,scope_note) values(o,'fixture-focus',true,'version scope');
 if public.hana_automation_claim_rules(3) is not null then raise exception 'tracking_auto_claimed';end if;
 -- A backup is mandatory for local imports and ideas never create tasks.
 begin perform public.hana_focus_import(o,pr,ver,items,'local',gen_random_uuid(),null);raise exception 'unbacked_import';exception when others then if SQLERRM='unbacked_import' then raise;end if;end;
 select count(*) into before_count from public.hana_tasks where owner_id=o;
 perform public.hana_focus_import_ideas(o,'church','[{"external_id":"fixture-idea","content":"idea only"}]',repeat('a',64),gen_random_uuid());
 if (select count(*) from public.hana_tasks where owner_id=o)<>before_count then raise exception 'idea_became_task';end if;
 -- V3 source is immutable; new definitions require a new version label.
 begin perform public.hana_focus_bootstrap(o,jsonb_set(p,'{version,contract,net}','1'),gen_random_uuid());raise exception 'version_overwritten';exception when others then if SQLERRM='version_overwritten' then raise;end if;end;
 perform public.hana_focus_update(o,task,3,jsonb_build_object('dependencies',jsonb_build_array(blocked)),gen_random_uuid());
 begin perform public.hana_focus_update(o,task,4,'{"work_state":"done"}',gen_random_uuid());raise exception 'dependency_ignored';exception when others then if SQLERRM='dependency_ignored' then raise;end if;end;
 if public.hana_focus_pm_report(o,task) not like '%"in_scope_work": 1%' or public.hana_focus_pm_report(o,task) not like '%"preserved_out_of_scope": 1%' then raise exception 'pm_report_scope_denominator';end if;
 if public.hana_focus_snapshot(o)->>'truncated'<>'false' then raise exception 'unexpected_snapshot_limit';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"app_metadata":{"hana_office_access":true}}',true);
do $$ begin if exists(select 1 from public.hana_projects) or exists(select 1 from public.hana_sync_conflicts) then raise exception 'focus_cross_owner_read';end if;
 begin update public.hana_projects set name='forged';raise exception 'direct_project_write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: repeatable central migration, source idempotency/conflicts, scope and version gates, shared Agent review, backup requirement, ideas isolation and owner RLS' as focus_result;
