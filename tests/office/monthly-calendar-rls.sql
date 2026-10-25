\i supabase/schema/hana-monthly-calendar.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000006','{"hana_office_access":true}');
set local role service_role;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000006';r jsonb;req uuid:=gen_random_uuid();g jsonb;other uuid:='10000000-0000-4000-8000-000000000002';n integer;
begin
 if has_function_privilege('authenticated','public.hana_monthly_save(uuid,text,integer,uuid,jsonb,jsonb,jsonb,jsonb)','execute') or has_function_privilege('anon','public.hana_monthly_claim_day(uuid,timestamptz)','execute') then raise exception 'monthly_rpc_exposed';end if;
 g:=jsonb_build_object('month','2026-11','sourceVerified',true,'policyConfigured',true,'externalWrites',false,'published',false,'checkedAt',now(),'days','[]'::jsonb);
 r:=public.hana_monthly_save(o,'2026-11',0,req,'{"weekdays":[1]}','{}',g,'["2026-11-02"]');
 if (r->>'revision')::int<>1 or r->>'state'<>'pending' or (r->>'schedule_enabled')::boolean then raise exception 'bad_initial_monthly';end if;
 r:=public.hana_monthly_save(o,'2026-11',0,req,'{}','{}',g,'[]');
 if (r->>'revision')::int<>1 then raise exception 'duplicate_revision';end if;
 begin perform public.hana_monthly_save(o,'2026-11',0,gen_random_uuid(),'{}','{}',g,'[]');raise exception 'stale_overwrite';exception when others then if SQLERRM='stale_overwrite' then raise;end if;end;
 r:=public.hana_monthly_review(o,'2026-11',1,'approved',gen_random_uuid());if r->>'state'<>'approved_internal' then raise exception 'review_not_logged';end if;
 -- Every recalculation invalidates the old approval, preserves explicit manual closing.
 for n in 1..5 loop
  r:=public.hana_monthly_save(o,'2026-11',n,gen_random_uuid(),'{"weekdays":[1]}','{"2026-11-02":"closed"}',g,'[]');
 end loop;
 if (select count(*) from public.hana_monthly_drafts where owner_id=o and month='2026-11')<>1 or (r->>'revision')::int<>6 or r->>'state'<>'pending' then raise exception 'five_duplicate_months_or_stale_approval';end if;
 -- Missing sources cannot be approved. No events, orders or payments are changed.
 r:=public.hana_monthly_save(o,'2026-11',6,gen_random_uuid(),'{"weekdays":[1]}','{}',g||'{"sourceVerified":false}','[]');
 begin perform public.hana_monthly_review(o,'2026-11',7,'approved',gen_random_uuid());raise exception 'unverified_approved';exception when others then if SQLERRM='unverified_approved' then raise;end if;end;
 if public.hana_monthly_claim_day(o,'2026-10-27T08:00:00+08:00') then raise exception 'schedule_enabled_by_save';end if;
 update public.hana_monthly_drafts set schedule_enabled=true where owner_id=o;
 if public.hana_monthly_claim_day(o,'2026-10-26T08:00:00+08:00') or public.hana_monthly_claim_day(o,'2026-10-27T07:00:00+08:00') then raise exception 'bad_schedule_window';end if;
 if not public.hana_monthly_claim_day(o,'2026-10-27T08:00:00+08:00') or public.hana_monthly_claim_day(o,'2026-10-27T08:05:00+08:00') then raise exception 'daily_claim_not_unique';end if;
 if not public.hana_monthly_claim_day(o,'2026-10-31T08:00:00+08:00') then raise exception 'last_day_missing';end if;
 if exists(select 1 from public.hana_automation_events where owner_id=o and code='monthly_day_claimed' and details->>'target_month'<>'2026-11') then raise exception 'wrong_target_month';end if;
 if not exists(select 1 from public.hana_automation_events where owner_id=o and code='monthly_reviewed' and details->>'decision'='approved') then raise exception 'audit_missing';end if;
 -- Expired source snapshots are never approved.
 g:=g||jsonb_build_object('checkedAt',now()-interval '31 minutes');
 r:=public.hana_monthly_save(o,'2026-11',7,gen_random_uuid(),'{"weekdays":[1]}','{}',g,'[]');
 begin perform public.hana_monthly_review(o,'2026-11',8,'approved',gen_random_uuid());raise exception 'stale_source_approved';exception when others then if SQLERRM='stale_source_approved' then raise;end if;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from public.hana_monthly_drafts) then raise exception 'monthly_cross_owner_read';end if;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
select set_config('request.jwt.claims','{"app_metadata":{"hana_office_access":true}}',true);
do $$ begin if (select count(*) from public.hana_monthly_drafts)<>1 then raise exception 'owner_cannot_read';end if;
 begin update public.hana_monthly_drafts set schedule_enabled=true;raise exception 'client_can_enable';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: private month drafts, five-day same-row updates, revisions, review audit, stale-source guard, disabled schedules, daily claim uniqueness and RLS' as monthly_result;
