// HANA Visual Librarian: scans inbox, tags images, proposes categories.
// Requires GOOGLE_SERVICE_ACCOUNT_JSON and GEMINI_API_KEY as GitHub secrets.
// Does not move/delete files without VISUAL_LIBRARY_AUTO_MOVE=true.
const inbox='1IiWS9R-EUmpZ7WWh1JQc_e6EdbSMGBFo';
const folders={'01 植物與香材':'13lK6i8yYiNPONVul2m_exKJlplrHnEN_','02 藝術與文化':'16LXPqSIglhNoqXcaUirV6ALGNo0Y86rW','03 空間與建築':'12FHtNxTYUhF22q1QzDTJBKgAf0-IX5ul','04 物件與材質':'1oqlJBPMYc59eYI4QxrjmWA7fB0lPk97L','05 光影與抽象':'1Ei4UkU0MGX-wX12jGmtXX70l2q7bldgy','06 HANA 原創':'12fvhbUUX0zE5LDqZvLJhYAylC8A32jov'};
const fs=await import('node:fs/promises');const crypto=await import('node:crypto');
const secret=process.env.GOOGLE_SERVICE_ACCOUNT_JSON, gemini=process.env.GEMINI_API_KEY;
if(!secret||!gemini){console.log('Not configured: set GOOGLE_SERVICE_ACCOUNT_JSON and GEMINI_API_KEY; skipping safely.');process.exit(0)}
const service=JSON.parse(secret);
function b64(x){return Buffer.from(x).toString('base64url')}
const now=Math.floor(Date.now()/1000);
const header=b64(JSON.stringify({alg:'RS256',typ:'JWT'})),payload=b64(JSON.stringify({iss:service.client_email,scope:'https://www.googleapis.com/auth/drive',aud:service.token_uri||'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
const signer=crypto.createSign('RSA-SHA256');signer.update(header+'.'+payload);const jwt=header+'.'+payload+'.'+signer.sign(service.private_key,'base64url');
const tokenResp=await fetch(service.token_uri||'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});if(!tokenResp.ok)throw Error('Google token failed '+tokenResp.status);
const access=(await tokenResp.json()).access_token;
async function drive(url,opts={}){const r=await fetch(url,{...opts,headers:{Authorization:'Bearer '+access,...opts.headers}});if(!r.ok)throw Error('Drive '+r.status+' '+(await r.text()).slice(0,300));return r}
const q=encodeURIComponent(`'${inbox}' in parents and trashed = false and mimeType contains 'image/'`);
const files=[];let pageToken;
do{const url='https://www.googleapis.com/drive/v3/files?q='+q+'&fields='+encodeURIComponent('nextPageToken,files(id,name,mimeType,parents,webViewLink,createdTime)')+'&pageSize=100'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');const data=await (await drive(url)).json();files.push(...(data.files||[]));pageToken=data.nextPageToken}while(pageToken&&files.length<500);
const date=new Date().toISOString().slice(0,10);const out=`content/visual-library/${date}`;await fs.mkdir(out,{recursive:true});
const rows=[];
for(const file of files.slice(0,30)){try{
const bytes=Buffer.from(await (await drive('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media')).arrayBuffer());
if(bytes.length>8_000_000){rows.push({id:file.id,name:file.name,status:'needs-review',reason:'image over 8 MB'});continue}
const prompt='Analyze this photo for HANA Scent Artist. Return ONLY valid JSON with keys category,objects,keywords,visual_style,scent_associations,confidence,needs_human_review,scientific_name. category must be one of: '+Object.keys(folders).join(', ')+'. Do not infer botanical species if uncertain; scientific_name must be null unless clearly identifiable. Scent associations are imaginative, not factual odor claims. If people or copyrighted art are visible flag needs_human_review. Traditional Chinese.';
const body={contents:[{parts:[{text:prompt},{inline_data:{mime_type:file.mimeType,data:bytes.toString('base64')}}]}],generationConfig:{responseMimeType:'application/json'}};
const resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':gemini},body:JSON.stringify(body)});
if(!resp.ok)throw Error('Vision API '+resp.status);
const raw=await resp.json();const obj=JSON.parse(raw.candidates?.[0]?.content?.parts?.[0]?.text||'{}');
const category=folders[obj.category]?obj.category:null;
const item={id:file.id,name:file.name,url:file.webViewLink||'https://drive.google.com/file/d/'+file.id+'/view',...obj,status:'pending-human-review',category};
rows.push(item);
// Safe default: no automatic moves. Even with auto move, only high confidence & no review flags.
if(process.env.VISUAL_LIBRARY_AUTO_MOVE==='true'&&category&&Number(obj.confidence)>=0.95&&!obj.needs_human_review){
 await drive('https://www.googleapis.com/drive/v3/files/'+file.id+'?addParents='+folders[category]+'&removeParents='+inbox,{method:'PATCH'});
 item.moved=true;
}
}catch(e){rows.push({id:file.id,name:file.name,status:'needs-review',error:String(e)})}}
await fs.writeFile(out+'/index.json',JSON.stringify({date,scanned:files.length,items:rows},null,2)+'\n');
console.log('Indexed '+rows.length+' photos. Manual review required before publishing.');