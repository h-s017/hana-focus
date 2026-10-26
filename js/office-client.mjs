import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
export const db=createClient('https://ihmvziqisputjnjkuhvm.supabase.co','sb_publishable_xipXAHCwziguVpbr3DEN-w_AI6Cap3f',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
