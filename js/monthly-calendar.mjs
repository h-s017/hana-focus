// Pure monthly planning. No network calls, storage, calendar writes or reservation mutations.
import {busyIntervals, instant} from './calendar-availability.mjs';

const two=n=>String(n).padStart(2,'0');
function parseDay(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('invalid_date');
 const [year,month,day]=value.split('-').map(Number);
 if(year<1000||year>9998)throw Error('invalid_date');
 const check=new Date(Date.UTC(year,month-1,day));
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)throw Error('invalid_date');
 return {year,month,day};
}
function monthDate(year,month,day){return year+'-'+two(month)+'-'+two(day);}
function monthLength(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate();}
export function monthEndPlan(today) {
 const {year,month,day}=parseDay(today),length=monthLength(year,month);
 const nextYear=month===12?year+1:year,nextMonth=month===12?1:month+1;
 return {today,targetMonth:nextYear+'-'+two(nextMonth),windowStart:monthDate(year,month,length-4),windowEnd:monthDate(year,month,length),shouldRun:day>=length-4,timezone:'Asia/Taipei',scheduledHour:8};
}
export function monthDays(month){
 if(typeof month!=='string'||Number(month.slice(0,4))<1000||Number(month.slice(0,4))>9998||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('invalid_month');
 const [y,m]=month.split('-').map(Number);
 return Array.from({length:monthLength(y,m)},(_,i)=>{
  const date=monthDate(y,m,i+1);
  return {date,weekday:new Date(Date.UTC(y,m-1,i+1)).getUTCDay()};
 });
}
function timeMinutes(value){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('invalid_time');
 return Number(value.slice(0,2))*60+Number(value.slice(3));
}
function localInstant(date,mins){
 return instant(date+'T'+two(Math.floor(mins/60))+':'+two(mins%60)+':00+08:00');
}
function overlap(a,b,x,y){return a<y&&b>x;}
function parseBookingSlot(s){
 const match=/^(\d{2}:\d{2})\s*[–—~～-]\s*(\d{2}:\d{2})$/.exec(String(s.time||''));
 if(!match)throw Error('invalid_slot_time');
 const start=timeMinutes(match[1]),end=timeMinutes(match[2]);
 if(start>=end||!Number.isInteger(s.booked)||!Number.isInteger(s.capacity)||s.booked<0||s.capacity<0||s.booked>s.capacity||!['開放','關閉'].includes(s.status))throw Error('invalid_slot');
 return {start,end,booked:s.booked,capacity:s.capacity,status:s.status,id:String(s.id||''),course:String(s.course||'')};
}
export function validatePolicy(p){
 if(!p||typeof p!=='object')return null;
 const weekdays=p.weekdays,windows=p.windows;
 if(!Array.isArray(weekdays)||!weekdays.length||weekdays.length>7||new Set(weekdays).size!==weekdays.length||!weekdays.every(d=>Number.isInteger(d)&&d>=0&&d<=6)||!Array.isArray(windows)||!windows.length||windows.length>12)return null;
 if(!Number.isInteger(p.durationMinutes)||p.durationMinutes<15||p.durationMinutes>720)return null;
 const step=p.stepMinutes??30,before=p.bufferBeforeMinutes??0,after=p.bufferAfterMinutes??0;
 if(!Number.isInteger(step)||step<5||step>240||![before,after].every(n=>Number.isInteger(n)&&n>=0&&n<=360))return null;
 const parsed=windows.map(w=>({start:timeMinutes(w.start),end:timeMinutes(w.end)})).sort((a,b)=>a.start-b.start);
 if(parsed.some((w,i)=>i&&w.start<parsed[i-1].end))return null;
 if(parsed.some(w=>w.start>=w.end)||!Array.isArray(p.closedDates||[])||(p.closedDates||[]).length>62)return null;
 for(const d of p.closedDates||[])parseDay(d);
 return {weekdays,windows:parsed,duration:p.durationMinutes,step,before,after,closedDates:new Set(p.closedDates||[])};
}
// A draft is NOT a public booking offer. Both upstream sources must be verified.
export function createMonthlyDraft({month,events=[],slots=[],policy={},sources={}}){
 const dates=monthDays(month),hasSources=sources.calendar===true&&sources.reservation===true;
 const hasRules=Array.isArray(policy.weekdays)&&policy.weekdays.length>0&&Array.isArray(policy.windows)&&policy.windows.length>0;
 if(!Array.isArray(events)||events.length>2500||!Array.isArray(slots)||slots.length>20000)throw Error('invalid_sources');
 const rules=hasRules?validatePolicy(policy):null;
 if(hasRules&&!rules)throw Error('invalid_policy');
 const ids=new Set();for(const slot of slots){parseDay(slot.date);if(typeof slot.id!=='string'||!slot.id||ids.has(slot.id))throw Error('invalid_sources');ids.add(slot.id);}
 // Expand before clipping: adjacent-day events can block this month through a buffer.
 const start=instant(dates[0].date+'T00:00:00+08:00'),end=instant(dates.at(-1).date+'T00:00:00+08:00')+86400000;
 const busyAll=hasSources?busyIntervals(events,{start:new Date(start-(rules?.after||0)*60000).toISOString(),end:new Date(end+(rules?.before||0)*60000).toISOString()}).map(([a,b])=>[a-(rules?.before||0)*60000,b+(rules?.after||0)*60000]):[];
 const days=dates.map(({date,weekday})=>{
  const day={date,weekday,status:'unverified',existingOpen:[],reservationSlots:[],proposed:[],conflicts:[],warnings:[]};
  if(sources.reservation!==true)return day;
  const closedByPolicy=!!rules&&(rules.closedDates.has(date)||!rules.weekdays.includes(weekday));
  const start=date+'T00:00:00+08:00';
  const next=new Date(instant(start)+86400000).toISOString();
  const busy=busyAll.filter(([a,b])=>a<instant(next)&&b>instant(start));
  const inDay=slots.filter(s=>s.date===date);
  const parsed=[];
  for(const s of inDay){
   try{parsed.push(parseBookingSlot(s));}catch{day.warnings.push({slotId:String(s.id||''),reason:'invalid_slot'});}
  }
  if(day.warnings.length){day.status='needs_review';return day;}
  for(const s of parsed){
   day.reservationSlots.push({slotId:s.id,course:s.course,start:s.start,end:s.end,status:s.status,capacity:s.capacity,booked:s.booked,remaining:s.capacity-s.booked});
   const a=localInstant(date,s.start),b=localInstant(date,s.end);
   const conflict=busy.some(([x,y])=>overlap(a,b,x,y));
   if(conflict&&s.booked>0)day.conflicts.push({slotId:s.id,time:s.start+'-'+s.end,booked:s.booked,reason:'calendar_conflict'});
   if(s.status==='開放'&&s.capacity>s.booked&&!conflict)day.existingOpen.push({slotId:s.id,course:s.course,start:s.start,end:s.end,remaining:s.capacity-s.booked});
  }
  if(!hasSources){day.status='calendar_unverified';return day;}
  if(!rules){day.status=day.conflicts.length?'conflict_requires_review':policy.mode==='existing_slots_only'?(day.existingOpen.length?'existing_inventory_verified':'no_existing_open_inventory'):'rules_missing';return day;}
  if(closedByPolicy){day.status=day.conflicts.length?'conflict_requires_review':'closed_by_policy';return day;}
  for(const w of rules.windows)for(let t=w.start;t+rules.duration<=w.end;t+=rules.step){
   const a=localInstant(date,t),b=localInstant(date,t+rules.duration);
   if(busy.some(([x,y])=>overlap(a,b,x,y)))continue;
   if(parsed.some(s=>overlap(t,t+rules.duration,s.start,s.end)))continue;
   day.proposed.push({start:t,end:t+rules.duration,status:'proposal_only'});
  }
  day.status=day.conflicts.length?'conflict_requires_review':day.existingOpen.length||day.proposed.length?'has_availability':'fully_booked_or_unavailable';
  return day;
 });
 return {month,draftKey:'monthly-availability:'+month,timeZone:'Asia/Taipei',sourceVerified:hasSources,externalWrites:false,published:false,days};
}


export function applyMonthlyOverrides(draft,overrides={}){
 if(!overrides||Array.isArray(overrides)||typeof overrides!=='object'||Object.keys(overrides).length>31)throw Error('invalid_overrides');
 const result=structuredClone(draft);
 for(const [date,value] of Object.entries(overrides)){
  const day=result.days.find(d=>d.date===date);if(!day||value!=='closed')throw Error('invalid_overrides');
  day.proposed=[];day.manualOverride='closed';day.status=day.conflicts.length?'conflict_requires_review':'manual_closed';
 }
 return {...result,externalWrites:false,published:false};
}
export function monthlyDiff(previous,next){
 const old=new Map((previous?.days||[]).map(d=>[d.date,JSON.stringify(d)]));
 return next.days.filter(d=>old.get(d.date)!==JSON.stringify(d)).map(d=>d.date);
}
export function monthBounds(month){const days=monthDays(month);return {start:days[0].date+'T00:00:00+08:00',end:new Date(instant(days.at(-1).date+'T00:00:00+08:00')+86400000).toISOString()};}
