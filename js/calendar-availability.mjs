// Read-only calculations. No Google credentials, calendar writes or reservation updates.
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
export function instant(value) {
  // Reject normalized invalid dates (e.g. February 30), not just NaN.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match || new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))).toISOString().slice(0,10)!==match[0]) throw Error('invalid_date');
  // Google all-day dates use calendar-local midnight; this module deliberately supports Taipei only.
  if (dateOnly.test(value)) value += 'T00:00:00+08:00';
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw Error('timezone_required');
  const t = Date.parse(value); if (!Number.isFinite(t)) throw Error('invalid_date'); return t;
}
export function busyIntervals(events, {start,end,timeZone='Asia/Taipei'}) {
  if (timeZone !== 'Asia/Taipei') throw Error('unsupported_calendar_timezone');
  const lo=instant(start), hi=instant(end); if (lo>=hi) throw Error('invalid_window');
  const periods=[];
  for(const e of events) {
    if(e.status==='cancelled'||e.transparency==='transparent')continue;
    if(e.status && !['confirmed','tentative'].includes(e.status))throw Error('unknown_event_status');
    const a=instant(e.start?.dateTime || e.start?.date || ''), b=instant(e.end?.dateTime || e.end?.date || '');
    if(b<=a)throw Error('invalid_event');
    if(a<hi && b>lo)periods.push([Math.max(a,lo),Math.min(b,hi)]);
  }
  periods.sort((a,b)=>a[0]-b[0]); const merged=[];
  for(const [a,b] of periods){const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}
  return merged;
}
export function availableSlots(events,{start,end,durationMinutes=60,stepMinutes=30,timeZone='Asia/Taipei'}) {
  if(!Number.isInteger(durationMinutes)||durationMinutes<=0||durationMinutes>1440||!Number.isInteger(stepMinutes)||stepMinutes<=0)throw Error('invalid_duration');
  const a=instant(start),b=instant(end);if(b-a>31*86400000)throw Error('window_too_large');
  const busy=busyIntervals(events,{start,end,timeZone});const slots=[];
  for(let t=a;t+durationMinutes*60000<=b;t+=stepMinutes*60000){const finish=t+durationMinutes*60000;if(!busy.some(([x,y])=>t<y&&finish>x))slots.push({start:new Date(t).toISOString(),end:new Date(finish).toISOString()});}
  return slots;
}
