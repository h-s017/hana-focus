const SOURCE='https://hana-course-production.hana-reservation-payment.workers.dev';
const fail=code=>Object.assign(Error(code),{code});
const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const number=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max?value:null;
export function publicReservation(row){
 return {id:text(row.id,100),course:text(row.course,200),variant:text(row.variant,120),
  name:text(row.name,100),phone:text(row.phone,50),email:text(row.email,254),line:text(row.line,100),note:text(row.note,800),
  sessions:text(row.sessions,3000),status:text(row.status,40),quantity:number(row.quantity,100),amount:number(row.amount,1000000000),
  booking_unit:text(row.booking_unit,50),created_at:number(row.created_at,9999999999),paid_at:number(row.paid_at,9999999999),cancellation_status:text(row.cancellation_status,40)};
}
export const orderSnapshot=row=>({id:row.id,status:row.status,quantity:row.quantity,amount:row.amount,sessions:row.sessions,cancellation_status:row.cancellation_status});
export function reservationReader({token,store,fetcher=fetch}){
 const permitted=user=>user?.app_metadata?.hana_office_access===true&&user?.app_metadata?.hana_reservation_read_access===true;
 const configured=typeof token==='string'&&token.length>=32;
 async function page(user,cursor=null){
  if(!permitted(user))throw fail('reservation_read_access_required');
  if(!configured)throw fail('reservation_connection_required');
  let body={};
  if(cursor!==null){if(!cursor||!Number.isSafeInteger(cursor.before)||cursor.before<0||typeof cursor.beforeId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(cursor.beforeId))throw fail('invalid_reservation_cursor');body={before:cursor.before,beforeId:cursor.beforeId};}
  // This fixed POST route performs SELECT only in the existing reservation worker.
  // Never accept a caller-supplied origin, route, method or admin credential.
  const r=await fetcher(SOURCE+'/api/admin/orders',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+token,Origin:SOURCE,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw fail(r.status===401||r.status===403?'reservation_connection_required':'reservation_read_unavailable');
  if(Number(r.headers.get('content-length'))>2000000)throw fail('reservation_read_unavailable');
  const reader=r.body?.getReader(),parts=[];let size=0;
  if(!reader)throw fail('reservation_read_unavailable');
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000)throw fail('reservation_read_unavailable');parts.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
  let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('reservation_read_unavailable');}
  if(data.ok!==true||!Array.isArray(data.orders)||data.orders.length>200)throw fail('reservation_read_unavailable');
  const orders=data.orders.map(publicReservation);let next_cursor=null;
  if(data.orders.length===200){const last=orders.at(-1);if(last.created_at===null||!/^[A-Za-z0-9_-]{1,100}$/.test(last.id))throw fail('reservation_read_incomplete');next_cursor={before:last.created_at,beforeId:last.id};}
  return {orders,next_cursor,read_only:true,external_writes:false};
 }
 return {configured,permitted,
  async list(user,cursor){const result=await page(user,cursor);await store.event(user.id,'課程預約',null,null,'reservation_details_read',{count:result.orders.length});return result;},
  async find(user,id){
   if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw fail('invalid_booking_change');
   let cursor=null;const seen=new Set();
   for(let i=0;i<10;i++){const data=await page(user,cursor),row=data.orders.find(x=>x.id===id);if(row)return row;if(!data.next_cursor)return null;const key=JSON.stringify(data.next_cursor);if(seen.has(key))throw fail('reservation_read_incomplete');seen.add(key);cursor=data.next_cursor;}
   throw fail('reservation_read_incomplete');
  }
 };
}
