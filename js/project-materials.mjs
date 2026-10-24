export function folderLink(value) {
  const text=String(value??'').trim();
  if(text.length>2048)throw Error('請縮短資料夾連結。');
  let url;try{url=new URL(text);}catch{throw Error('請貼上完整的 OneDrive HTTPS 資料夾連結。');}
  const h=url.hostname;
  if(url.protocol!=='https:'||url.username||url.password||url.port||!(['1drv.ms','onedrive.live.com'].includes(h)||/^[a-z0-9-]+\.sharepoint\.com$/.test(h)))
    throw Error('只接受 OneDrive 或 Microsoft SharePoint 的 HTTPS 連結。');
  return url.href;
}
export function materialRecord(owner,project,url) {
  project=String(project??'').trim();
  if(!owner||!project||project.length>100)throw Error('請填寫專案名稱（最多 100 字）。');
  return {owner_id:owner,project,folder_url:folderLink(url)};
}
export function mountMaterials(host,{db,owner}) {
  let version=0,disposed=false,saving=false;
  const heading=document.createElement('h2');heading.textContent='專案素材｜OneDrive';
  const note=document.createElement('p');note.textContent='每個專案可保存一個資料夾連結，登入同一帳號後可跨裝置使用。檔案留在 OneDrive；此處不會上傳、掃描或修改分享權限。請使用指定對象的存取權限。';
  const form=document.createElement('form');
  const project=document.createElement('input');project.name='project';project.required=true;project.maxLength=100;
  const url=document.createElement('input');url.name='folder_url';url.type='url';url.required=true;url.maxLength=2048;url.placeholder='https://…';
  for(const [text,input] of [['專案名稱',project],['OneDrive 資料夾連結',url]]){const label=document.createElement('label');label.append(document.createTextNode(text),input);form.append(label);}
  const save=document.createElement('button');save.textContent='儲存素材連結';form.append(save);
  const refresh=document.createElement('button');refresh.type='button';refresh.textContent='重新載入素材連結';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=document.createElement('div');list.className='project-material-list';
  host.replaceChildren(heading,note,form,refresh,status,list);
  async function load(){const v=++version;
    try{const {data,error}=await db.from('hana_project_materials').select('project,folder_url').eq('owner_id',owner).order('project');if(error)throw error;
      if(disposed||v!==version)return;list.replaceChildren();
      for(const item of data||[]){const row=document.createElement('p');row.style.overflowWrap='anywhere';
        const title=document.createElement('strong');title.textContent=item.project+' ';row.append(title);
        try{const a=document.createElement('a');a.href=folderLink(item.folder_url);a.textContent='開啟 OneDrive 素材資料夾 ↗';a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';row.append(a);}catch{row.append(document.createTextNode('連結格式不支援，請重新儲存。'));}
        const edit=document.createElement('button');edit.type='button';edit.textContent='編輯連結';edit.onclick=()=>{project.value=item.project;url.value=item.folder_url;url.focus();};row.append(edit);list.append(row);}
      status.textContent=(data||[]).length?'已載入雲端素材連結。':'尚未設定素材資料夾。請先在 OneDrive 建立或選擇資料夾，再貼上連結。';return true;
    }catch{if(!disposed&&v===version){list.replaceChildren();status.textContent='素材連結載入失敗；請確認登入、網路及素材功能資料表是否已部署。原任務資料不受影響。';}return false;}
  }
  form.onsubmit=async event=>{event.preventDefault();if(disposed||saving)return;
    let record;try{record=materialRecord(owner,project.value,url.value);}catch(e){status.textContent=e.message;return;}
    saving=true;save.disabled=true;status.textContent='儲存中…';
    try{const {error}=await db.from('hana_project_materials').upsert(record,{onConflict:'owner_id,project'});if(error)throw error;
      if(disposed)return;const loaded=await load();if(!disposed&&loaded)status.textContent='素材連結已儲存；未讀取檔案或變更 OneDrive 權限。';
    }catch{if(!disposed)status.textContent='儲存未確認成功；請先重新載入檢查，避免重複操作。';}
    finally{saving=false;if(!disposed)save.disabled=false;}
  };
  refresh.onclick=load;void load();
  return ()=>{disposed=true;version++;host.replaceChildren();};
}
