-- Install restricted worker helpers only. Does not enable schedules or make HTTP calls.
begin;
create or replace function public.hana_calendar_worker_verify(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
 select coalesce(length(p_token)=64 and p_token~'^[0-9a-f]{64}$' and exists(
 select 1 from vault.decrypted_secrets v where v.name='hana_calendar_background_worker_secret'
 and extensions.digest(convert_to(v.decrypted_secret,'UTF8'),'sha256')=extensions.digest(convert_to(p_token,'UTF8'),'sha256')),false)
$$;
revoke all on function public.hana_calendar_worker_verify(text) from public, anon, authenticated;
grant execute on function public.hana_calendar_worker_verify(text) to service_role;
create or replace function public.hana_calendar_background_status()
returns jsonb language sql stable security definer set search_path = ''
as $$
 select jsonb_build_object(
 'current',exists(select 1 from cron.job where jobname='hana-calendar-current' and active),
 'next',exists(select 1 from cron.job where jobname='hana-calendar-next' and active),
 'monthly',exists(select 1 from cron.job where jobname='hana-calendar-monthly' and active))
$$;
revoke all on function public.hana_calendar_background_status() from public, anon, authenticated;
grant execute on function public.hana_calendar_background_status() to service_role;
commit;
