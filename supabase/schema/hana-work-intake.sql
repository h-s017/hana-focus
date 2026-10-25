-- Reuses private events as command receipts and existing tasks as the background queue.
create function public.hana_begin_work(p_owner uuid,p_request uuid,p_project text,p_instruction text,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt public.hana_automation_events%rowtype;task uuid;fresh uuid;
begin
 if p_owner is null or p_request is null or p_project is null or p_instruction is null or p_action is null or length(btrim(p_project)) not between 1 and 100 or length(btrim(p_instruction)) not between 1 and 2000 or p_action not in ('project_progress','priorities','orders','calendar','needs_human') then raise exception 'invalid_work';end if;
 if not exists(select 1 from auth.users where id=p_owner and deleted_at is null and raw_app_meta_data->>'hana_office_access'='true') then raise exception 'access_required';end if;
 insert into public.hana_automation_events(id,owner_id,project,code,details)
 values(p_request,p_owner,p_project,'work_running',jsonb_build_object('instruction',p_instruction,'action',p_action,'external_writes',false))
 on conflict(id) do nothing returning id into fresh;
 if fresh is null then
  select * into receipt from public.hana_automation_events where id=p_request and owner_id=p_owner;
  if not found or receipt.details->>'instruction' is distinct from p_instruction or receipt.project is distinct from p_project or receipt.details->>'action' is distinct from p_action then raise exception 'request_conflict';end if;
  return jsonb_build_object('fresh',false,'receipt_id',receipt.id,'state',receipt.code,'summary',receipt.details->>'summary');
 end if;
 if p_action='project_progress' then
  insert into public.hana_automation_settings(owner_id,project,enabled,scope_note,source_read_allowed)
  values(p_owner,p_project,true,'免費交辦：依每筆需求整理既有雲端資料，不自動擴大範圍或對外執行。',false)
  on conflict(owner_id,project) do nothing;
  insert into public.hana_tasks(owner_id,project,role,title,brief,request_id)
  values(p_owner,p_project,'Project Manager','交辦｜專案進度整理',p_instruction,p_request) returning id into task;
  update public.hana_automation_events set code='work_queued',details=details||jsonb_build_object('task_id',task,'summary','已排入免費PM背景整理，尚未完成；受專案啟停及每日上限限制。') where id=p_request;
 end if;
 return jsonb_build_object('fresh',true,'receipt_id',p_request,'task_id',task);
end $$;
create function public.hana_finish_work(p_owner uuid,p_request uuid,p_state text,p_summary text) returns text
language plpgsql security invoker set search_path='' as $$
begin
 if p_state is null or p_summary is null or p_state not in ('completed','needs_human','needs_connection','failed') or length(p_summary)>4000 then raise exception 'invalid_work_result';end if;
 update public.hana_automation_events set code='work_'||p_state,details=details||jsonb_build_object('summary',p_summary,'finished_at',now(),'paid_api_calls',0)
 where id=p_request and owner_id=p_owner and code='work_running';
 if not found then raise exception 'work_state_conflict';end if;
 return p_state;
end $$;
create function public.hana_work_history(p_owner uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(records) order by created_at desc),'[]'::jsonb) from (
  select e.id,e.project,e.created_at,e.details->>'instruction' as instruction,
   coalesce(t.status,case when e.code='work_running' and e.created_at<now()-interval '10 minutes' then 'needs_human' else substring(e.code from 6) end) as status,
   coalesce(left(t.result,12000),e.details->>'summary',case when e.code='work_running' and e.created_at<now()-interval '10 minutes' then '上次查詢未確認完成，請以新的交辦重試；尚未取得結果。' else '尚未取得結果' end) as summary,
   t.id as task_id,
   case when t.status='queued' and s.enabled is not true then 'paused'
    when t.status='queued' and (select count(*) from public.hana_task_runs r where r.owner_id=p_owner and r.created_at>=date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei')>=3 then 'daily_limit'
    when t.status='queued' and (select count(*) from public.hana_task_runs r join public.hana_tasks q on q.id=r.task_id where r.owner_id=p_owner and q.project=t.project and r.created_at>=date_trunc('day',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei')>=s.daily_limit then 'daily_limit'
    when t.status='queued' then 'next_tick' else null end as waiting_reason
  from public.hana_automation_events e
  left join public.hana_tasks t on t.owner_id=e.owner_id and t.request_id=e.id
  left join public.hana_automation_settings s on s.owner_id=t.owner_id and s.project=t.project
  where e.owner_id=p_owner and e.code in ('work_running','work_queued','work_review','work_completed','work_needs_human','work_needs_connection','work_failed')
  order by e.created_at desc limit 20
 ) records;
$$;
create function public.hana_project_progress(p_owner uuid,p_project text,p_exclude uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare total integer;states text;next_steps text;
begin
 select count(*) into total from public.hana_tasks where owner_id=p_owner and project=p_project and id is distinct from p_exclude;
 select string_agg(status||'：'||n::text,'、' order by status) into states from (select status,count(*) n from public.hana_tasks where owner_id=p_owner and project=p_project and id is distinct from p_exclude group by status) counts;
 select string_agg('- '||title||'｜'||status||case when due_at<now() then '｜已逾期' else '' end,E'\n') into next_steps from (
 select title,status,due_at from public.hana_tasks where owner_id=p_owner and project=p_project and id is distinct from p_exclude and status in ('review','failed','queued','running','rejected')
 order by case status when 'review' then 0 when 'failed' then 1 when 'rejected' then 2 else 3 end,due_at nulls last,created_at limit 3
 ) urgent;
 return '免費 PM｜已整理既有雲端任務（免費規則式，非生成式AI）'||E'\n專案：'||p_project||E'\n資料時間：'||to_char(now() at time zone 'Asia/Taipei','YYYY-MM-DD HH24:MI')||E' 台北\n任務數（不含本次整理）：'||total::text||E'\n狀態統計：'||coalesce(states,'目前沒有其他雲端任務')||E'\n\n最多三項待處理：\n'||coalesce(next_steps,'目前沒有待處理雲端任務')||E'\n\napproved 只代表內部核准，不代表已交付客戶。未讀取瀏覽器本機工作板、OneDrive照片或外部檔案；資料不足不推定已完成。';
end $$;
create or replace function public.hana_automation_advance() returns integer
language plpgsql security invoker set search_path='' as $$
declare t record; n integer:=0; v_child uuid;
begin
 for t in select q.* from public.hana_tasks q join public.hana_automation_settings s using(owner_id,project)
 join auth.users u on u.id=q.owner_id
 where s.enabled and q.status='approved' and not exists(select 1 from public.hana_automation_events e where e.id=q.request_id and e.owner_id=q.owner_id and e.details->>'action'='project_progress') and u.deleted_at is null and u.raw_app_meta_data->>'hana_office_access'='true'
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

create or replace function public.hana_run_free_pm_tick() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t jsonb;result text;owner uuid;task uuid;run uuid;
begin
 perform public.hana_automation_recover();perform public.hana_automation_advance();
 t:=public.hana_automation_claim_rules(3);
 if t is null then return jsonb_build_object('status','idle_or_limited','mode','rules','paid_api_calls',0);end if;
 owner:=(t->>'owner_id')::uuid;task:=(t->>'id')::uuid;run:=(t->>'run_id')::uuid;
 result:=public.hana_project_progress(owner,t->>'project',task)||E'\n\n本次交辦：\n'||(t->>'brief')||E'\n專案範圍：'||(t->>'scope_note');
 if t->>'parent_task_id' is not null then result:=result||E'\n本輪最後PM彙整，流程停止，不再建立策略循環。';end if;
 perform public.hana_finish_task(owner,task,run,left(result,50000),null);
 update public.hana_automation_events set code='work_review',details=details||jsonb_build_object('summary','已完成專案進度整理，待本人審核。','paid_api_calls',0)
 where id=(t->>'request_id')::uuid and owner_id=owner and code='work_queued';
 insert into public.hana_automation_events(owner_id,project,task_id,run_id,code,details) values(owner,t->>'project',task,run,'free_pm_review_ready','{"mode":"rules","paid_api_calls":0,"external_writes":false}');
 return jsonb_build_object('status','review','task_id',task,'mode','rules','paid_api_calls',0);
end $$;
revoke all on function public.hana_begin_work(uuid,uuid,text,text,text),public.hana_finish_work(uuid,uuid,text,text),public.hana_work_history(uuid),public.hana_project_progress(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.hana_begin_work(uuid,uuid,text,text,text),public.hana_finish_work(uuid,uuid,text,text),public.hana_work_history(uuid),public.hana_project_progress(uuid,text,uuid) to service_role;

create or replace function public.hana_handoff_task(p_owner uuid,p_task uuid,p_request uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare t public.hana_tasks%rowtype; v_role text; v_id uuid;
begin
 select * into t from public.hana_tasks where id=p_task and owner_id=p_owner and status='approved' for update;
 if not found then raise exception 'approval_required'; end if;
 if exists(select 1 from public.hana_automation_events e where e.id=t.request_id and e.owner_id=p_owner and e.details->>'action'='project_progress') then raise exception 'workflow_finished';end if;
 if t.role='Project Manager' and t.parent_task_id is not null then raise exception 'workflow_finished'; end if;
 v_role := case t.role when 'Project Manager' then 'Brand Strategist' when 'Brand Strategist' then 'Creative Producer' when 'Creative Producer' then 'Project Manager' end;
 if v_role is null then raise exception 'invalid_role'; end if;
 insert into public.hana_tasks(owner_id,project,role,title,brief,parent_task_id,request_id)
 values(p_owner,t.project,v_role,'交接｜'||left(t.title,120),left('上游結果為內部審核核准，非客戶正式核准。保留G1–G5與B/C範圍待核對。來源任務：'||t.id::text||E'\n'||coalesce(t.result,''),12000),t.id,p_request)
 returning id into v_id;
 return v_id;
end $$;
