-- Private append-only work intake. No production rows, schedules or secrets are changed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hana-work-intake','hana-work-intake',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/markdown'])
on conflict(id) do nothing;
do $$ begin
 if not exists(select 1 from storage.buckets where id='hana-work-intake' and public=false and file_size_limit<=10485760 and allowed_mime_types <@ array['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/markdown']::text[]) then
  raise exception 'intake_bucket_configuration_conflict';
 end if;
end $$;
-- Preserve every other bucket's policies. Restrictive guards also protect against existing broad policies.
drop policy if exists hana_intake_owner_guard on storage.objects;
create policy hana_intake_owner_guard on storage.objects as restrictive for all to authenticated
using(bucket_id <> 'hana-work-intake' or (
 (storage.foldername(name))[1]=(select auth.uid())::text
 and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true'
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{64}[.](jpg|jpeg|png|webp|pdf|txt|md)$'
 and exists(select 1 from public.hana_projects p where p.owner_id=(select auth.uid()) and p.id::text=(storage.foldername(storage.objects.name))[2])
))
with check(bucket_id <> 'hana-work-intake' or (
 (storage.foldername(name))[1]=(select auth.uid())::text
 and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true'
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{64}[.](jpg|jpeg|png|webp|pdf|txt|md)$'
 and exists(select 1 from public.hana_projects p where p.owner_id=(select auth.uid()) and p.id::text=(storage.foldername(storage.objects.name))[2])
));
drop policy if exists hana_intake_read on storage.objects;
create policy hana_intake_read on storage.objects for select to authenticated using(bucket_id='hana-work-intake');
drop policy if exists hana_intake_insert on storage.objects;
create policy hana_intake_insert on storage.objects for insert to authenticated with check(bucket_id='hana-work-intake');
drop policy if exists hana_intake_anon_guard on storage.objects;
create policy hana_intake_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'hana-work-intake') with check(bucket_id<>'hana-work-intake');
drop policy if exists hana_intake_no_replace on storage.objects;
create policy hana_intake_no_replace on storage.objects as restrictive for update to authenticated using(bucket_id<>'hana-work-intake') with check(bucket_id<>'hana-work-intake');
drop policy if exists hana_intake_no_delete on storage.objects;
create policy hana_intake_no_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'hana-work-intake');
grant select,insert on storage.objects to authenticated;
