-- Additive candidate; no production data updates, schedules, credentials or external writes.
create table if not exists public.hana_projects(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),name text not null check(length(name) between 1 and 100),legacy_name text not null check(length(legacy_name) between 1 and 100),workspace text not null check(workspace in ('work','church')),external_id text not null,active_version_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,id),unique(owner_id,workspace,legacy_name),unique(owner_id,external_id));
create table if not exists public.hana_project_versions(id uuid primary key default gen_random_uuid(),owner_id uuid not null,project_id uuid not null,label text not null,version_date date not null,state text not null default 'internal_draft' check(state in ('internal_draft','approved_internal')),contract jsonb not null default '{}',included_terms jsonb not null default '[]',excluded_terms jsonb not null default '[]',source_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,project_id,id),unique(owner_id,project_id,label),foreign key(owner_id,project_id) references public.hana_projects(owner_id,id));
create table if not exists public.hana_project_documents(id uuid primary key default gen_random_uuid(),owner_id uuid not null,project_id uuid not null,version_id uuid not null,source_system text not null,external_id text not null,source_url text not null,content text not null check(length(content)<=60000),content_hash text not null,source_edited_at timestamptz,last_synced_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,version_id,source_system,external_id),foreign key(owner_id,project_id,version_id) references public.hana_project_versions(owner_id,project_id,id));
create table if not exists public.hana_external_ids(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),provider text not null check(provider in ('local','notion','manual')),external_id text not null,task_id uuid not null references public.hana_tasks(id),source_hash text not null,sync_revision integer not null,source_edited_at timestamptz,last_synced_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,provider,external_id));
create table if not exists public.hana_sync_conflicts(id uuid primary key default gen_random_uuid(),owner_id uuid not null,project_id uuid not null,version_id uuid not null,task_id uuid references public.hana_tasks(id),provider text not null,external_id text not null,source_hash text not null,incoming jsonb not null,local_revision integer,state text not null default 'pending' check(state in ('pending','keep_local','accept_source')),reason text not null,created_at timestamptz not null default now(),reviewed_at timestamptz,foreign key(owner_id,project_id,version_id) references public.hana_project_versions(owner_id,project_id,id));
create unique index if not exists hana_sync_conflict_pending on public.hana_sync_conflicts(owner_id,provider,external_id,source_hash) where state='pending';
create table if not exists public.hana_sync_state(id uuid primary key default gen_random_uuid(),owner_id uuid not null,project_id uuid not null,provider text not null default 'notion',config jsonb not null default '{}',cursor_at timestamptz,enabled boolean not null default false,state text not null default 'not_configured',last_attempt_at timestamptz,last_success_at timestamptz,error_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,project_id,provider),foreign key(owner_id,project_id) references public.hana_projects(owner_id,id));
create table if not exists public.hana_focus_ideas(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),workspace text not null check(workspace in ('work','church')),external_id text not null,content text not null check(length(content) between 1 and 12000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,external_id));
alter table public.hana_tasks add column if not exists project_id uuid;
alter table public.hana_tasks add column if not exists version_id uuid;
alter table public.hana_tasks add column if not exists record_revision integer not null default 0;
alter table public.hana_tasks add column if not exists work_state text not null default 'todo' check(work_state in ('todo','in_progress','waiting','done'));
alter table public.hana_tasks add column if not exists priority integer not null default 2 check(priority between 1 and 3);
alter table public.hana_tasks add column if not exists scope_status text not null default 'needs_review' check(scope_status in ('in_scope','out_of_scope','needs_review'));
alter table public.hana_tasks add column if not exists task_kind text not null default 'agent' check(task_kind in ('agent','tracking'));
alter table public.hana_tasks add column if not exists assigned_role text not null default 'HANA';
alter table public.hana_tasks add column if not exists canonical_key text;
alter table public.hana_tasks add column if not exists source_system text not null default 'legacy';
alter table public.hana_tasks add column if not exists source_url text;
alter table public.hana_tasks add column if not exists source_edited_at timestamptz;
alter table public.hana_tasks add column if not exists last_synced_at timestamptz;
alter table public.hana_tasks add column if not exists source_payload jsonb not null default '{}';
alter table public.hana_tasks add column if not exists dependencies uuid[] not null default '{}';
do $$ begin if not exists(select 1 from pg_constraint where conname='hana_focus_task_version') then alter table public.hana_tasks add constraint hana_focus_task_version foreign key(owner_id,project_id,version_id) references public.hana_project_versions(owner_id,project_id,id);end if;end $$;
create index if not exists hana_focus_work_queue on public.hana_tasks(owner_id,project_id,version_id,scope_status,work_state,priority,due_at);
create index if not exists hana_documents_by_version on public.hana_project_documents(owner_id,project_id,version_id);
create index if not exists hana_conflicts_by_owner on public.hana_sync_conflicts(owner_id,state,created_at);
alter table public.hana_projects enable row level security;
revoke all on public.hana_projects from public,anon,authenticated;
grant all on public.hana_projects to service_role;
grant select on public.hana_projects to authenticated;
drop policy if exists focus_owner_read on public.hana_projects;
create policy focus_owner_read on public.hana_projects for select to authenticated using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
alter table public.hana_project_versions enable row level security;
revoke all on public.hana_project_versions from public,anon,authenticated;
grant all on public.hana_project_versions to service_role;
grant select on public.hana_project_versions to authenticated;
drop policy if exists focus_owner_read on public.hana_project_versions;
create policy focus_owner_read on public.hana_project_versions for select to authenticated using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
alter table public.hana_project_documents enable row level security;
revoke all on public.hana_project_documents from public,anon,authenticated;
grant all on public.hana_project_documents to service_role;
grant select on public.hana_project_documents to authenticated;
drop policy if exists focus_owner_read on public.hana_project_documents;
create policy focus_owner_read on public.hana_project_documents for select to authenticated using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
alter table public.hana_external_ids enable row level security;
revoke all on public.hana_external_ids from public,anon,authenticated;
grant all on public.hana_external_ids to service_role;
grant select on public.hana_external_ids to authenticated;
drop policy if exists focus_owner_read on public.hana_external_ids;
create policy focus_owner_read on public.hana_external_ids for select to authenticated using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
alter table public.hana_sync_conflicts enable row level security;
revoke all on public.hana_sync_conflicts from public,anon,authenticated;
grant all on public.hana_sync_conflicts to service_role;
grant select on public.hana_sync_conflicts to authenticated;
drop policy if exists focus_owner_read on public.hana_sync_conflicts;
create policy focus_owner_read on public.hana_sync_conflicts for select to authenticated using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
alter table public.hana_sync_state enable row level security;
revoke all on public.hana_sync_state from public,anon,authenticated;
grant all on public.hana_sync_state to service_role;
grant select on public.hana_sync_state to authenticated;
drop policy if exists focus_owner_read on public.hana_sync_state;
create policy focus_owner_read on public.hana_sync_state for select to authenticated using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
alter table public.hana_focus_ideas enable row level security;
revoke all on public.hana_focus_ideas from public,anon,authenticated;
grant all on public.hana_focus_ideas to service_role;
grant select on public.hana_focus_ideas to authenticated;
drop policy if exists focus_owner_read on public.hana_focus_ideas;
create policy focus_owner_read on public.hana_focus_ideas for select to authenticated using((select auth.uid())=owner_id and (select auth.jwt())->'app_metadata'->>'hana_office_access'='true');
create or replace function public.hana_focus_allowed(p_owner uuid) returns boolean language sql security invoker set search_path='' as $$ select exists(select 1 from auth.users where id=p_owner and deleted_at is null and raw_app_meta_data->>'hana_office_access'='true') $$;
create or replace function public.hana_focus_hash(p_value jsonb) returns text language sql immutable security invoker set search_path='' as $$ select encode(sha256(convert_to(p_value::text,'UTF8')),'hex') $$;
create or replace function public.hana_focus_title(p_text text) returns text language sql immutable security invoker set search_path='' as $$ select lower(regexp_replace(normalize(p_text,NFKC),'[[:space:]｜|【】\[\]：:、，,／/]','','g')) $$;
create or replace function public.hana_focus_scope(p_title text,p_version uuid,p_owner uuid) returns text language plpgsql security invoker set search_path='' as $$
declare v public.hana_project_versions%rowtype;begin
 select * into v from public.hana_project_versions where id=p_version and owner_id=p_owner;
 if not found then return 'needs_review';end if;
 if exists(select 1 from jsonb_array_elements_text(v.excluded_terms) x where position(public.hana_focus_title(x) in public.hana_focus_title(p_title))>0) then return 'out_of_scope';end if;
 if exists(select 1 from jsonb_array_elements_text(v.included_terms) x where position(public.hana_focus_title(x) in public.hana_focus_title(p_title))>0) then return 'in_scope';end if;return 'needs_review';end $$;
