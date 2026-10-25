\set ON_ERROR_STOP on
\i tests/office/db-fixture.sql
begin;
\i supabase/schema/hana-office-review.sql
\i tests/office/database-rollback.sql
\i tests/office/materials-rls.sql
\i tests/office/automation-rls.sql
\i tests/office/booking-rls.sql
\i tests/office/free-worker-rls.sql
\i tests/office/monthly-calendar-rls.sql
\i tests/office/focus-rls.sql
rollback;
do $$ begin
 if to_regclass('public.hana_task_runs') is not null then raise exception 'test_schema_persisted'; end if;
 if (select count(*) from public.hana_tasks)<>0 then raise exception 'test_data_persisted'; end if;
end $$;
select 'PASS: ephemeral PostgreSQL transaction rolled back' as cleanup_result;

