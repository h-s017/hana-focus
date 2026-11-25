import fs from 'node:fs/promises';
import path from 'node:path';
import {lessonForDay} from '../social-editor/editorial-library.mjs';
import {canvaImportHtml} from '../social-editor/canva-html.mjs';
import {dailyVisuals,dailyVisualBrief} from '../social-editor/visual-preset.mjs';
import {sensoryStart,selectSensoryLesson} from '../social-editor/sensory-curriculum.mjs';
import {sensoryVisuals,sensoryVisualBrief} from '../social-editor/sensory-visual.mjs';
import {writeSensoryLesson} from '../social-editor/sensory-writer.mjs';
import {agentProvider} from '../supabase/functions/hana-automation/agent-provider.mjs';

const now=new Date();
const date=process.env.LESSON_DATE||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
function checkDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Invalid LESSON_DATE');
 return value;
}
checkDate(date);
const day=Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse('2026-10-19T00:00:00Z'))/86400000)+1;
if(day<1)throw Error('Schedule starts on 2026-10-19');
const folder=path.posix.join('content','instagram',date);
await fs.mkdir(folder,{recursive:true});
const readJSON=async file=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}};
const previous=await readJSON(path.join('content','instagram','latest.json'));
const sensory=date>=sensoryStart;
let history=[];
if(sensory){
 const existing=await readJSON(path.join(folder,'lesson.json'));
 if(existing?.edition==='sensory-v2.1'&&existing.status==='editorial_ready'){
  console.log('HANA Social Editor '+date+': existing edition retained');
  process.exit(0);
 }
 const dates=(await fs.readdir(path.dirname(folder))).filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&value<date).sort().reverse();
 history=(await Promise.all(dates.map(value=>readJSON(path.join(path.dirname(folder),value,'lesson.json'))))).filter(entry=>entry?.title);
}
let lesson=sensory?selectSensoryLesson(history):lessonForDay(day),reason='editorial_queue_exhausted',editorialMode='curated';
if(!lesson&&sensory){
 const generate=agentProvider({enabled:process.env.HANA_SOCIAL_EDITORIAL_ENABLED==='1',apiKey:process.env.HANA_SOCIAL_EDITORIAL_API_KEY,model:process.env.HANA_SOCIAL_EDITORIAL_MODEL});
 if(generate){
  try{lesson=await writeSensoryLesson(generate,history);editorialMode='assisted';}
  catch(error){reason=error.message==='editorial_topic_duplicate'?'editorial_topic_duplicate':'editorial_provider_failed';}
 }
}
function fields(pages){
 const data={SERIES:sensory?'HANA 感官誌':'HANA 嗅覺微課',...(sensory?{}:{DAY:String(day).padStart(3,'0')}),DATE:date};
 pages.forEach((p,index)=>{
  const prefix='PAGE_'+String(index+1).padStart(2,'0');
  data[prefix+'_TITLE']=p.title;
  data[prefix+'_BODY']=p.body;
 });
 return data;
}
function csvEscape(value){
 let s=String(value??'');
 // Spreadsheet formula injection protection for exports later opened in Excel/Sheets.
 if(/^[\s\r\n]*[=+@]/.test(s)||/^[\s\r\n]*-(?![0-9])/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
const site='https://github.com/h-s017/hana-focus/tree/hana-focus-preview';
let manifest;
if(lesson){
 const slides=lesson.pages;
 if(slides.length!==(sensory?7:6)||slides.some(s=>!s.title||!s.body||s.title.length>60||s.body.length>180)||new Set(slides.map(s=>s.body)).size!==slides.length)throw Error('Micro-lesson QA failed');
 const visuals=sensory?sensoryVisuals(lesson):dailyVisuals(lesson);
 const data=fields(slides);
 const csv='\uFEFF'+Object.keys(data).map(csvEscape).join(',')+'\r\n'+Object.values(data).map(csvEscape).join(',')+'\r\n';
 const caption=sensory?[lesson.title,'HANA 感官誌',...slides.slice(1).map(p=>p.section+'｜'+p.title+'\n'+p.body),'#HanaScentArtist #嗅覺藝術 #氣味設計'].join('\n\n'):[
  lesson.title,'',
  'HANA 嗅覺微課｜Day '+String(day).padStart(3,'0'), '',
  ...slides.slice(1,5).map((p,i)=>String(i+1)+'. '+p.title+'：'+p.body),
  '', '今日練習：'+slides[5].body,
  '', '音樂聆賞：'+lesson.music.composer+' — '+lesson.music.work,
  '主題連結：'+lesson.music.reason,
  '（此處僅推薦曲目，不包含可使用的錄音授權。）',
  '', '#HanaScentArtist #嗅覺藝術 #氣味設計 #香氛微課'
 ].join('\n');
 const visualBrief='# '+(sensory?'HANA 感官誌':'HANA 嗅覺微課')+'｜'+date+'\n\n'+(sensory?sensoryVisualBrief(lesson,visuals):dailyVisualBrief(lesson));
 const dataFile='canva-autofill.csv';
 const edition=sensory?{edition:'sensory-v2.1',topic_id:lesson.id,category:lesson.category,audience:lesson.audience,history_checked:history.length,editorial_mode:editorialMode}:{};
 await Promise.all([
  fs.writeFile(path.join(folder,'canva-import.html'),canvaImportHtml({title:lesson.title,pages:slides,day,date,sensory})),
  fs.writeFile(path.join(folder,'lesson.json'),JSON.stringify({date,day,...edition,title:lesson.title,status:'editorial_ready',pages:slides,canvas:{width:1080,height:1350,pages:slides.length},visuals,fields:data,music:lesson.music,claimStatus:lesson.citationStatus},null,2)+'\n'),
  fs.writeFile(path.join(folder,dataFile),csv),
  fs.writeFile(path.join(folder,'caption.md'),caption+'\n'),
  fs.writeFile(path.join(folder,'visual-brief.md'),visualBrief+'\n'),
  fs.writeFile(path.join(folder,'review.json'),JSON.stringify({date,day,...edition,status:sensory?'copy_validated_artwork_pending':'internal_automated_checks_passed',humanApprovalRequiredForInternalCopy:sensory,imagesGenerated:false,canvaCreated:false,published:false,checks:[slides.length+' editable copy pages','4:5 dimensions specified','no imported copyrighted assets','composition specification'],sourceNote:'Original instruction; illustrative examples remain labeled as such.'},null,2)+'\n')
 ]);
 const priorSameDay=previous?.date===date&&previous.slideCount===slides.length&&previous.canvaCreated===true&&/^https:\/\/(www\.)?canva\.com\//.test(previous.canvaEditUrl||'')&&previous.canvaDesignId;
 const design=priorSameDay?{canvaCreated:true,canvaDesignId:previous.canvaDesignId,canvaEditUrl:previous.canvaEditUrl,slideCount:previous.slideCount}: {canvaCreated:false,canvaDesignId:null,canvaEditUrl:null,slideCount:0};
 manifest={
  lastRunAt:now.toISOString(),date,day,...edition,status:design.canvaCreated?'canva_logged':'editorial_ready',topic:lesson.title,
  ...design,plannedSlideCount:slides.length,imagesGenerated:false,reviewStatus:'internal_automated_checks_passed',published:false,
  captionPath:folder+'/caption.md',canvaCsvPath:folder+'/'+dataFile,canvaImportPath:folder+'/canva-import.html',lessonPath:folder+'/lesson.json',
  notes:design.canvaCreated?'Preserved separately confirmed Canva result; Instagram not published.':slides.length+'-page copy prepared. No generated images or Canva design verified.',
  manualCanvaUploadHelp:site+'/'+folder+'/'+dataFile
 };
}else{
 await fs.writeFile(path.join(folder,'lesson.json'),JSON.stringify({date,day,title:null,status:'needs-lesson',pages:[],reason},null,2)+'\n');
 await fs.writeFile(path.join(folder,'review.json'),JSON.stringify({date,day,status:'missing_editorial',reason,imagesGenerated:false,canvaCreated:false,published:false},null,2)+'\n');
 manifest={lastRunAt:now.toISOString(),date,day,status:'needs-lesson',topic:null,imagesGenerated:false,slideCount:0,canvaCreated:false,canvaDesignId:null,canvaEditUrl:null,published:false,reviewStatus:'missing_editorial',reason};
}
await fs.mkdir(path.join('content','instagram'),{recursive:true});
if(!previous?.date||previous.date<=date)await fs.writeFile(path.join('content','instagram','latest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('HANA Social Editor '+date+': '+manifest.status+'; canvaCreated='+manifest.canvaCreated+' published=false');
