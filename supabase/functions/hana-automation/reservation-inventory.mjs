const fail=()=>Object.assign(Error('reservation_inventory_unavailable'),{code:'reservation_inventory_unavailable'});
export async function reservationInventory(fetcher=fetch){
 const response=await fetcher('https://hana-course-production.hana-reservation-payment.workers.dev/api/slots',{method:'GET',headers:{'User-Agent':'HANA-FOCUS-readonly/1.0'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw fail();const text=await response.text();if(text.length>4000000)throw fail();let data;try{data=JSON.parse(text);}catch{throw fail();}
 if(data.ok!==true||!Array.isArray(data.slots)||data.slots.length>20000)throw fail();
 return data.slots.map(s=>{if(typeof s.id!=='string'||typeof s.date!=='string'||typeof s.time!=='string'||!Number.isInteger(s.capacity)||!Number.isInteger(s.booked))throw fail();return {id:s.id,date:s.date,time:s.time,capacity:s.capacity,booked:s.booked,status:s.status,course:String(s.course||''),series:String(s.series||''),variant:String(s.variant||''),unit:String(s.unit||'位')};});
}
