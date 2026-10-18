import fs from 'node:fs/promises';
const date = process.env.LESSON_DATE || new Date().toISOString().slice(0,10);
const day = Math.max(1,Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse('2026-10-19T00:00:00Z'))/86400000)+1);
const path = `content/instagram/${date}`;
await fs.mkdir(path,{recursive:true});
const lesson = {day,date,title:day===1?'調香師究竟在做什麼？':`調香微課 Day ${day}`,status:'draft',pages:[
{title:'氣味是一種想像',body:'調香，是將想像轉譯為嗅覺語言的創作。'},
{title:'核心概念',body:'調香透過天然與合成香料、配方結構與嗅覺感知進行設計。'},
{title:'四項核心能力',body:'嗅覺辨識、原料知識、配方設計、創意轉譯。'},
{title:'今日練習',body:'觀察書本、樂器或日常物件，記錄三個聯想到的氣味詞彙；區分想像與實際嗅聞。'},
{title:'今日測驗',body:'調香師的工作是什麼？答案：運用原料特性與配方結構，將概念轉譯為氣味。'}]};
if(day!==1){lesson.status='needs-lesson';lesson.pages=[];lesson.note='Day 2 onward requires validated curriculum input; no fabricated lesson.';}
await fs.writeFile(`${path}/lesson.json`,JSON.stringify(lesson,null,2)+'\n');
await fs.writeFile(`${path}/review.json`,JSON.stringify({status:'pending-human-review',imagesGenerated:false,canvaCreated:false,published:false,checks:['scientific accuracy','image provenance','traditional Chinese','1080x1350','five independent pages','brand consistency']},null,2)+'\n');
console.log(`Prepared ${path}; draft only, no image generation or Canva upload performed.`);