-- Run ONLY inside BEGIN; candidate schema; this test; ROLLBACK. No users or external messages created.
do $$
declare o uuid; t uuid; child uuid; r uuid; count_rows integer;
begin
 select id into o from auth.users order by created_at limit 1;
 if o is null then raise exception 'test_requires_existing_user'; end if;
 if has_function_privilege('authenticated','public.hana_claim_task(uuid,uuid,uuid)','execute') then raise exception 'authenticated_rpc_exposed'; end if;
 if has_function_privilege('anon','public.hana_review_task(uuid,uuid,text,text)','execute') then raise exception 'anonymous_rpc_exposed'; end if;
 insert into public.hana_tasks(owner_id,project,role,title,brief) values(o,'__HANA_ROLLBACK_TEST__','Project Manager','synthetic test','synthetic fixture only') returning id into t;
 r := public.hana_claim_task(o,t,gen_random_uuid());
 begin
  perform public.hana_claim_task(o,t,gen_random_uuid());
  raise exception using errcode='ZX001',message='duplicate_claim_was_allowed';
 exception when sqlstate 'P0001' then null;
 end;
 if (select status from public.hana_tasks where id=t)<>'running' then raise exception 'claim_state_failed'; end if;
 perform public.hana_finish_task(o,t,r,'synthetic draft',null);
 perform public.hana_review_task(o,t,'approved','synthetic internal review');
 begin
  perform public.hana_review_task(o,t,'rejected','duplicate');
  raise exception using errcode='ZX001',message='duplicate_review_was_allowed';
 exception when sqlstate 'P0001' then null;
 end;
 select count(*) into count_rows from public.hana_reviews where task_id=t;
 if count_rows<>1 then raise exception 'audit_count_failed'; end if;
 child:=public.hana_handoff_task(o,t,gen_random_uuid());
 if (select role from public.hana_tasks where id=child)<>'Brand Strategist' then raise exception 'handoff_role_failed'; end if;
 begin
  perform public.hana_handoff_task(o,t,gen_random_uuid());
  raise exception using errcode='ZX001',message='duplicate_handoff_was_allowed';
 exception when unique_violation then null;
 end;
 r:=public.hana_claim_task(o,child,gen_random_uuid());
 perform public.hana_finish_task(o,child,r,null,'provider_failed');
 if (select status from public.hana_tasks where id=child)<>'failed' then raise exception 'failed_state_failed'; end if;
 r:=public.hana_claim_task(o,child,gen_random_uuid());
 perform public.hana_finish_task(o,child,r,'retry synthetic draft',null);
 perform public.hana_review_task(o,child,'rejected','needs revision');
 perform public.hana_requeue_task(o,child);
 r:=public.hana_claim_task(o,child,gen_random_uuid());
 update public.hana_tasks set updated_at=now()-interval '11 minutes' where id=child;
 perform public.hana_recover_task(o,child);
 begin
  perform public.hana_finish_task(o,child,r,'late output',null);
  raise exception using errcode='ZX001',message='stale_writer_was_allowed';
 exception when sqlstate 'P0001' then null;
 end;
 if (select status from public.hana_tasks where id=child)<>'failed' then raise exception 'recovery_failed'; end if;
end $$;
select 'PASS: claim exclusion, review audit, handoff uniqueness, failure/retry/requeue, stale recovery, RPC privileges' as rollback_test_result;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.hana_tasks)<>0 then raise exception 'cross_owner_task_read'; end if;
 if (select count(*) from public.hana_task_runs)<>0 then raise exception 'cross_owner_run_read'; end if;
 if has_table_privilege('authenticated','public.hana_reviews','insert') then raise exception 'audit_insert_exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.hana_tasks)<>2 then raise exception 'owner_cannot_read_tasks'; end if;
 if (select count(*) from public.hana_task_runs)<1 then raise exception 'owner_cannot_read_runs'; end if;
end $$;
reset role;
select 'PASS: RLS owner isolation and direct audit insert restriction' as rls_result;
