import fs from 'node:fs/promises';
const now = new Date();
const date = process.env.LESSON_DATE || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid LESSON_DATE');
const day = Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse('2026-10-19T00:00:00Z'))/86400000)+1;
if(day<1) throw new Error('Schedule starts on 2026-10-19');
const folder = 'content/instagram/'+date;
await fs.mkdir(folder,{recursive:true});
const dayOne = {
 title:'調香師究竟在做什麼？',
 pages:[
 {title:'調香師究竟在做什麼？',body:'氣味是一種想像。調香師讓抽象概念成為可以感受的氣味作品。'},
 {title:'調香不是只有精油',body:'調香可能使用天然或合成香料，並依用途與安全條件設計配方。'},
 {title:'調香師的四項能力',body:'嗅覺辨識、香材知識、配方結構，以及將故事轉譯為氣味的創意。'},
 {title:'今日觀察',body:'選一件日常物件，寫下三個聯想的氣味詞，再分辨哪些是想像、哪些是實際觀察。'},
 {title:'今日回顧',body:'調香不只是挑選喜歡的味道，而是以知識、感官與創作建構氣味。'}],
 music:{composer:'Claude Debussy',work:'Préludes, Book I: La fille aux cheveux de lin',medium:'piano',reason:'以音樂的細緻層次對照氣味創作中的意象與結構',recordingRights:'Recording availability and licensing not verified'}
};
const lesson={date,day,title:day===1?dayOne.title:null,status:day===1?'draft':'needs-lesson',pages:day===1?dayOne.pages:[],music:day===1?dayOne.music:null,notes:day===1?'Human review required':'A validated curriculum for this day is not connected; do not fabricate educational content.'};
await fs.writeFile(folder+'/lesson.json',JSON.stringify(lesson,null,2)+'\n');
const review={date,day,status:'pending-founder-review',imagesGenerated:false,canvaCreated:false,published:false,checks:['subject accuracy','image provenance','traditional Chinese','1080x1350','5-8 independent pages','music recording rights','brand consistency']};
await fs.writeFile(folder+'/review.json',JSON.stringify(review,null,2)+'\n');
await fs.mkdir('content/instagram',{recursive:true});
const manifest={lastRunAt:now.toISOString(),date,day,status:lesson.status,topic:lesson.title,imagesGenerated:false,slideCount:0,canvaDesignId:day===1?'DAHYYj6Kajs':null,canvaEditUrl:day===1?'https://www.canva.com/d/jnO7TQ8Dj85zFHU':null,music:lesson.music,reviewStatus:review.status,published:false,notes:lesson.notes||'Draft created. No automatic image generation or publication.'};
await fs.writeFile('content/instagram/latest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Social Editor generated '+date+' '+lesson.status+'; no PNGs or publication.');
