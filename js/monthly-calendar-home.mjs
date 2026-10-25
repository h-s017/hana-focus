import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import {mountMonthlyCalendar} from './monthly-calendar-app.mjs';
const db=createClient('https://ihmvziqisputjnjkuhvm.supabase.co','sb_publishable_xipXAHCwziguVpbr3DEN-w_AI6Cap3f',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const host=document.getElementById('hana-month-calendar');let dispose=null,version=0;
async function sync(){const v=++version;dispose?.();dispose=mountMonthlyCalendar(host);try{const {data:{session},error}=await db.auth.getSession();if(v!==version||error||!session)return;dispose?.();dispose=mountMonthlyCalendar(host,{db});}catch{}}
db.auth.onAuthStateChange(()=>void sync());void sync();
