import assert from 'node:assert/strict';
import {control} from '../../supabase/functions/hana-automation/control.mjs';
const credential={ciphertext:'confidential-marker',version:'nonpublic'};
const makeService=stored=>control({
 authenticate:async token=>{if(token!=='good-session')throw Error('invalid-token');return {id:'only-owner',app_metadata:{hana_office_access:true}};},
 store:{credential:async(owner,kind)=>{assert.equal(owner,'only-owner');assert.equal(kind,'microsoft');return stored?credential:null;}},
 readiness:()=>({microsoft:true})
});
const request=token=>new Request('https://example.test/functions/v1/hana-automation',{
 method:'POST',headers:{origin:'https://h-s017.github.io',authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({action:'microsoft_status'})
});
const connected=await makeService(true)(request('good-session'));
assert.equal(connected.status,200);
const payload=await connected.json();
assert.deepEqual(payload,{configured:true,credentials_saved:true,scope:'Files.Read',external_writes:false});
assert.ok(!JSON.stringify(payload).includes('confidential-marker'));
const missing=await makeService(false)(request('good-session'));
assert.equal((await missing.json()).credentials_saved,false);
const blocked=await makeService(true)(request('unknown-session'));
assert.equal(blocked.status,401);
console.log('PASS: Microsoft connection status is owner-scoped, read-only, and hides secrets.');
