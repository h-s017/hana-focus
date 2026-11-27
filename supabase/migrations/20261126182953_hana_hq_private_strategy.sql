create table if not exists public.hana_hq_strategy_versions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 revision integer not null check(revision>0),
 payload jsonb not null check(jsonb_typeof(payload)='object' and length(payload::text)<=24000),
 approved_at timestamptz not null default now(),
 unique(owner_id,revision)
);

create table if not exists public.hana_hq_financial_facts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 line_key text not null check(length(line_key) between 1 and 120),
 event_type text not null check(event_type in ('contracted','recognized','invoiced','received')),
 event_date date not null,
 business_line text not null check(business_line in ('education','product_development','core_product')),
 market text not null check(market in ('B2B','B2G','B2C')),
 channel text not null check(channel in ('direct','partner')),
 currency text not null check(currency in ('TWD','USD','JPY','EUR')),
 amount_minor bigint not null check(abs(amount_minor::numeric)<=1000000000000000),
 direct_cost_minor bigint check(direct_cost_minor between 0 and 1000000000000000),
 quantity_milli bigint check(quantity_milli between 0 and 999999999),
 source_ref text not null check(length(source_ref) between 1 and 180),
 recorded_at timestamptz not null default now(),
 check(event_type='recognized' or (direct_cost_minor is null and quantity_milli is null)),
 unique(owner_id,line_key,event_type)
);
create index if not exists hq_financial_facts_period on public.hana_hq_financial_facts(owner_id,event_date);
alter table public.hana_hq_strategy_versions enable row level security;
alter table public.hana_hq_financial_facts enable row level security;
revoke all on public.hana_hq_strategy_versions, public.hana_hq_financial_facts from public,anon,authenticated;
grant select,insert on public.hana_hq_strategy_versions,public.hana_hq_financial_facts to service_role;

alter table public.hana_business_opportunities
 add column if not exists business_line text check(business_line in ('education','product_development','core_product')),
 add column if not exists market text check(market in ('B2B','B2G','B2C')),
 add column if not exists channel text check(channel in ('direct','partner'));

create or replace function public.hana_hq_classify_strategy_prospect() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (new.score_components->>'strategy_revision') ~ '^[1-9][0-9]{0,5}$' then
  new.business_line:=new.score_components->>'business_line';
  new.market:=new.score_components->>'market';
  new.channel:=new.score_components->>'channel';
 end if;
 return new;
end $$;
drop trigger if exists hana_hq_classify_strategy_prospect on public.hana_business_opportunities;
create trigger hana_hq_classify_strategy_prospect before insert on public.hana_business_opportunities
 for each row execute function public.hana_hq_classify_strategy_prospect();
revoke all on function public.hana_hq_classify_strategy_prospect() from public,anon,authenticated;
grant execute on function public.hana_hq_classify_strategy_prospect() to service_role;

create or replace function public.hana_hq_strategy_run_day(p_owner uuid,p_run uuid) returns date
language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required'; end if;
 return (select local_day from public.hana_hq_daily_runs where owner_id=p_owner and id=p_run and status='running');
end $$;
revoke all on function public.hana_hq_strategy_run_day(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hana_hq_strategy_run_day(uuid,uuid) to service_role;

create or replace function public.hana_hq_strategy_get(p_owner uuid,p_as_of date default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required'; end if;
 return (select to_jsonb(version)-'owner_id' from public.hana_hq_strategy_versions version
  where version.owner_id=p_owner and (p_as_of is null or (version.payload->>'effective_from')::date<=p_as_of)
  order by version.revision desc limit 1);
end $$;

create or replace function public.hana_hq_strategy_save(p_owner uuid,p_expected integer,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 previous public.hana_hq_strategy_versions%rowtype;
 saved public.hana_hq_strategy_versions%rowtype;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required'; end if;
 if p_expected is null or p_expected<0 or jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>24000 then raise exception 'hq_strategy_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hq-strategy:'||p_owner::text,0));
 select * into previous from public.hana_hq_strategy_versions
  where owner_id=p_owner order by revision desc limit 1;
 if previous.revision=p_expected+1 and previous.payload=p_payload then return to_jsonb(previous)-'owner_id'; end if;
 if coalesce(previous.revision,0)<>p_expected then raise exception 'hq_strategy_conflict'; end if;
 insert into public.hana_hq_strategy_versions(owner_id,revision,payload)
  values(p_owner,p_expected+1,p_payload) returning * into saved;
 return to_jsonb(saved)-'owner_id';
end $$;

create or replace function public.hana_hq_strategy_fact(p_owner uuid,p_fact jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 matched public.hana_hq_financial_facts%rowtype;
 proposed public.hana_hq_financial_facts%rowtype;
 input jsonb;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required'; end if;
 if jsonb_typeof(p_fact) is distinct from 'object' then raise exception 'hq_strategy_invalid'; end if;
 input:=(p_fact-'type')||jsonb_build_object('event_type',p_fact->>'type');
 proposed:=jsonb_populate_record(null::public.hana_hq_financial_facts,input);
 if proposed.event_date>(now() at time zone 'Asia/Taipei')::date then raise exception 'hq_strategy_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hq-fact:'||p_owner::text||':'||proposed.line_key,0));
 if exists(select 1 from public.hana_hq_financial_facts
  where owner_id=p_owner and line_key=proposed.line_key and
  (business_line,market,channel,currency) is distinct from (proposed.business_line,proposed.market,proposed.channel,proposed.currency)) then
  raise exception 'hq_strategy_conflict';
 end if;
 insert into public.hana_hq_financial_facts(owner_id,line_key,event_type,event_date,business_line,market,channel,currency,amount_minor,direct_cost_minor,quantity_milli,source_ref)
 values(p_owner,proposed.line_key,proposed.event_type,proposed.event_date,proposed.business_line,proposed.market,proposed.channel,proposed.currency,proposed.amount_minor,proposed.direct_cost_minor,proposed.quantity_milli,proposed.source_ref)
 on conflict(owner_id,line_key,event_type) do nothing returning * into matched;
 if found then return jsonb_build_object('id',matched.id,'replayed',false); end if;
 select * into matched from public.hana_hq_financial_facts where owner_id=p_owner and line_key=proposed.line_key and event_type=proposed.event_type;
 if (to_jsonb(matched)-array['id','owner_id','recorded_at']) is distinct from (to_jsonb(proposed)-array['id','owner_id','recorded_at']) then
  raise exception 'hq_strategy_conflict';
 end if;
 return jsonb_build_object('id',matched.id,'replayed',true);
