import assert from 'node:assert/strict';
import {CANVA_FORMATS,createInternalCanvaPackage} from '../../js/project-canva-export.mjs';
const project={id:'p',name:'文慶雞',workspace:'work'};
const version={id:'v3',label:'方案 B／V3',included_terms:['品牌識別','空間視覺','沿革牆'],excluded_terms:['餐盒包裝','制服'],contract:{client_approved:false}};
const tasks=[
 {project_id:'p',version_id:'v3',title:'既有 Logo 整理',scope_status:'in_scope',work_state:'in_progress',source_system:'notion'},
 {project_id:'p',version_id:'v3',title:'歷史沿革牆',scope_status:'in_scope',work_state:'todo',source_system:'notion'},
 {project_id:'p',version_id:'v3',title:'更新餐盒',scope_status:'out_of_scope',work_state:'todo',source_system:'legacy'},
 {project_id:'p',version_id:'v3',title:'客戶版本核對',scope_status:'needs_review',work_state:'waiting',source_system:'notion'},
 {project_id:'p',version_id:'old',title:'過時任務',scope_status:'in_scope',work_state:'todo'}
];
const pkg=createInternalCanvaPackage({project,version,tasks,documents:[{project_id:'p'},{project_id:'old'}]});
assert.equal(pkg.pages.length,6);
assert.deepEqual(pkg.scope,{in_scope:2,out_of_scope:1,needs_review:1});
assert.ok(pkg.pages[3].body.includes('歷史沿革牆'));
assert.ok(!pkg.pages[3].body.includes('餐盒'));
assert.ok(pkg.pages[4].body.includes('餐盒包裝'));
assert.ok(pkg.markdown.includes('過時任務')===false);
assert.ok(pkg.markdown.includes('尚無')===false||pkg.markdown.includes('無已判定')===false);
assert.ok(pkg.markdown.includes('未取得本版本客戶正式核准證據'));
assert.ok(pkg.markdown.includes('內部 Canva 交付資料'));
assert.ok(pkg.csv.charCodeAt(0)===0xFEFF);
assert.ok(pkg.csv.includes('PAGE_01_TITLE')&&pkg.csv.includes('PAGE_06_BODY'));
assert.equal(pkg.canvaCreated,false);
assert.equal(pkg.clientDelivery,false);
assert.equal(pkg.format,'A4直式');
for(const value of CANVA_FORMATS)assert.equal(createInternalCanvaPackage({project,version,tasks,format:value}).format,value);
assert.throws(()=>createInternalCanvaPackage({project,version:null,tasks}),/project_version_required/);
assert.throws(()=>createInternalCanvaPackage({project,version,tasks,format:'unknown'}),/invalid_format/);
const injection=createInternalCanvaPackage({project:{id:'p',name:'=1+2'},version,tasks:[]});
assert.ok(injection.csv.includes('"\'=1+2"'));
assert.ok(injection.clientDelivery===false);
console.log('PASS: PM internal editable Canva package, current version/scope filtering, exclusion, CSV formula protection and no client-delivery claim.');
