import test from 'node:test';import assert from 'node:assert/strict';
import {validateIntake,prepareIntake,sourceLinks,pmIntakePlan,FILE_LIMITS} from '../../js/work-intake.mjs';
import {readableResult} from '../../js/work-result.mjs';
import {roleTool} from '../../js/focus-domain.mjs';
const owner='10000000-0000-4000-8000-000000000001',project='20000000-0000-4000-8000-000000000001',request='30000000-0000-4000-8000-000000000001',context={owner,project,request};
test('photo intake hashes immutable private paths, text extraction is bounded, and link sources are not assumed read',async()=>{
 const files=await prepareIntake([new File(['photo'],'店面.png',{type:'image/png'}),new File(['2002 年資料'],'說明.md',{type:'text/markdown'})],context);
 const materials=validateIntake({files:files.map(x=>x.record),links:['https://www.canva.com/design/example/edit']},context);
 assert.match(materials.files[0].path,new RegExp('^'+owner+'/'+project+'/'+request+'/[a-f0-9]{64}\\.png$'));assert.equal(materials.files[1].excerpt,'2002 年資料');
 const task={title:'沿革牆',brief:'整理照片並排版',source_payload:{work_intake:materials}};const plan=pmIntakePlan(task);assert.equal(plan.materials[0].category,'店面照片');assert.match(plan.materials[0].reading,/尚未判讀/);assert.match(plan.links[0].status,/未自動讀取/);assert.match(plan.limits,/尚未執行照片辨識/);assert.equal(plan.paidApiCalls,0);assert.equal(plan.externalWrites,false);
});
test('foreign project, owner and missing object hashes, oversized files and executable formats are rejected',async()=>{
 const [prepared]=await prepareIntake([new File(['x'],'test.png',{type:'image/png'})],context),file=prepared.record;
 for(const patch of [{path:file.path.replace(owner,'bad')},{path:file.path.replace(project,request)},{sha256:'missing'},{name:'evil.svg',mime:'image/svg+xml'},{size:FILE_LIMITS.each+1}])assert.throws(()=>validateIntake({files:[{...file,...patch}]},context),/intake_invalid/);
 assert.throws(()=>validateIntake({files:[file,file]},context),/intake_invalid/);
 await assert.rejects(prepareIntake([new File(['OPENAI_API_KEY=secret'],'settings.txt',{type:'text/plain'})],context),/intake_secret_detected/);
});
test('links retain user share parameters but reject credentials, executable protocols, unrelated hosts and service keys',()=>{
 assert.equal(sourceLinks('https://1drv.ms/f/example?e=share')[0],'https://1drv.ms/f/example?e=share');
 for(const link of ['javascript:alert(1)','http://1drv.ms/f/example','https://user:password@www.canva.com/x','https://www.canva.com.evil.example/x','https://www.canva.com/x?access_token=secret'])assert.throws(()=>sourceLinks([link]),/intake_invalid/);
});
test('old JSON results become plain summaries and cannot recursively embed previous task output in new PM reports',()=>{
 const old={action:'verified_task_analysis',summary:{top3:[{title:'沿革牆',result:'PRIVATE_OLD_RESULT'.repeat(10000)}]}};
 const readable=readableResult('old header\n'+JSON.stringify(old));assert.deepEqual(readable.data.steps,['沿革牆']);assert.ok(!JSON.stringify(readable).includes('PRIVATE_OLD_RESULT'));
 const result=roleTool('Project Manager',{project:{name:'fixture'},version:{label:'V3'},task:{title:'沿革牆',brief:'整理照片'},tasks:[{id:'a',title:'沿革牆',scope_status:'in_scope',work_state:'todo',result:'PRIVATE_OLD_RESULT'.repeat(10000)}],documents:[]});
 assert.ok(result.length<6000);assert.ok(!result.includes('PRIVATE_OLD_RESULT'));assert.equal(readableResult(result).kind,'plan');
 assert.equal(readableResult('{"unexpected":"system record"}').kind,'unknown');assert.equal(readableResult('一般工作草稿').kind,'text');
});
