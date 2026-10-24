-- Additive release candidate; apply once before publishing the reviewed frontend.
-- Stores private links only. No OAuth tokens, file contents or public storage buckets.
create table public.hana_project_materials (
  owner_id uuid not null references auth.users(id),
  project text not null check (length(btrim(project)) between 1 and 100 and project=btrim(project)),
  folder_url text not null check (length(folder_url)<=2048 and folder_url ~ '^https://(1drv[.]ms|onedrive[.]live[.]com|[a-zA-Z0-9-]+[.]sharepoint[.]com)(/|$)'),
  primary key (owner_id,project)
);
alter table public.hana_project_materials enable row level security;
revoke all on public.hana_project_materials from anon,authenticated;
grant select,insert,update on public.hana_project_materials to authenticated;
grant all on public.hana_project_materials to service_role;
create policy materials_owner_select on public.hana_project_materials for select to authenticated
using ((select auth.uid())=owner_id and (select auth.jwt()->'app_metadata'->>'hana_office_access')='true');
create policy materials_owner_insert on public.hana_project_materials for insert to authenticated
with check ((select auth.uid())=owner_id and (select auth.jwt()->'app_metadata'->>'hana_office_access')='true');
create policy materials_owner_update on public.hana_project_materials for update to authenticated
using ((select auth.uid())=owner_id and (select auth.jwt()->'app_metadata'->>'hana_office_access')='true')
with check ((select auth.uid())=owner_id and (select auth.jwt()->'app_metadata'->>'hana_office_access')='true');