create or replace function public.hana_focus_bootstrap(p_owner uuid,p_payload jsonb,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare project uuid;version uuid;d jsonb;receipt public.hana_automation_events%rowtype;signature text:=public.hana_focus_hash(p_payload);existing public.hana_project_versions%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) or p_request is null then raise exception 'office_access_required';end if;
 if p_payload->>'name' is null or length(p_payload->>'name') not between 1 and 100 or p_payload->>'legacy_name' is null or p_payload->>'workspace' not in ('work','church') or p_payload->'version'->>'label' is null or jsonb_typeof(p_payload->'version'->'included_terms') is distinct from 'array' or jsonb_typeof(p_payload->'version'->'excluded_terms') is distinct from 'array' then raise exception 'invalid_project';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,82));
 select * into receipt from public.hana_automation_events where id=p_request;
 if found then if receipt.owner_id<>p_owner or receipt.details->>'signature' is distinct from signature then raise exception 'request_conflict';end if;return receipt.details->'result';end if;
 select id into project from public.hana_projects where owner_id=p_owner and workspace=p_payload->>'workspace' and legacy_name=p_payload->>'legacy_name';
 if project is null then insert into public.hana_projects(owner_id,name,legacy_name,workspace,external_id) values(p_owner,p_payload->>'name',p_payload->>'legacy_name',p_payload->>'workspace',p_payload->>'external_id') returning id into project;end if;
 select * into existing from public.hana_project_versions where owner_id=p_owner and project_id=project and label=p_payload->'version'->>'label';
 if found then
  if existing.contract is distinct from (coalesce(p_payload->'version'->'contract','{}')||'{"client_approved":false}'::jsonb) or existing.included_terms is distinct from p_payload->'version'->'included_terms' or existing.excluded_terms is distinct from p_payload->'version'->'excluded_terms' then raise exception 'version_conflict';end if;version:=existing.id;
 else
  insert into public.hana_project_versions(owner_id,project_id,label,version_date,contract,included_terms,excluded_terms,source_url) values(p_owner,project,p_payload->'version'->>'label',(p_payload->'version'->>'version_date')::date,coalesce(p_payload->'version'->'contract','{}')||'{"client_approved":false}'::jsonb,p_payload->'version'->'included_terms',p_payload->'version'->'excluded_terms',p_payload->'version'->>'source_url') returning id into version;
 end if;
 update public.hana_projects set active_version_id=version,updated_at=now() where owner_id=p_owner and id=project and active_version_id is null;
 for d in select * from jsonb_array_elements(coalesce(p_payload->'documents','[]')) loop
  if exists(select 1 from public.hana_project_documents where owner_id=p_owner and version_id=version and source_system=d->>'source_system' and external_id=d->>'external_id' and content_hash<>public.hana_focus_hash(d->'content')) then raise exception 'version_conflict';end if;
  insert into public.hana_project_documents(owner_id,project_id,version_id,source_system,external_id,source_url,content,content_hash,source_edited_at)
  values(p_owner,project,version,d->>'source_system',d->>'external_id',d->>'source_url',d->>'content',public.hana_focus_hash(d->'content'),(d->>'source_edited_at')::timestamptz)
  on conflict(owner_id,version_id,source_system,external_id) do nothing;
 end loop;
 insert into public.hana_sync_state(owner_id,project_id,config,state) values(p_owner,project,coalesce(p_payload->'notion_config','{}'),'not_configured') on conflict(owner_id,project_id,provider) do nothing;
 insert into public.hana_automation_events(id,owner_id,project,code,details) values(p_request,p_owner,p_payload->>'legacy_name','focus_project_created',jsonb_build_object('signature',signature,'result',jsonb_build_object('project_id',project,'version_id',version),'client_approved',false));
 return jsonb_build_object('project_id',project,'version_id',version);
