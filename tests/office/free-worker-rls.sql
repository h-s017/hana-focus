create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema vault;
create table vault.decrypted_secrets(name text,decrypted_secret text);
insert into vault.decrypted_secrets values('hana_worker_token',repeat('a',64));
\i supabase/schema/hana-free-worker.sql
insert into auth.users(id,raw_app_meta_data) values('10000000-0000-4000-8000-000000000004','{"hana_office_access":true}');
set local role service_role;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000004';v jsonb;
begin
 if not public.hana_worker_authorized(repeat('a',64)) or public.hana_worker_authorized(repeat('b',64)) then raise exception 'worker_token_check';end if;
 if has_table_privilege('service_role','vault.decrypted_secrets','select') then raise exception 'vault_raw_access';end if;
 if has_function_privilege('authenticated','public.hana_worker_authorized(text)','execute') then raise exception 'token_oracle_exposed';end if;
 insert into public.hana_automation_settings(owner_id,project,enabled,scope_note) values(o,'free-fixture',true,'only wall');
 insert into public.hana_tasks(owner_id,project,role,title,brief) values(o,'free-fixture','Brand Strategist','not automatic','fixture'),(o,'free-fixture','Project Manager','free PM','fixture');
 v:=public.hana_automation_claim_rules(3);
 if v->>'role'<>'Project Manager' then raise exception 'paid_role_claimed';end if;
 perform public.hana_finish_task(o,(v->>'id')::uuid,(v->>'run_id')::uuid,'free rules only');
 if public.hana_automation_claim_rules(3) is not null then raise exception 'strategy_auto_claimed';end if;
end $$;
reset role;
select 'PASS: NT$0 PM-only worker and narrow Vault secret check' as free_result;
