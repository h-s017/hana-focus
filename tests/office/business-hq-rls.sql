\i supabase/migrations/20261124114411_business_hq_phase1.sql
\i supabase/migrations/20261124114411_business_hq_phase1.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000050','{"hana_office_access":true}'),('10000000-0000-4000-8000-000000000051','{"hana_office_access":true}');
set local role service_role;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000050';other uuid:='10000000-0000-4000-8000-000000000051';req uuid:=gen_random_uuid();r jsonb;again jsonb;payload jsonb;skill jsonb;input jsonb;v_run uuid;task uuid;token uuid;opp uuid;rev integer;
begin
 skill:=jsonb_build_object('id','sales-marketing','version','1.0.0','hash',repeat('a',64),'source','business-hq/skills/sales-marketing/SKILL.md');input:='{"workspace":"work","goal":"Synthetic DB test"}';
 r:=public.hana_hq_start(o,req,input,skill);v_run:=(r->>'run_id')::uuid;task:=(r->>'task_id')::uuid;token:=(r->>'attempt_token')::uuid;
 again:=public.hana_hq_start(o,req,input,skill);if again->>'claimed'<>'false' or (again->>'run_id')::uuid<>v_run then raise exception 'duplicate_hq_run';end if;
 begin perform public.hana_hq_start(o,req,input,skill||'{"version":"1.0.1"}');raise exception 'changed_skill_reused';exception when others then if SQLERRM='changed_skill_reused' then raise;end if;end;
 payload:='{"state":"blocked","error_code":"source_unavailable","sources":[],"tool_results":[],"output":{"goal":"fixture","deliverables":[],"approval_required":true},"opportunities":[]}';
 perform public.hana_hq_finish(o,v_run,token,payload);
 r:=public.hana_hq_start(o,req,input,skill,true);
 begin perform public.hana_hq_finish(o,v_run,token,payload);raise exception 'stale_attempt_committed';exception when others then if SQLERRM='stale_attempt_committed' then raise;end if;end;
 token:=(r->>'attempt_token')::uuid;
 payload:='{"state":"review","sources":[{"url":"https://example.invalid/about"}],"tool_results":[],"output":{"goal":"fixture","deliverables":[],"approval_required":true},"opportunities":[{"company_name":"Synthetic Company","website":"https://example.invalid","canonical_domain":"example.invalid","source_url":"https://example.invalid/about","source_checked_at":"2026-11-24T00:00:00Z","evidence":[{"verified":true,"company_name_confirmed":true}],"fit_reason":"fixture only","fit_score":6,"stage":"proposal_draft","draft":"rules fixture"}]}';
 perform public.hana_hq_finish(o,v_run,token,payload);
 if (select runs.skill_attempt from public.hana_task_runs runs where runs.id=v_run and owner_id=o limit 1) is null then raise exception 'missing_attempt';end if;
 perform set_config('hana.hq_write','',true);
 begin perform public.hana_review_task(o,task,'approved','must use HQ');raise exception 'legacy_review_bypassed_hq';exception when others then if SQLERRM='legacy_review_bypassed_hq' then raise;end if;end;
 perform public.hana_hq_review(o,v_run,'approved','fixture approval');
 if exists(select 1 from public.hana_business_opportunities where owner_id=o and stage='contacted') then raise exception 'approval_implies_contact';end if;
 begin perform public.hana_hq_review(other,v_run,'approved','wrong owner');raise exception 'cross_owner_review';exception when others then if SQLERRM='cross_owner_review' then raise;end if;end;
 if not exists(select 1 from public.hana_reviews where task_id=task and owner_id=o and decision='approved') then raise exception 'review_not_reused';end if;
 select id,revision into opp,rev from public.hana_business_opportunities where owner_id=o;
 perform public.hana_hq_followup(o,opp,rev,'2030-01-01T00:00:00Z');
 begin perform public.hana_hq_followup(o,opp,rev,null);raise exception 'stale_followup_overwrite';exception when others then if SQLERRM='stale_followup_overwrite' then raise;end if;end;
 perform public.hana_hq_track(o,opp,rev+1,'contacted','Synthetic fixture manual contact record, no real recipient or message');
 if not exists(select 1 from public.hana_business_opportunities where id=opp and stage='contacted' and next_followup_at='2030-01-01T00:00:00Z') then raise exception 'manual_tracking_missing';end if;
 if not exists(select 1 from public.hana_reviews where task_id=task and decision='comment') then raise exception 'manual_tracking_audit_missing';end if;
 if has_function_privilege('authenticated','public.hana_hq_snapshot(uuid)','execute') then raise exception 'hq_rpc_exposed';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000051',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000051","app_metadata":{"hana_office_access":true}}',true);
do $$ begin if exists(select 1 from public.hana_business_opportunities) then raise exception 'hq_rls_cross_owner';end if;end $$;
reset role;
select 'PASS: HQ double apply, request/version identity, fenced retry, existing review, no automatic contact and owner RLS' as hq_result;