end $$;
create or replace function public.hana_focus_import(p_owner uuid,p_project uuid,p_version uuid,p_items jsonb,p_provider text,p_request uuid,p_backup_hash text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare project public.hana_projects%rowtype;item jsonb;mapping public.hana_external_ids%rowtype;task public.hana_tasks%rowtype;receipt public.hana_automation_events%rowtype;signature text;v_source_hash text;task_id uuid;matches integer;added integer:=0;changed integer:=0;skipped integer:=0;conflicts integer:=0;result jsonb;
begin
 if not public.hana_focus_allowed(p_owner) or p_request is null then raise exception 'office_access_required';end if;
 if p_provider is null or p_provider not in ('local','notion','manual') or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100 or octet_length(p_items::text)>500000 then raise exception 'invalid_import';end if;
 if p_provider='local' and (p_backup_hash is null or p_backup_hash!~'^[a-f0-9]{64}$') then raise exception 'backup_required';end if;
 select * into project from public.hana_projects where owner_id=p_owner and id=p_project;
 if not found or not exists(select 1 from public.hana_project_versions where owner_id=p_owner and project_id=p_project and id=p_version) then raise exception 'project_required';end if;
 signature:=public.hana_focus_hash(jsonb_build_object('project',p_project,'version',p_version,'provider',p_provider,'items',p_items,'backup',p_backup_hash));
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,82));
 select * into receipt from public.hana_automation_events where id=p_request;
 if found then if receipt.owner_id<>p_owner or receipt.details->>'signature' is distinct from signature then raise exception 'request_conflict';end if;return receipt.details->'result';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if item->>'external_id' is null or length(item->>'external_id') not between 1 and 300 or item->>'title' is null or length(btrim(item->>'title')) not between 1 and 140 or length(coalesce(item->>'brief',''))>12000 or item->>'work_state' is null or item->>'work_state' not in ('todo','in_progress','waiting','done') or (item->>'priority')::int not between 1 and 3 then raise exception 'invalid_import_task';end if;
  v_source_hash:=public.hana_focus_hash(item);task_id:=null;task:=null;mapping:=null;
  select * into mapping from public.hana_external_ids where owner_id=p_owner and provider=p_provider and external_id=item->>'external_id';
  if found then
   if mapping.source_hash=v_source_hash then skipped:=skipped+1;continue;end if;
   if (item->>'source_edited_at')::timestamptz<mapping.source_edited_at then skipped:=skipped+1;continue;end if;
   select * into task from public.hana_tasks where owner_id=p_owner and id=mapping.task_id for update;
   if not found or task.project_id is distinct from p_project or task.version_id is distinct from p_version or task.record_revision<>mapping.sync_revision or task.status='running' then
    insert into public.hana_sync_conflicts(owner_id,project_id,version_id,task_id,provider,external_id,source_hash,incoming,local_revision,reason) values(p_owner,p_project,p_version,task.id,p_provider,item->>'external_id',v_source_hash,item,task.record_revision,'local_edit_or_version_conflict') on conflict(owner_id,provider,external_id,source_hash) where state='pending' do nothing;
    conflicts:=conflicts+1;continue;
   end if;
   task_id:=task.id;
  else
   select count(*) into matches from public.hana_tasks t where t.owner_id=p_owner and (t.project_id=p_project or (t.project_id is null and t.project=project.legacy_name)) and (public.hana_focus_title(t.title)=public.hana_focus_title(item->>'title') or (item->>'canonical_key' is not null and (t.canonical_key=item->>'canonical_key' or (item->>'canonical_key'='history_wall' and t.title like '%沿革牆%'))));
   if matches>0 then
    -- First-sync near matches are never silently overwritten. Human chooses a canonical task.
    select * into task from public.hana_tasks t where t.owner_id=p_owner and (t.project_id=p_project or (t.project_id is null and t.project=project.legacy_name)) and (public.hana_focus_title(t.title)=public.hana_focus_title(item->>'title') or (item->>'canonical_key'='history_wall' and t.title like '%沿革牆%')) limit 1;
    if matches>1 then task:=null;end if;
    insert into public.hana_sync_conflicts(owner_id,project_id,version_id,task_id,provider,external_id,source_hash,incoming,local_revision,reason) values(p_owner,p_project,p_version,task.id,p_provider,item->>'external_id',v_source_hash,item,task.record_revision,'first_import_matching_task') on conflict(owner_id,provider,external_id,source_hash) where state='pending' do nothing;
    conflicts:=conflicts+1;continue;
   end if;
  end if;
  if task_id is null then
   insert into public.hana_tasks(owner_id,project,project_id,version_id,role,title,brief,work_state,priority,assigned_role,scope_status,task_kind,canonical_key,source_system,source_url,source_edited_at,last_synced_at,record_revision,due_at,source_payload)
   values(p_owner,project.legacy_name,p_project,p_version,'Project Manager',item->>'title',coalesce(item->>'brief',''),item->>'work_state',(item->>'priority')::int,coalesce(item->>'assigned_role','HANA'),public.hana_focus_scope(item->>'title',p_version,p_owner),'tracking',item->>'canonical_key',p_provider,item->>'source_url',(item->>'source_edited_at')::timestamptz,now(),1,(item->>'due_at')::timestamptz,coalesce(item->'source_payload','{}')) returning id into task_id;added:=added+1;
  else
   update public.hana_tasks set source_payload=coalesce(item->'source_payload','{}'),title=item->>'title',brief=coalesce(item->>'brief',''),work_state=item->>'work_state',priority=(item->>'priority')::int,scope_status=public.hana_focus_scope(item->>'title',p_version,p_owner),source_url=item->>'source_url',source_edited_at=(item->>'source_edited_at')::timestamptz,last_synced_at=now(),updated_at=now(),record_revision=record_revision+1 where owner_id=p_owner and id=task_id;changed:=changed+1;
  end if;
  insert into public.hana_external_ids(owner_id,provider,external_id,task_id,source_hash,sync_revision,source_edited_at)
  values(p_owner,p_provider,item->>'external_id',task_id,v_source_hash,(select record_revision from public.hana_tasks where id=task_id and owner_id=p_owner),(item->>'source_edited_at')::timestamptz)
  on conflict(owner_id,provider,external_id) do update set source_hash=excluded.source_hash,sync_revision=excluded.sync_revision,source_edited_at=excluded.source_edited_at,last_synced_at=now(),updated_at=now();
 end loop;
 result:=jsonb_build_object('added',added,'updated',changed,'skipped',skipped,'conflicts',conflicts,'backup_hash',p_backup_hash,'external_writes',false);
 insert into public.hana_automation_events(id,owner_id,project,code,details) values(p_request,p_owner,project.legacy_name,'focus_imported',jsonb_build_object('signature',signature,'result',result,'provider',p_provider));return result;
