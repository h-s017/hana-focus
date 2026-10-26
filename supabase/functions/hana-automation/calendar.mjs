import {instant,busyIntervals} from '../../../js/calendar-availability.mjs';
const fail=code=>Object.assign(Error(code),{code});
const API='https://hana-course-production.hana-reservation-payment.workers.dev';
export function windowBounds(start,end,maxDays=31){let a,b;try{a=instant(start);b=instant(end);}catch{throw fail('invalid_window');}if(![31,32].includes(maxDays)||b<=a||b-a>maxDays*86400000)throw fail('invalid_window');return {a,b};}
export function compareReservations(events,slots,{start,end}) {
 const {a,b}=windowBounds(start,end),busy=busyIntervals(events,{start,end});const changes=[],warnings=[];
 if(!Array.isArray(slots)||slots.length>20000)throw fail('reservation_unavailable');
 for(const slot of slots){
  if(typeof slot.id!=='string'||typeof slot.date!=='string')throw fail('reservation_unavailable');
  const day=instant(slot.date);if(day+86400000<=a||day>=b)continue;
  const time=/^(\d{2}:\d{2})\s*[–—\-~～]\s*(\d{2}:\d{2})$/.exec(String(slot.time||''));
  if(!time){warnings.push({slot_id:slot.id,reason:'unknown_duration'});continue;}
  const s=instant(slot.date+'T'+time[1]+':00+08:00'),e=instant(slot.date+'T'+time[2]+':00+08:00');
  if(e<=s||!Number.isInteger(slot.booked)||slot.booked<0||!Number.isInteger(slot.capacity)||slot.capacity<0||!['開放','關閉'].includes(slot.status)){warnings.push({slot_id:slot.id,reason:'invalid_slot'});continue;}
  if(slot.status==='關閉'||e<=a||s>=b)continue;
  if(busy.some(([x,y])=>s<y&&e>x))changes.push({slot_id:slot.id,date:slot.date,time:slot.time,course:String(slot.course||'').slice(0,100),booked:slot.booked,action:slot.booked?'REVIEW_EXISTING_BOOKING':'PROPOSE_CLOSE'});
 }
 return {mode:'read_only_preview',timeZone:'Asia/Taipei',busy_count:busy.length,changes,warnings,external_writes:false,note:'只提出關閉建議；不重開既有關閉場次，不自動取消或改期已報名課程。此結果尚未同步正式網站。'};
}
export function calendarSources({clientId,clientSecret,seedRefreshToken,ownerId,calendarId='primary',store,encryption,fetcher=fetch,now=Date.now,maxWindowDays=31}) {
 async function json(url,opts={}){const r=await fetcher(url,{...opts,redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw fail(r.status===401||r.status===403?'calendar_authorization_required':'calendar_unavailable');const text=await r.text();if(text.length>2000000)throw fail('calendar_incomplete');return JSON.parse(text);}
 async function token(owner){
  if(owner!==ownerId||!clientId||!clientSecret||!encryption)throw fail('calendar_authorization_required');
  const old=await store.credential(owner,'google');const previous=old?await encryption.open(owner,old.ciphertext):{refresh_token:seedRefreshToken};if(!previous.refresh_token)throw fail('calendar_authorization_required');
  if(previous.expires_at>now()+60000)return previous.access_token;
  const data=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:previous.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/calendar.readonly'})});
  if(!data.access_token||!String(data.scope||'').split(' ').includes('https://www.googleapis.com/auth/calendar.readonly'))throw fail('calendar_authorization_required');
  const value={access_token:data.access_token,refresh_token:data.refresh_token||previous.refresh_token,expires_at:now()+Math.min(Number(data.expires_in)||3600,86400)*1000};
  await store.saveCredential(owner,'google',await encryption.seal(owner,value),old?.version);
  return value.access_token;
 }
 return async(owner,start,end)=>{
  windowBounds(start,end,maxWindowDays);const access=await token(owner),root='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId);
  const headers={Authorization:'Bearer '+access};
  const calendar=await json(root+'?fields=timeZone',{method:'GET',headers});
  // All-day dates are local to the source calendar: never silently reinterpret a foreign zone.
  if(calendar.timeZone!=='Asia/Taipei')throw fail('calendar_timezone_required');
  let pageToken,events=[];const seen=new Set();
  for(let page=0;page<10;page++){
   const query=new URLSearchParams({timeMin:start,timeMax:end,singleEvents:'true',showDeleted:'true',timeZone:'Asia/Taipei',maxResults:'250',fields:'items(id,start,end,status,transparency),nextPageToken'});if(pageToken)query.set('pageToken',pageToken);
   const data=await json(root+'/events?'+query,{method:'GET',headers});if(!Array.isArray(data.items))throw fail('calendar_incomplete');events.push(...data.items);
   pageToken=data.nextPageToken;if(!pageToken)break;if(seen.has(pageToken))throw fail('calendar_incomplete');seen.add(pageToken);
  }
  if(pageToken)throw fail('calendar_incomplete');
  const data=await json(API+'/api/slots',{method:'GET',headers:{'User-Agent':'HANA-FOCUS-readonly/1.0'}});if(data.ok!==true)throw fail('reservation_unavailable');
  return {events,slots:data.slots,checked_at:new Date(now()).toISOString()};
 };
}
export function calendarPreview(options){
 const read=calendarSources(options);
 return async(owner,start,end)=>{
  const data=await read(owner,start,end),result=compareReservations(data.events,data.slots,{start,end});
  await options.store.event(owner,'課程預約',null,null,'calendar_preview',{events:data.events.length,proposals:result.changes.length,warnings:result.warnings.length,external_writes:false});
  return {...result,events_read:data.events.length,checked_at:data.checked_at};
 };
}
