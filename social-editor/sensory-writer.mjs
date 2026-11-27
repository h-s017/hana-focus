import {createHash} from 'node:crypto';
import {sensoryLessons,sensorySections,unusedTopic} from './sensory-curriculum.mjs';
import {editorialScenes,sensoryVisuals} from './sensory-visual.mjs';

const text={type:'string'};
const fields={category:text,title:text,audience:text,materials:text,light:text,
 palette:{type:'array',items:text},scenes:{type:'array',items:text},pages:{type:'array',items:{type:'object',additionalProperties:false,required:['title','body'],properties:{title:text,body:text}}}};
const format={type:'json_schema',name:'hana_sensory_issue',strict:true,schema:{type:'object',additionalProperties:false,required:Object.keys(fields),properties:fields}};
const categories=[...new Set(sensoryLessons.map(lesson=>lesson.category))];
const validText=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;

export async function writeSensoryLesson(generate,history){
 const recent=history.slice(0,90).map(({title,category})=>({title,category}));
 const compiled=await generate({format,maxOutputTokens:4100,
  instructions:'為 HANA 感官誌寫繁體中文教學微課。根據歷史避免同義重複與相鄰日主題重複。明確指定受眾與一個可觀察的學習成果。七頁依封面、概念、原理、延伸、案例、應用、結語順序。案例明確以「示意案例」標示。用可重做的觀察與比較練習，避免商品促銷、無來源的具名事件或醫療／安全宣稱，不提供調香配方。色票為由材質、光線與季節啟發的 4–6 個大寫 HEX。七個場景 ID 必須不同。每頁正文 15–180 字、標題 2–60 字。',
  input:JSON.stringify({recent,categories,scenes:editorialScenes})});
 const issue=JSON.parse(compiled);
 if(!categories.includes(issue?.category)||!validText(issue.title,2,60)||!validText(issue.audience,3,100)||!validText(issue.materials,3,180)||!validText(issue.light,3,180)||!Array.isArray(issue.pages)||issue.pages.length!==7||issue.pages.some(page=>!validText(page?.title,2,60)||!validText(page.body,15,180))||issue.pages[0].title!==issue.title||!issue.pages[4].body.includes('示意案例'))throw Error('editorial_output_invalid');
 const id='generated-'+createHash('sha256').update(issue.title).digest('hex').slice(0,24);
 const lesson={...issue,id,pages:issue.pages.map((page,i)=>({...page,section:sensorySections[i]})),citationStatus:'generated_editorial_requires_human_fact_review'};
 if(!unusedTopic(lesson,history))throw Error('editorial_topic_duplicate');
 sensoryVisuals(lesson);
 return lesson;
}
