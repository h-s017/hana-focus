import fs from 'node:fs/promises';
import path from 'node:path';
import {lessonForDay} from '../social-editor/editorial-library.mjs';
import {canvaImportHtml} from '../social-editor/canva-html.mjs';
import {dailyVisuals,dailyVisualBrief} from '../social-editor/visual-preset.mjs';

const now=new Date();
const date=process.env.LESSON_DATE||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
function checkDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Invalid LESSON_DATE');
 return value;
}
checkDate(date);
const day=Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse('2026-10-19T00:00:00Z'))/86400000)+1;
if(day<1)throw Error('Schedule starts on 2026-10-19');
const folder=path.join('content','instagram',date);
await fs.mkdir(folder,{recursive:true});
const readJSON=async file=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}};
const previous=await readJSON(path.join('content','instagram','latest.json'));
const lesson=lessonForDay(day);
function fields(pages){
 const data={SERIES:'HANA 嗅覺微課',DAY:String(day).padStart(3,'0'),DATE:date};
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
 if(slides.length!==6||slides.some(s=>!s.title||!s.body||s.title.length>60||s.body.length>180))throw Error('Micro-lesson QA failed');
 const data=fields(slides);
 const csv='\uFEFF'+Object.keys(data).map(csvEscape).join(',')+'\r\n'+Object.values(data).map(csvEscape).join(',')+'\r\n';
 const caption=[
  lesson.title,'',
  'HANA 嗅覺微課｜Day '+String(day).padStart(3,'0'), '',
  ...slides.slice(1,5).map((p,i)=>String(i+1)+'. '+p.title+'：'+p.body),
  '', '今日練習：'+slides[5].body,
  '', '音樂聆賞：'+lesson.music.composer+' — '+lesson.music.work,
  '主題連結：'+lesson.music.reason,
  '（此處僅推薦曲目，不包含可使用的錄音授權。）',
  '', '#HanaScentArtist #嗅覺藝術 #氣味設計 #香氛微課'
 ].join('\n');
 const visualBrief='# HANA 嗅覺微課｜'+date+'\n\n'+dailyVisualBrief(lesson);
 const dataFile='canva-autofill.csv';
 await Promise.all([
  fs.writeFile(path.join(folder,'canva-import.html'),canvaImportHtml({title:lesson.title,pages:slides,day,date})),
  fs.writeFile(path.join(folder,'lesson.json'),JSON.stringify({date,day,title:lesson.title,status:'editorial_ready',pages:slides,canvas:{width:1080,height:1350,pages:6},visuals:dailyVisuals(lesson),fields:data,music:lesson.music,claimStatus:lesson.citationStatus},null,2)+'\n'),
  fs.writeFile(path.join(folder,dataFile),csv),
  fs.writeFile(path.join(folder,'caption.md'),caption+'\n'),
  fs.writeFile(path.join(folder,'visual-brief.md'),visualBrief+'\n'),
  fs.writeFile(path.join(folder,'review.json'),JSON.stringify({date,day,status:'internal_automated_checks_passed',humanApprovalRequiredForInternalCopy:false,imagesGenerated:false,canvaCreated:false,published:false,checks:['6 editable copy pages','4:5 dimensions specified','no imported copyrighted assets','composition specification','music recording unlicensed'],sourceNote:'Original conceptual editorial; factual claims not independently externally reviewed'},null,2)+'\n')
 ]);
 const priorSameDay=previous?.date===date&&previous.canvaCreated===true&&/^https:\/\/(www\.)?canva\.com\//.test(previous.canvaEditUrl||'')&&previous.canvaDesignId;
 const design=priorSameDay?{canvaCreated:true,canvaDesignId:previous.canvaDesignId,canvaEditUrl:previous.canvaEditUrl,slideCount:previous.slideCount}: {canvaCreated:false,canvaDesignId:null,canvaEditUrl:null,slideCount:0};
 manifest={
  lastRunAt:now.toISOString(),date,day,status:design.canvaCreated?'canva_logged':'editorial_ready',topic:lesson.title,
  ...design,plannedSlideCount:slides.length,imagesGenerated:false,reviewStatus:'internal_automated_checks_passed',published:false,
  captionPath:folder+'/caption.md',canvaCsvPath:folder+'/'+dataFile,canvaImportPath:folder+'/canva-import.html',lessonPath:folder+'/lesson.json',
  notes:design.canvaCreated?'Preserved separately confirmed Canva result; Instagram not published.':'Six-page copy and Canva field CSV prepared. No image generation or Canva API execution.',
  manualCanvaUploadHelp:site+'/'+folder+'/'+dataFile
 };
}else{
 await fs.writeFile(path.join(folder,'lesson.json'),JSON.stringify({date,day,title:null,status:'needs-lesson',pages:[],notes:'Outside curated editorial library; AI writer not connected. Nothing generated.'},null,2)+'\n');
 await fs.writeFile(path.join(folder,'review.json'),JSON.stringify({date,day,status:'missing_editorial',imagesGenerated:false,canvaCreated:false,published:false},null,2)+'\n');
 manifest={lastRunAt:now.toISOString(),date,day,status:'needs-lesson',topic:null,imagesGenerated:false,slideCount:0,canvaCreated:false,canvaDesignId:null,canvaEditUrl:null,published:false,reviewStatus:'missing_editorial',notes:'Curriculum ends at Day 14; AI writer and Canva backend have not been connected.'};
}
await fs.mkdir(path.join('content','instagram'),{recursive:true});
await fs.writeFile(path.join('content','instagram','latest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('HANA Social Editor '+date+': '+manifest.status+'; canvaCreated='+manifest.canvaCreated+' published=false');
