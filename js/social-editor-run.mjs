import {socialStatus} from './three-agent-status.mjs?v=sensory-editorial-20261126';

const byId=id=>document.getElementById(id);
const contentRoot='https://github.com/h-s017/hana-focus/blob/hana-focus-preview/content/instagram/';

export async function loadSocialRun(){
 const title=byId('agentRun'),detail=byId('agentDetail'),note=byId('editorialNote'),links=byId('editorialLinks');
 title.textContent='讀取中…';
 links.replaceChildren();
 try{
  const response=await fetch('https://raw.githubusercontent.com/h-s017/hana-focus/hana-focus-preview/content/instagram/latest.json',{cache:'no-store'});
  if(!response.ok)throw Error('尚無可讀取的每日紀錄（HTTP '+response.status+'）');
  const entry=await response.json();
  const state=socialStatus(entry);
  title.textContent=(entry.date||'未知日期')+'｜'+(entry.topic||'待產製');
  detail.textContent=state.detail;
  const expected=entry.edition==='sensory-v2.1'?7:6;
  if(!['editorial_ready','canva_logged'].includes(entry.status)||entry.plannedSlideCount!==expected||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)){
   note.textContent='尚無通過文案檢查的期刊。';return;
  }
  note.textContent=expected+' 頁文案｜'+(entry.imagesGenerated&&entry.imageCount===expected?'攝影檔核對通過，待視覺審核。':'待生成及核對攝影素材。');
  const files=[['完整文案與色票','lesson.json'],['貼文預稿','caption.md'],['拍攝規格','visual-brief.md'],['審核與執行紀錄','review.json'],['Canva 欄位 CSV','canva-autofill.csv']];
  if(entry.imagesGenerated===true&&entry.imageCount===expected)files.push(['原始攝影目錄','artwork.json']);
  for(const [label,file] of files){const link=document.createElement('a');link.textContent=label;link.href=contentRoot+entry.date+'/'+file;link.target='_blank';link.rel='noopener noreferrer';links.append(link);}
 }catch(error){title.textContent='尚無可讀取的執行紀錄';detail.textContent=error.message;note.textContent='無法確認產製狀態。';}
}

byId('refreshRun').onclick=loadSocialRun;
void loadSocialRun();