end $$;
create or replace function public.hana_focus_update(p_owner uuid,p_task uuid,p_revision integer,p_patch jsonb,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.hana_tasks%rowtype;effective_dependencies uuid[];signature text:=public.hana_focus_hash(jsonb_build_object('task',p_task,'revision',p_revision,'patch',p_patch));receipt public.hana_automation_events%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'office_access_required';end if;
 if p_request is null or jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('work_state','priority','assigned_role','due_at','scope_status','dependencies')) then raise exception 'invalid_patch';end if;
 select * into t from public.hana_tasks where owner_id=p_owner and id=p_task for update;if not found then raise exception 'task_not_found';end if;
 select * into receipt from public.hana_automation_events where id=p_request;if found then if receipt.owner_id<>p_owner or receipt.details->>'signature' is distinct from signature then raise exception 'request_conflict';end if;return to_jsonb(t);end if;
 if t.record_revision<>p_revision then raise exception 'record_conflict';end if;
 if p_patch?'work_state' and (p_patch->>'work_state' is null or p_patch->>'work_state' not in ('todo','in_progress','waiting','done')) then raise exception 'invalid_patch';end if;
 if p_patch?'scope_status' and (p_patch->>'scope_status' is null or p_patch->>'scope_status' not in ('in_scope','out_of_scope','needs_review') or (p_patch->>'scope_status'='in_scope' and public.hana_focus_scope(t.title,t.version_id,p_owner)='out_of_scope')) then raise exception 'scope_change_requires_new_version';end if;
 if p_patch?'dependencies' then
  if jsonb_typeof(p_patch->'dependencies') is distinct from 'array' or jsonb_array_length(p_patch->'dependencies')>20 or exists(select 1 from jsonb_array_elements_text(p_patch->'dependencies') d where d::uuid=p_task or not exists(select 1 from public.hana_tasks q where q.id=d::uuid and q.owner_id=p_owner)) then raise exception 'invalid_dependencies';end if;
 end if;
 effective_dependencies:=case when p_patch?'dependencies' then array(select distinct d::uuid from jsonb_array_elements_text(p_patch->'dependencies') d) else t.dependencies end;
 if p_patch->>'work_state'='done' and exists(select 1 from unnest(effective_dependencies) d where not exists(select 1 from public.hana_tasks q where q.id=d and q.owner_id=p_owner and q.work_state='done' and q.scope_status='in_scope')) then raise exception 'dependency_conflict';end if;
 if p_patch->>'work_state'='done' and t.task_kind='agent' and t.status<>'approved' then raise exception 'human_review_required';end if;
 update public.hana_tasks set dependencies=effective_dependencies,work_state=coalesce(p_patch->>'work_state',work_state),scope_status=coalesce(p_patch->>'scope_status',scope_status),priority=coalesce((p_patch->>'priority')::int,priority),assigned_role=coalesce(p_patch->>'assigned_role',assigned_role),due_at=case when p_patch?'due_at' then (p_patch->>'due_at')::timestamptz else due_at end,record_revision=record_revision+1,updated_at=now() where id=p_task and owner_id=p_owner returning * into t;
 insert into public.hana_automation_events(id,owner_id,project,task_id,code,details) values(p_request,p_owner,t.project,t.id,'focus_task_updated',jsonb_build_object('signature',signature,'revision',t.record_revision,'patch',p_patch,'client_approved',false));return to_jsonb(t);
