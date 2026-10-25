-- Ephemeral CI PostgreSQL only. No production credentials/data.
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;end $$;
do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;end $$;
do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end $$;
create schema auth;
create table auth.users(id uuid primary key,created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001');
create table public.hana_tasks(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),project text not null,role text not null check(role in ('Project Manager','Brand Strategist','Creative Producer')),title text not null,brief text not null,status text not null default 'queued' check(status in ('queued','running','review','approved','rejected','failed')),result text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.hana_reviews(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.hana_tasks(id),owner_id uuid not null references auth.users(id),decision text not null check(decision in ('approved','rejected','comment')),note text,created_at timestamptz not null default now());
alter table public.hana_tasks enable row level security;
alter table public.hana_reviews enable row level security;
create policy hana_tasks_owner_select on public.hana_tasks for select to authenticated using((select auth.uid())=owner_id);
create policy hana_reviews_owner_select on public.hana_reviews for select to authenticated using((select auth.uid())=owner_id);
grant usage on schema public,auth to anon,authenticated,service_role;
grant all on public.hana_tasks,public.hana_reviews to service_role;
grant select,insert on public.hana_tasks,public.hana_reviews to authenticated;
