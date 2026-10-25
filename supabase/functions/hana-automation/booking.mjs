import {orderSnapshot} from './reservations.mjs';
import {instant} from '../../../js/calendar-availability.mjs';
const fail=code=>Object.assign(Error(code),{code});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const slotSnapshot=s=>({id:s.id,date:s.date,time:s.time,status:s.status,capacity:s.capacity,booked:s.booked});
export function changeProposal(body,slots){
 if(!UUID.test(body.request_id||'')||!['slot','order'].includes(body.target)||typeof body.target_id!=='string'||!body.target_id.trim()||body.target_id.length>140)throw fail('invalid_booking_change');
 const id=body.target_id.trim(),patch=body.patch;
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw fail('invalid_booking_change');
 if(body.target==='slot'){
  const s=slots.find(x=>x.id===id);if(!s)throw fail('booking_source_unavailable');
  if(!Number.isInteger(s.booked)||s.booked<0)throw fail('booking_source_unavailable');
  const proposal={};
  for(const key of Object.keys(patch))if(!['capacity','status','date','time'].includes(key))throw fail('invalid_booking_change');
  if('capacity' in patch){if(!Number.isInteger(patch.capacity)||patch.capacity<s.booked||patch.capacity>1000)throw fail('capacity_below_booked');proposal.capacity=patch.capacity;}
  if('status' in patch){if(!['開放','關閉'].includes(patch.status))throw fail('invalid_booking_change');proposal.status=patch.status;}
  if('date' in patch||'time' in patch){const date=patch.date||s.date,time=patch.time||s.time;instant(date);const m=/^(\d{2}:\d{2})[–—\-~～](\d{2}:\d{2})$/.exec(time);if(!m||instant(date+'T'+m[2]+':00+08:00')<=instant(date+'T'+m[1]+':00+08:00'))throw fail('invalid_booking_change');proposal.date=date;proposal.time=time;}
  if(!Object.keys(proposal).length)throw fail('invalid_booking_change');
  return {target:'slot',target_id:id,proposal,source_snapshot:slotSnapshot(s),source_verified:true};
 }
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!['reschedule','quantity','cancel'].includes(patch.action))throw fail('invalid_booking_change');
 const proposal={action:patch.action};
 if(patch.action==='quantity'){if(!Number.isInteger(patch.quantity)||patch.quantity<1||patch.quantity>100)throw fail('invalid_booking_change');proposal.quantity=patch.quantity;}
 if(patch.action==='reschedule'){
  if(!Array.isArray(patch.slot_ids)||!patch.slot_ids.length||patch.slot_ids.length>12||new Set(patch.slot_ids).size!==patch.slot_ids.length)throw fail('invalid_booking_change');
  if(patch.slot_ids.some(id=>!slots.some(s=>s.id===id&&s.status==='開放')))throw fail('booking_source_unavailable');proposal.slot_ids=patch.slot_ids;
 }
 // A public slot list cannot verify a customer's order, payment/refund or cancellation status.
 return {target:'order',target_id:id,proposal,source_snapshot:{verification:'requires_reservation_admin_read',payment_status:'unknown'},source_verified:false};
}
export function bookingService({store,reservations,fetcher=fetch}){
 async function slots(){const r=await fetcher('https://hana-course-production.hana-reservation-payment.workers.dev/api/slots',{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw fail('booking_source_unavailable');const text=await r.text();if(text.length>4000000)throw fail('booking_source_unavailable');const d=JSON.parse(text);if(d.ok!==true||!Array.isArray(d.slots))throw fail('booking_source_unavailable');return d.slots;}
 return async(owner,body,user=null)=>{
  if(body.action==='booking_list')return {changes:await store.bookingChanges(owner),external_writes:false};
  if(body.action==='booking_slots')return {slots:(await slots()).map(s=>({...slotSnapshot(s),course:s.course})),external_writes:false};
  if(body.action==='booking_save'){
   const source=body.target==='slot'||body.patch?.action==='reschedule'?await slots():[];
   const change=changeProposal(body,source);
   if(change.target==='order'&&reservations?.configured&&reservations.permitted(user)){const original=await reservations.find(user,change.target_id);if(!original)throw fail('booking_source_unavailable');change.source_snapshot=orderSnapshot(original);change.source_verified=true;}
   return {change_id:await store.bookingSave(owner,body.request_id,change),status:'pending',source_verified:change.source_verified,external_writes:false};
  }
  if(body.action==='booking_review'){
   if(!UUID.test(body.change_id||'')||!['approved','rejected'].includes(body.decision))throw fail('invalid_booking_change');
   const change=await store.bookingGet(owner,body.change_id);if(!change)throw fail('booking_source_unavailable');
   if(body.decision==='approved'){
    if(!change.source_verified)throw fail('booking_source_unverified');
    if(change.target==='order'){if(!reservations?.configured||!reservations.permitted(user))throw fail('booking_source_unverified');const current=await reservations.find(user,change.target_id);if(!current||Object.entries(orderSnapshot(current)).some(([k,v])=>change.source_snapshot[k]!==v))throw fail('booking_source_changed');}
    if(change.target==='slot'){const current=(await slots()).find(s=>s.id===change.target_id);if(!current||JSON.stringify(slotSnapshot(current))!==JSON.stringify(change.source_snapshot)){
      // jsonb changes key order: compare canonical field values, not serialization order.
      if(!current||Object.entries(slotSnapshot(current)).some(([k,v])=>change.source_snapshot[k]!==v))throw fail('booking_source_changed');
    }}
   }
   return {status:await store.bookingReview(owner,body.change_id,body.decision),external_writes:false};
  }
  throw fail('invalid_booking_change');
 };
}