end $$;
create or replace function public.hana_focus_agent_allowed(p_owner uuid,p_task uuid) returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from public.hana_tasks t join public.hana_projects p on p.owner_id=t.owner_id and p.id=t.project_id where t.owner_id=p_owner and t.id=p_task and t.scope_status='in_scope' and t.version_id=p.active_version_id and p.workspace='work');
$$;
create or replace function public.hana_focus_resolve(p_owner uuid,p_conflict uuid,p_task uuid,p_revision integer,p_decision text,p_request uuid) returns text language plpgsql security invoker set search_path='' as $$
declare c public.hana_sync_conflicts%rowtype;t public.hana_tasks%rowtype;p public.hana_projects%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) or p_request is null or p_decision is null or p_decision not in ('keep_local','accept_source') then raise exception 'invalid_resolution';end if;
 select * into c from public.hana_sync_conflicts where owner_id=p_owner and id=p_conflict and state='pending' for update;if not found then raise exception 'conflict_not_pending';end if;
 select * into p from public.hana_projects where owner_id=p_owner and id=c.project_id;
 select * into t from public.hana_tasks where owner_id=p_owner and id=p_task for update;
 if not found or t.record_revision<>p_revision or t.status='running' or (t.project_id is distinct from c.project_id and not(t.project_id is null and t.project=p.legacy_name)) then raise exception 'record_conflict';end if;
 if p_decision='accept_source' then
  update public.hana_tasks set project_id=c.project_id,version_id=c.version_id,title=c.incoming->>'title',brief=coalesce(c.incoming->>'brief',''),work_state=c.incoming->>'work_state',priority=(c.incoming->>'priority')::int,scope_status=public.hana_focus_scope(c.incoming->>'title',c.version_id,p_owner),canonical_key=c.incoming->>'canonical_key',source_system=c.provider,source_url=c.incoming->>'source_url',source_edited_at=(c.incoming->>'source_edited_at')::timestamptz,record_revision=record_revision+1,updated_at=now(),last_synced_at=now() where owner_id=p_owner and id=t.id returning * into t;
 end if;
 insert into public.hana_external_ids(owner_id,provider,external_id,task_id,source_hash,sync_revision,source_edited_at) values(p_owner,c.provider,c.external_id,t.id,c.source_hash,t.record_revision,(c.incoming->>'source_edited_at')::timestamptz)
 on conflict(owner_id,provider,external_id) do update set source_hash=excluded.source_hash,task_id=excluded.task_id,sync_revision=excluded.sync_revision,source_edited_at=excluded.source_edited_at,last_synced_at=now(),updated_at=now();
 update public.hana_sync_conflicts set state=p_decision,task_id=t.id,reviewed_at=now() where owner_id=p_owner and id=c.id;
 insert into public.hana_automation_events(id,owner_id,project,task_id,code,details) values(p_request,p_owner,p.legacy_name,t.id,'focus_conflict_reviewed',jsonb_build_object('decision',p_decision,'conflict_id',c.id,'record_revision',t.record_revision));return p_decision;
