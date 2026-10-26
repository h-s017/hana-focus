// UI-only classification. Never treats queueing or internal approval as finished work.
export function workStage(task,tasks=[]){
 if(task.is_current===false||task.scope_status==='out_of_scope'||task.work_state==='done')return 'archived';
 if(task.status==='running')return 'working';
 if(task.status==='review'||task.status==='failed'||task.status==='rejected'||task.scope_status!=='in_scope'||task.work_state==='waiting')return 'decision';
 if((task.dependencies||[]).some(id=>!tasks.some(t=>t.id===id&&t.work_state==='done'&&t.scope_status==='in_scope')))return 'decision';
 if(task.work_state==='in_progress')return 'working';
 return 'assigned';
}
export function workStageText(task,tasks=[]){
 const stage=workStage(task,tasks);
 if(task.scope_status==='out_of_scope')return '不屬於本次範圍，已保留紀錄';
 if(task.is_current===false)return '屬於歷史版本，已保留紀錄';
 if(task.work_state==='done')return '已標記工作完成；尚不代表客戶核准交付';
 if(task.status==='running')return '專案工具正在處理';
 if(task.status==='review')return '整理成果已準備好，等你查看';
 if(task.status==='failed')return '上次處理沒有成功，需要查看原因';
 if(task.status==='rejected')return '你已退回，需要調整後再處理';
 if(task.scope_status!=='in_scope')return '先確認這件事是否屬於本次專案';
 if(task.work_state==='waiting')return '等待回覆或你的決定';
 if(stage==='decision')return '先完成前面的工作，才能接著處理';
 if(task.work_state==='in_progress')return '工作已標記進行中';
 if(task.status==='approved')return '整理成果已確認，工作仍待執行';
 if(task.task_kind==='agent')return '尚未開始處理';
 return '已記下，尚未開始';
}
export function workStages(tasks){
 const groups={assigned:[],working:[],decision:[]};
 for(const task of tasks){const stage=workStage(task,tasks);if(groups[stage])groups[stage].push(task);}
 groups.assigned.sort((a,b)=>(a.priority||2)-(b.priority||2)||(Date.parse(a.due_at)||Infinity)-(Date.parse(b.due_at)||Infinity));
 return groups;
}
