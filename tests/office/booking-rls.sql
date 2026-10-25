\i supabase/schema/hana-booking-changes.sql
set local role service_role;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000003';r uuid:=gen_random_uuid();v uuid;u uuid;
begin
 v:=public.hana_booking_save(o,r,'slot','fixture-slot','{"capacity":3}','{"booked":2}',true);
 if public.hana_booking_save(o,r,'slot','fixture-slot','{"capacity":3}','{"booked":2}',true)<>v then raise exception 'duplicate_draft';end if;
 begin perform public.hana_booking_save(o,r,'slot','fixture-slot','{"capacity":1}','{}',true);raise exception using errcode='ZX001',message='request_overwrite';exception when sqlstate 'P0001' then null;end;
 perform public.hana_booking_review(o,v,'approved');
 if (select state from public.hana_booking_changes where id=v)<>'approved' then raise exception 'review_failed';end if;
 begin perform public.hana_booking_review(o,v,'rejected');raise exception using errcode='ZX001',message='duplicate_review';exception when sqlstate 'P0001' then null;end;
 u:=public.hana_booking_save(o,gen_random_uuid(),'order','fixture-order','{"action":"cancel"}','{}',false);
 begin perform public.hana_booking_review(o,u,'approved');raise exception using errcode='ZX001',message='unverified_order_approved';exception when sqlstate 'P0001' then null;end;
 perform public.hana_booking_review(o,u,'rejected');
 if has_table_privilege('authenticated','public.hana_booking_changes','update') then raise exception 'direct_review_exposed';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin if (select count(*) from public.hana_booking_changes)<>0 then raise exception 'cross_owner_booking_changes';end if;end $$;
reset role;
select 'PASS: booking draft idempotency, review gates, owner privacy; no external booking changes' as booking_result;