end $$;
create or replace function public.hana_focus_activate_version(p_owner uuid,p_project uuid,p_version uuid,p_request uuid) returns text language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) or p_request is null or not exists(select 1 from public.hana_project_versions where owner_id=p_owner and project_id=p_project and id=p_version) then raise exception 'invalid_version';end if;
 update public.hana_sync_state set cursor_at=null,state='version_changed',updated_at=now() where owner_id=p_owner and project_id=p_project;
 update public.hana_projects set active_version_id=p_version,updated_at=now() where owner_id=p_owner and id=p_project;
 update public.hana_project_versions set state='approved_internal',updated_at=now() where owner_id=p_owner and id=p_version;
 insert into public.hana_automation_events(id,owner_id,project,code,details) select p_request,p_owner,legacy_name,'focus_version_activated',jsonb_build_object('version_id',p_version,'client_approved',false) from public.hana_projects where owner_id=p_owner and id=p_project;
 return 'approved_internal';
end $$;
create or replace function public.hana_focus_run_start(p_owner uuid,p_task uuid,p_role text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.hana_tasks%rowtype;r public.hana_task_runs%rowtype;run uuid;
begin
 if not public.hana_focus_allowed(p_owner) or p_request is null or p_role is null or p_role not in ('Project Manager','Brand Strategist','Creative Producer') then raise exception 'invalid_role';end if;
 select * into t from public.hana_tasks where owner_id=p_owner and id=p_task for update;if not found then raise exception 'task_not_found';end if;
 select * into r from public.hana_task_runs where owner_id=p_owner and request_id=p_request;
 if found then if r.task_id<>p_task then raise exception 'request_conflict';end if;return jsonb_build_object('fresh',false,'run_id',r.id,'status',r.status);end if;
 if not public.hana_focus_agent_allowed(p_owner,p_task) then raise exception 'scope_or_version_required';end if;
 if t.status in ('running','review') then raise exception 'state_conflict';end if;
 update public.hana_tasks set role=p_role,task_kind='agent',status='queued',record_revision=record_revision+1,updated_at=now() where owner_id=p_owner and id=p_task;
 run:=public.hana_claim_task(p_owner,p_task,p_request);
 insert into public.hana_automation_events(owner_id,project,task_id,run_id,code,details) values(p_owner,t.project,t.id,run,'focus_agent_started',jsonb_build_object('role',p_role,'mode','free_tools','paid_api_calls',0));
 return jsonb_build_object('fresh',true,'run_id',run,'status','running');
end $$;
create or replace function public.hana_focus_can_run(p_owner uuid,p_task uuid) returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from public.hana_tasks t where t.owner_id=p_owner and t.id=p_task and t.scope_status<>'out_of_scope' and t.task_kind='agent' and (public.hana_focus_agent_allowed(p_owner,p_task) or (t.project_id is null and not exists(select 1 from public.hana_projects p where p.owner_id=p_owner and p.legacy_name=t.project and p.active_version_id is not null))));
$$;
create or replace function public.hana_focus_guard_claim() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='running' and (new.scope_status='out_of_scope' or new.task_kind<>'agent' or (new.project_id is not null and not public.hana_focus_agent_allowed(new.owner_id,new.id)) or (new.project_id is null and exists(select 1 from public.hana_projects p where p.owner_id=new.owner_id and p.legacy_name=new.project and p.active_version_id is not null))) then raise exception 'scope_or_version_required';end if;return new;
end $$;
drop trigger if exists hana_focus_claim_guard on public.hana_tasks;
create trigger hana_focus_claim_guard before update of status on public.hana_tasks for each row execute function public.hana_focus_guard_claim();
create or replace function public.hana_focus_snapshot(p_owner uuid) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object(
 'projects',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.hana_projects p where owner_id=p_owner),
 'versions',(select coalesce(jsonb_agg(to_jsonb(v)),'[]') from public.hana_project_versions v where owner_id=p_owner),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from public.hana_tasks where owner_id=p_owner order by updated_at desc limit 1000)t),
 'truncated',(select count(*)>1000 from public.hana_tasks where owner_id=p_owner),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from public.hana_project_documents d where owner_id=p_owner),
 'conflicts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select * from public.hana_sync_conflicts where owner_id=p_owner order by created_at desc limit 100)c),
 'sync',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.hana_sync_state s where owner_id=p_owner),
 'ideas',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.hana_focus_ideas i where owner_id=p_owner),
 'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select * from public.hana_automation_events where owner_id=p_owner order by created_at desc limit 50)e),
 'runs',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from public.hana_task_runs where owner_id=p_owner order by created_at desc limit 100)r));
