const KEYS=['hana-focus-workspace-v2-work','hana-focus-workspace-v2-church','hana-focus-ai-office-demo-v1','hana-focus-active-workspace','hana-focus-v2-migrated','hana-focus-work-items-20261020-v1','hana-focus-qipao-campaign-20261024-v1'];
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function makeBackup(storage,now=Date.now()){
 const values=Object.fromEntries(KEYS.map(key=>[key,storage.getItem(key)])),payload={format:'hana-local-backup-v1',created_at:new Date(now).toISOString(),values};
 const checksum=await digest(JSON.stringify(payload)),backup={...payload,checksum},text=JSON.stringify(backup);
 const key='hana-focus-backup:'+checksum;storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error('backup_not_saved');return {key,text,backup};
}
export async function verifyBackup(backup){
 if(!backup||backup.format!=='hana-local-backup-v1'||typeof backup.created_at!=='string'||!backup.values||Object.keys(backup.values).some(k=>!KEYS.includes(k))||KEYS.some(k=>!(k in backup.values)))throw Error('invalid_backup');
 for(const [key,raw] of Object.entries(backup.values)){if(raw!==null&&typeof raw!=='string')throw Error('invalid_backup');if(/workspace-v2|demo-v1/.test(key)&&raw){const d=JSON.parse(raw);if(!Array.isArray(d.tasks)||!Array.isArray(d.ideas))throw Error('invalid_backup');}}
 const {checksum,...payload}=backup;if(await digest(JSON.stringify(payload))!==checksum)throw Error('backup_checksum_mismatch');return backup;
}
export async function restoreBackup(storage,input){
 const backup=await verifyBackup(typeof input==='string'?JSON.parse(input):input),before=await makeBackup(storage);
 const write=values=>{for(const [key,value] of Object.entries(values))value===null?storage.removeItem(key):storage.setItem(key,value);};
 try{write(backup.values);}catch(error){try{write(before.backup.values);}catch{throw Error('restore_and_rollback_failed');}throw error;}return before;
}
export function localRows(backup){const rows=[];for(const workspace of ['work','church']){const raw=backup.values['hana-focus-workspace-v2-'+workspace];if(raw){const data=JSON.parse(raw);rows.push({workspace,...data});}}return rows;}
