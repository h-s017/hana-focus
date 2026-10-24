import test from 'node:test';
import assert from 'node:assert/strict';
import {folderLink,materialRecord} from '../../js/project-materials.mjs';
test('personal and organizational OneDrive links preserve sharing parameters',()=>{
 for(const url of ['https://1drv.ms/f/s!fixture?e=abc','https://onedrive.live.com/?id=fixture','https://example-my.sharepoint.com/:f:/g/personal/fixture'])assert.equal(folderLink(' '+url+' '),url);
});
test('reject script, credentials, insecure, deceptive and unrelated hosts',()=>{
 for(const url of ['javascript:alert(1)','http://1drv.ms/f/x','https://1drv.ms.attacker.invalid/x','https://evilsharepoint.com/x','https://sharepoint.com/x','https://user:password@1drv.ms/x','https://1drv.ms:444/x','not-a-link','https://1drv.ms/'+ 'x'.repeat(2048)])assert.throws(()=>folderLink(url));
});
test('project validation and exact owner/project scope',()=>{
 assert.deepEqual(materialRecord('owner-a',' 文慶雞 ','https://1drv.ms/f/fixture'),{owner_id:'owner-a',project:'文慶雞',folder_url:'https://1drv.ms/f/fixture'});
 for(const p of ['', '  ','x'.repeat(101)])assert.throws(()=>materialRecord('owner-a',p,'https://1drv.ms/f/fixture'));
 assert.throws(()=>materialRecord(null,'project','https://1drv.ms/f/fixture'));
});
