-- Ephemeral fixtures; db-run.sql rolls back the entire candidate schema.
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
\i supabase/schema/hana-project-materials.sql
insert into auth.users(id) values('10000000-0000-4000-8000-000000000002');
insert into public.hana_project_materials values('10000000-0000-4000-8000-000000000002','other','https://1drv.ms/f/other');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"app_metadata":{"hana_office_access":true}}',true);
insert into public.hana_project_materials values('10000000-0000-4000-8000-000000000001','fixture','https://1drv.ms/f/one');
insert into public.hana_project_materials values('10000000-0000-4000-8000-000000000001','fixture','https://1drv.ms/f/updated')
on conflict(owner_id,project) do update set folder_url=excluded.folder_url;
do $$ begin
 if (select count(*) from public.hana_project_materials)<>1 then raise exception 'cross_owner_read'; end if;
 if (select folder_url from public.hana_project_materials where project='fixture')<>'https://1drv.ms/f/updated' then raise exception 'upsert_failed'; end if;
 begin
  update public.hana_project_materials set owner_id='10000000-0000-4000-8000-000000000002' where project='fixture';
  raise exception using errcode='ZX001',message='owner_reassignment_allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.hana_project_materials values('10000000-0000-4000-8000-000000000002','forged','https://1drv.ms/f/x');
  raise exception using errcode='ZX001',message='forged_owner_insert';
 exception when insufficient_privilege then null; end;
 begin
  update public.hana_project_materials set folder_url='https://1drv.ms.attacker.invalid/f/x' where project='fixture';
  raise exception using errcode='ZX001',message='unsafe_link_allowed';
 exception when check_violation then null; end;
 if has_table_privilege('authenticated','public.hana_project_materials','delete') then raise exception 'delete_exposed'; end if;
end $$;
select set_config('request.jwt.claims','{"user_metadata":{"hana_office_access":true}}',true);
do $$ begin
 if (select count(*) from public.hana_project_materials)<>0 then raise exception 'untrusted_read'; end if;
 begin
  insert into public.hana_project_materials values('10000000-0000-4000-8000-000000000001','untrusted','https://1drv.ms/f/x');
  raise exception using errcode='ZX001',message='untrusted_insert';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.hana_project_materials','select') then raise exception 'anonymous_read'; end if;
end $$;
select 'PASS: materials owner isolation, trusted claims, upsert, immutable owner and URL checks' as materials_result;