end $$;

create or replace function public.hana_hq_strategy_report(p_owner uuid,p_through date,p_period text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 period_start date;
 strategy jsonb;
 report jsonb;
 report_currency text;
begin
 if not public.hana_focus_allowed(p_owner) then raise exception 'hq_owner_required'; end if;
 if p_through is null or p_through>(now() at time zone 'Asia/Taipei')::date then raise exception 'hq_strategy_invalid'; end if;
 period_start:=case p_period when 'daily' then p_through when 'weekly' then date_trunc('week',p_through::timestamp)::date
  when 'monthly' then date_trunc('month',p_through::timestamp)::date when 'yearly' then date_trunc('year',p_through::timestamp)::date end;
 if period_start is null then raise exception 'hq_strategy_invalid'; end if;
 strategy:=public.hana_hq_strategy_get(p_owner,p_through);
 report_currency:=strategy->'payload'->>'currency';
 with records as (
  select * from public.hana_hq_financial_facts where owner_id=p_owner and event_date between period_start and p_through
 ), grouped as (
  select currency,event_type,business_line,market,channel,count(*) as count,
    sum(amount_minor)::text as amount_minor,
    case when count(*)=count(direct_cost_minor) then sum(direct_cost_minor)::text end as cost_minor,
    case when count(*)=count(quantity_milli) then sum(quantity_milli)::text end as quantity_milli
  from records group by currency,event_type,business_line,market,channel
 ), crm as (
  select coalesce(business_line,'unclassified') as business_line,count(*) as opened,
   count(*) filter(where stage='won') as now_won,count(*) filter(where stage='lost') as now_lost,
   count(*) filter(where next_followup_at is not null and (next_followup_at at time zone 'Asia/Taipei')::date<=p_through and stage not in ('won','lost')) as followups_due
  from public.hana_business_opportunities where owner_id=p_owner and workspace='work'
   and (created_at at time zone 'Asia/Taipei')::date between period_start and p_through
  group by 1
 ), annual_core as (
  select sum(amount_minor)::text as amount_minor from public.hana_hq_financial_facts
  where owner_id=p_owner and currency=report_currency and event_type='recognized' and business_line='core_product'
   and event_date between date_trunc('year',p_through::timestamp)::date and p_through
 )
 select jsonb_build_object('period',p_period,'start',period_start,'through',p_through,'currency',report_currency,
  'strategy_revision',strategy->'revision','annual_core_actual_minor',(select amount_minor from annual_core),
  'annual_core_target_minor',(select target->'core_target_minor' from jsonb_array_elements(strategy->'payload'->'years') target where (target->>'year')::int=extract(year from p_through)),
  'financial_rows',(select coalesce(jsonb_agg(to_jsonb(grouped) order by currency,event_type,business_line,market,channel),'[]') from grouped),
  'crm_rows',(select coalesce(jsonb_agg(to_jsonb(crm) order by business_line),'[]') from crm),
  'unmeasured',jsonb_build_array('cash_flow','cash_balance','accounts_receivable','enrollment_conversion','on_time_delivery','sampling_conversion','repeat_purchase','automation_rate','founder_dependence'),
  'data_scope','owner_confirmed_ledger_rows_and_current_stage_of_created_opportunities')
 into report;
 return report;
end $$;

revoke all on function public.hana_hq_strategy_get(uuid,date),public.hana_hq_strategy_save(uuid,integer,jsonb),
 public.hana_hq_strategy_fact(uuid,jsonb),public.hana_hq_strategy_report(uuid,date,text) from public,anon,authenticated;
grant execute on function public.hana_hq_strategy_get(uuid,date),public.hana_hq_strategy_save(uuid,integer,jsonb),
 public.hana_hq_strategy_fact(uuid,jsonb),public.hana_hq_strategy_report(uuid,date,text) to service_role;
