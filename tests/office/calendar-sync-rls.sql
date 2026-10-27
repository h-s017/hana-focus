\i supabase/migrations/20261026161833_calendar_sync_review.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000010','{"hana_office_access":true}');
set local role service_role;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000010';a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();
begin
 if has_table_privilege('anon','public.hana_calendar_links','SELECT') or has_table_privilege('authenticated','public.hana_calendar_links','UPDATE') or has_table_privilege('authenticated','public.hana_calendar_sync_locks','DELETE') then raise exception 'sync_state_exposed';end if;
 if has_function_privilege('authenticated','public.hana_calendar_sync_lock(uuid,uuid)','execute') then raise exception 'sync_lock_exposed';end if;
 if not public.hana_calendar_sync_lock(o,a) then raise exception 'first_lock_failed';end if;
 if public.hana_calendar_sync_lock(o,b) then raise exception 'parallel_lock_won';end if;
 delete from public.hana_calendar_sync_locks where owner_id=o and token=b;
 if not exists(select 1 from public.hana_calendar_sync_locks where owner_id=o and token=a) then raise exception 'wrong_unlock';end if;
 update public.hana_calendar_sync_locks set expires_at=now()-interval '1 second' where owner_id=o;
 if not public.hana_calendar_sync_lock(o,b) then raise exception 'expired_lock_not_recovered';end if;
 insert into public.hana_calendar_links(owner_id,kind,source_id,month,event_id) values(o,'slot','synthetic','2099-12','synthetic-event');
 begin
  insert into public.hana_calendar_links(owner_id,kind,source_id,month,event_id) values(o,'slot','synthetic','2099-12','other-event');
  raise exception 'duplicate_mapping_allowed';
 exception when unique_violation then null;end;
 begin
  insert into public.hana_tasks(owner_id,project,role,title,brief,schedule_start_at) values(o,'fixture','Project Manager','schedule','',now());
  raise exception 'partial_schedule_allowed';
 exception when check_violation then null;end;
end $$;
reset role;
