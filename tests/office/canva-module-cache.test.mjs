import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=name=>readFileSync(fileURLToPath(new URL('../../'+name,import.meta.url)),'utf8');
const paths=['workspace.html','ai-office.html','js/office-app.mjs','js/workspace-navigation.mjs'];
const version='office-20261101-r1';
const refs=[
 'src="./js/office-app.mjs?v='+version+'"',
 'src="./js/office-app.mjs?v='+version+'"',
 "from './workspace-navigation.mjs?v="+version+"'",
 "from './canva-connect.mjs?v="+version+"'"
];
paths.forEach((p,i)=>assert.ok(read(p).includes(refs[i]),p+' must load the OAuth fix without stale module cache'));
assert.ok(read('js/workspace-navigation.mjs').includes('查看今日 Canva 自動匯入紀錄'));
assert.ok(read('js/office-app.mjs').includes("from './automation-app.mjs?v="+"office-20261101-r1"+"'"));
assert.ok(read('js/automation-app.mjs').includes('office-onedrive-connection'));
const connected=read('js/canva-connect.mjs');
assert.ok(connected.includes("toLowerCase()!=='s256'"));
assert.ok(connected.includes('canva_oauth_client_version_mismatch'));
console.log('PASS: HTML entrypoints and ESM chain load versioned Canva OAuth code.');
