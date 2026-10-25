-- NT$0 worker: PM rules only. No provider key or paid request.
create function public.hana_automation_claim_rules(p_cap integer default 3) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t record; v_run uuid; v_day timestamptz := date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
begin
 if p_cap is null or p_cap not between 1 and 10 then raise exception 'invalid_cap'; end if;
 for t in select q.*,s.daily_limit,s.scope_note,s.source_item_id,s.source_read_allowed
 from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='queued' and q.role='Project Manager' and u.deleted_at is null
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

revoke all on function public.hana_automation_claim_rules(integer) from public,anon,authenticated;
grant execute on function public.hana_automation_claim_rules(integer) to service_role;

-- Free PM work is fully database-local: no HTTP queue, external token or model call.
create function public.hana_run_free_pm_tick() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t jsonb; result text;owner uuid;task uuid;run uuid;
begin
 perform public.hana_automation_recover();
 perform public.hana_automation_advance();
 t:=public.hana_automation_claim_rules(3);
 if t is null then return jsonb_build_object('status','idle_or_limited','mode','rules','paid_api_calls',0);end if;
 owner:=(t->>'owner_id')::uuid;task:=(t->>'id')::uuid;run:=(t->>'run_id')::uuid;
 result:='免費 PM 背景規則式草稿｜待本人審核，非 AI API 產稿'||E'\n專案：'||(t->>'project')||E'\n範圍：'||(t->>'scope_note')||E'\n任務：'||(t->>'title')||E'\n\n';
 if t->>'parent_task_id' is not null then
  result:=result||'上一角色已取得本人內部核准。本輪進行最後進度彙整，流程在此停止，不再建立策略循環。';
 else
  result:=result||'先核對需求、來源、素材缺件及期限；策略與創意由人工協作整理，每階段成果待本人審核。';
 end if;
 result:=left(result||E'\n內部核准不代表客戶核准、印刷完稿或正式交付。NT$0 模式不讀取照片送 AI，也不寄送或修改預約。\n\n需求與來源（未自行查證）：\n'||(t->>'brief'),50000);
 perform public.hana_finish_task(owner,task,run,result,null);
 insert into public.hana_automation_events(owner_id,project,task_id,run_id,code,details)
 values(owner,t->>'project',task,run,'free_pm_review_ready','{"mode":"rules","paid_api_calls":0,"external_writes":false}');
 return jsonb_build_object('status','review','task_id',task,'mode','rules','paid_api_calls',0);
end $$;
revoke all on function public.hana_run_free_pm_tick() from public,anon,authenticated;
grant execute on function public.hana_run_free_pm_tick() to service_role;