$$;
-- Client task creation retains the legacy form but cannot forge project/version/source metadata.
drop policy if exists hana_tasks_owner_insert on public.hana_tasks;
create policy hana_tasks_owner_insert on public.hana_tasks for insert to authenticated with check((select auth.uid())=owner_id and status='queued' and result is null and parent_task_id is null and active_run_id is null and project_id is null and version_id is null and scope_status='needs_review' and record_revision=0 and source_system='legacy');

create or replace function public.hana_automation_claim_rules(p_cap integer default 3) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t record; v_run uuid; v_day timestamptz := date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
begin
 if p_cap is null or p_cap not between 1 and 10 then raise exception 'invalid_cap'; end if;
 for t in select q.*,s.daily_limit,s.scope_note,s.source_item_id,s.source_read_allowed
 from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='queued' and public.hana_focus_can_run(q.owner_id,q.id) and q.role='Project Manager' and u.deleted_at is null
 and u.raw_app_meta_data->>'hana_office_access'='true'
 and (q.parent_task_id is null or exists(select 1 from public.hana_tasks p where p.id=q.parent_task_id and p.owner_id=q.owner_id and p.status='approved'))
 order by q.created_at limit 100 for update of q,s skip locked
 loop
  if not pg_try_advisory_xact_lock(hashtextextended(t.owner_id::text,41)) then continue; end if;
  if exists(select 1 from public.hana_tasks r where r.owner_id=t.owner_id and r.status='running') then continue; end if;
  if (select count(*) from public.hana_task_runs r where r.owner_id=t.owner_id and r.created_at>=v_day)>=p_cap then continue; end if;
  if (select count(*) from public.hana_task_runs r join public.hana_tasks q on q.id=r.task_id where r.owner_id=t.owner_id and q.project=t.project and r.created_at>=v_day)>=t.daily_limit then continue; end if;
  if (select count(*) from public.hana_task_runs r where r.task_id=t.id)>=3 then continue; end if;
  v_run:=public.hana_claim_task(t.owner_id,t.id,gen_random_uuid());
  insert into public.hana_automation_events(owner_id,project,task_id,run_id,code) values(t.owner_id,t.project,t.id,v_run,'claimed');
  return to_jsonb(t)||jsonb_build_object('run_id',v_run);
 end loop;
 return null;
end $$;

create or replace function public.hana_automation_claim(p_cap integer default 3) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t record; v_run uuid; v_day timestamptz := date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
begin
 if p_cap is null or p_cap not between 1 and 10 then raise exception 'invalid_cap'; end if;
 for t in select q.*,s.daily_limit,s.scope_note,s.source_item_id,s.source_read_allowed
 from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='queued' and public.hana_focus_can_run(q.owner_id,q.id) and u.deleted_at is null
 and u.raw_app_meta_data->>'hana_office_access'='true'
 and (q.parent_task_id is null or exists(select 1 from public.hana_tasks p where p.id=q.parent_task_id and p.owner_id=q.owner_id and p.status='approved'))
 order by q.created_at limit 100 for update of q,s skip locked
 loop
  if not pg_try_advisory_xact_lock(hashtextextended(t.owner_id::text,41)) then continue; end if;
  if exists(select 1 from public.hana_tasks r where r.owner_id=t.owner_id and r.status='running') then continue; end if;
  if (select count(*) from public.hana_task_runs r where r.owner_id=t.owner_id and r.created_at>=v_day)>=p_cap then continue; end if;
  if (select count(*) from public.hana_task_runs r join public.hana_tasks q on q.id=r.task_id where r.owner_id=t.owner_id and q.project=t.project and r.created_at>=v_day)>=t.daily_limit then continue; end if;
  if (select count(*) from public.hana_task_runs r where r.task_id=t.id)>=3 then continue; end if;
  v_run:=public.hana_claim_task(t.owner_id,t.id,gen_random_uuid());
  insert into public.hana_automation_events(owner_id,project,task_id,run_id,code) values(t.owner_id,t.project,t.id,v_run,'claimed');
  return to_jsonb(t)||jsonb_build_object('run_id',v_run);
 end loop;
 return null;
end $$;

create or replace function public.hana_automation_advance() returns integer
language plpgsql security invoker set search_path='' as $$
declare t record; n integer:=0; v_child uuid;
begin
 for t in select q.* from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='approved' and public.hana_focus_can_run(q.owner_id,q.id) and u.deleted_at is null and u.raw_app_meta_data->>'hana_office_access'='true'
 and not(q.role='Project Manager' and q.parent_task_id is not null)
 and not exists(select 1 from public.hana_tasks c where c.parent_task_id=q.id)
 order by q.created_at limit 10 for update of q,s skip locked
 loop
  v_child:=public.hana_handoff_task(t.owner_id,t.id,gen_random_uuid());
  insert into public.hana_automation_events(owner_id,project,task_id,code,details) values(t.owner_id,t.project,t.id,'handoff',jsonb_build_object('child_task_id',v_child));
  n:=n+1;
 end loop;
 return n;
end $$;

