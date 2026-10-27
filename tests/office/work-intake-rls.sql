-- Test-only emulation of the pre-existing Supabase Storage schema.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb default '{}',unique(bucket_id,name));
create function storage.foldername(value text) returns text[] language sql immutable as $$ select (string_to_array(value,'/'))[1:array_length(string_to_array(value,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant all on storage.objects,storage.buckets to service_role;
grant select,insert,update,delete on storage.objects to anon,authenticated;
-- Existing permissive policies must not accidentally open the new private bucket.
create policy fixture_broad_storage on storage.objects for all to authenticated,anon using(true) with check(true);
\i supabase/migrations/20261027053642_pm_material_intake.sql
\i supabase/migrations/20261027053642_pm_material_intake.sql
insert into storage.buckets(id,name,public) values('existing-unrelated','existing-unrelated',true);
insert into storage.objects(bucket_id,name) values('existing-unrelated','unaffected.txt');
select set_config('hana.test.project',(select id::text from public.hana_projects where owner_id='10000000-0000-4000-8000-000000000007' limit 1),true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
select set_config('request.jwt.claims','{"app_metadata":{"hana_office_access":true}}',true);
set local role authenticated;
do $$ declare file_path text:='10000000-0000-4000-8000-000000000007/'||current_setting('hana.test.project')||'/30000000-0000-4000-8000-000000000001/'||repeat('a',64)||'.png';n int;begin
 insert into storage.objects(bucket_id,name,metadata) values('hana-work-intake',file_path,'{"mimetype":"image/png","size":4}');
 if (select count(*) from storage.objects where bucket_id='hana-work-intake')<>1 then raise exception 'intake_owner_cannot_read';end if;
 update storage.objects set metadata='{}' where bucket_id='hana-work-intake';get diagnostics n=row_count;if n<>0 then raise exception 'intake_overwrite_allowed';end if;
 delete from storage.objects where bucket_id='hana-work-intake';get diagnostics n=row_count;if n<>0 then raise exception 'intake_delete_allowed';end if;
 begin insert into storage.objects(bucket_id,name) values('hana-work-intake',replace(file_path,current_setting('hana.test.project'),'20000000-0000-4000-8000-000000000099'));raise exception 'foreign_project_allowed';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('hana-work-intake',replace(file_path,'.png','.html'));raise exception 'executable_upload_allowed';exception when insufficient_privilege then null;end;
 if not exists(select 1 from storage.objects where bucket_id='existing-unrelated') then raise exception 'other_bucket_read_changed';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from storage.objects where bucket_id='hana-work-intake') then raise exception 'cross_owner_file_read';end if;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
select set_config('request.jwt.claims','{"user_metadata":{"hana_office_access":true}}',true);
do $$ begin if exists(select 1 from storage.objects where bucket_id='hana-work-intake') then raise exception 'user_metadata_file_access';end if;end $$;
reset role;
set local role anon;
do $$ begin if exists(select 1 from storage.objects where bucket_id='hana-work-intake') then raise exception 'anon_file_read';end if;end $$;
reset role;
select 'PASS: private intake upload/read, owner/project isolation, immutable files, broad-policy protection and repeatable migration' as intake_result;