revoke all on function public.hana_focus_allowed(uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_allowed(uuid) to service_role;

revoke all on function public.hana_focus_hash(jsonb) from public,anon,authenticated;
grant execute on function public.hana_focus_hash(jsonb) to service_role;

revoke all on function public.hana_focus_title(text) from public,anon,authenticated;
grant execute on function public.hana_focus_title(text) to service_role;

revoke all on function public.hana_focus_scope(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_scope(text,uuid,uuid) to service_role;

revoke all on function public.hana_focus_bootstrap(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_bootstrap(uuid,jsonb,uuid) to service_role;

revoke all on function public.hana_focus_import(uuid,uuid,uuid,jsonb,text,uuid,text) from public,anon,authenticated;
grant execute on function public.hana_focus_import(uuid,uuid,uuid,jsonb,text,uuid,text) to service_role;

revoke all on function public.hana_focus_update(uuid,uuid,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_update(uuid,uuid,integer,jsonb,uuid) to service_role;

revoke all on function public.hana_focus_agent_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_agent_allowed(uuid,uuid) to service_role;

revoke all on function public.hana_focus_resolve(uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_resolve(uuid,uuid,uuid,integer,text,uuid) to service_role;

revoke all on function public.hana_focus_activate_version(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_activate_version(uuid,uuid,uuid,uuid) to service_role;

revoke all on function public.hana_focus_run_start(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_run_start(uuid,uuid,text,uuid) to service_role;

revoke all on function public.hana_focus_can_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_can_run(uuid,uuid) to service_role;

revoke all on function public.hana_focus_guard_claim() from public,anon,authenticated;
grant execute on function public.hana_focus_guard_claim() to service_role;

revoke all on function public.hana_focus_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_snapshot(uuid) to service_role;

create or replace function public.hana_handoff_task(p_owner uuid,p_task uuid,p_request uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare t public.hana_tasks%rowtype; v_role text; v_id uuid;
begin
 select * into t from public.hana_tasks where id=p_task and owner_id=p_owner and status='approved' for update;
 if not found then raise exception 'approval_required'; end if;
 if not public.hana_focus_can_run(p_owner,p_task) then raise exception 'scope_or_version_required';end if;
 if t.role='Project Manager' and t.parent_task_id is not null then raise exception 'workflow_finished'; end if;
 v_role := case t.role when 'Project Manager' then 'Brand Strategist' when 'Brand Strategist' then 'Creative Producer' when 'Creative Producer' then 'Project Manager' end;
 if v_role is null then raise exception 'invalid_role'; end if;
 insert into public.hana_tasks(owner_id,project,role,title,brief,parent_task_id,request_id,project_id,version_id,scope_status,task_kind)
 values(p_owner,t.project,v_role,'交接｜'||left(t.title,120),left('上游結果為內部審核核准，非客戶正式核准。保留G1–G5及目前專案版本的範圍限制。來源任務：'||t.id::text||E'\n'||coalesce(t.result,''),12000),t.id,p_request,t.project_id,t.version_id,t.scope_status,t.task_kind)
 returning id into v_id;
 return v_id;
end $$;
create or replace function public.hana_focus_import_ideas(p_owner uuid,p_workspace text,p_items jsonb,p_backup_hash text,p_request uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb;n integer:=0;begin
 if not public.hana_focus_allowed(p_owner) or p_request is null then raise exception 'office_access_required';end if;
 if p_workspace is null or p_workspace not in ('work','church') or p_backup_hash is null or p_backup_hash!~'^[a-f0-9]{64}$' or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>500 then raise exception 'invalid_ideas';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  insert into public.hana_focus_ideas(owner_id,workspace,external_id,content) values(p_owner,p_workspace,item->>'external_id',item->>'content') on conflict(owner_id,external_id) do nothing;n:=n+1;
 end loop;
 insert into public.hana_automation_events(id,owner_id,project,code,details) values(p_request,p_owner,'Idea Inbox','focus_ideas_imported',jsonb_build_object('count',n,'backup_hash',p_backup_hash,'tasks_created',0)) on conflict(id) do nothing;return n;
end $$;
revoke all on function public.hana_focus_import_ideas(uuid,text,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_import_ideas(uuid,text,jsonb,text,uuid) to service_role;

alter table public.hana_sync_state add column if not exists interval_minutes integer not null default 60 check(interval_minutes between 15 and 1440);
alter table public.hana_sync_state add column if not exists next_due_at timestamptz;
create or replace function public.hana_focus_sync_interval(p_owner uuid,p_project uuid,p_minutes integer,p_request uuid) returns text language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) or p_request is null or p_minutes is null or p_minutes not between 15 and 1440 then raise exception 'invalid_sync_interval';end if;
 update public.hana_sync_state set interval_minutes=p_minutes,enabled=false,next_due_at=null,updated_at=now() where owner_id=p_owner and project_id=p_project;if not found then raise exception 'project_required';end if;
 insert into public.hana_automation_events(id,owner_id,project,code,details) select p_request,p_owner,legacy_name,'focus_sync_interval_set',jsonb_build_object('minutes',p_minutes,'enabled',false) from public.hana_projects where owner_id=p_owner and id=p_project;return 'saved_disabled';
end $$;
revoke all on function public.hana_focus_sync_interval(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.hana_focus_sync_interval(uuid,uuid,integer,uuid) to service_role;
