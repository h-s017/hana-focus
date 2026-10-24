export const CALLBACK = 'https://h-s017.github.io/hana-focus/ai-office.html';
const KEY = 'hana-office-login-next-at-v1';
export function authMessage(error) {
  const code = error?.code;
  if (error?.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return '寄信頻率或額度已達限制，請稍後再試；管理者需檢查 SMTP 額度。';
  if (['otp_expired', 'access_denied', 'bad_code_verifier', 'flow_state_expired', 'flow_state_not_found'].includes(code)) return '登入連結已過期、已使用或不適用此瀏覽器，請重新索取最新連結。';
  if (code === 'signup_disabled' || code === 'user_not_found') return '此信箱尚未獲邀請，請由管理者確認帳號。';
  return '登入服務暫時無法完成，請稍後重試；未確認郵件已送達。';
}
export function loginController({auth, storage, now = Date.now, withLock = async fn => fn()}) {
  let pending = false;
  const read = () => { try { return Number(storage.getItem(KEY)) || 0; } catch { return 0; } };
  const write = value => { try { storage.setItem(KEY, String(value)); } catch { /* server rate limit remains authoritative */ } };
  return {
    remaining: () => Math.max(0, read() - now()),
    async send(email) {
      email = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return {ok:false, message:'請輸入有效電子郵件。'};
      if (pending) return {ok:false, message:'登入請求處理中，請勿重複寄送。'};
      pending = true;
      try {
        return await withLock(async () => {
          if (now() < read()) return {ok:false, message:'請等待冷卻時間結束後再索取登入郵件。'};
          write(now() + 120000);
          try {
            const {error} = await auth.signInWithOtp({email, options:{emailRedirectTo:CALLBACK, shouldCreateUser:false}});
            if (error?.status === 429) write(now() + 300000);
            return error ? {ok:false, message:authMessage(error)} : {ok:true, message:'寄送請求已受理；請查看最新郵件。連結只可使用一次，尚未確認投遞成功。'};
          } catch { return {ok:false, message:authMessage(null)}; }
        });
      } finally { pending = false; }
    },
  };
}
export async function consumeCallback({auth, href, replace}) {
  const url = new URL(href), hash = new URLSearchParams(url.hash.slice(1));
  const params = url.searchParams;
  const isCallback = ['code','token_hash','error','error_code'].some(k => params.has(k) || hash.has(k)) || hash.has('access_token');
  if (!isCallback) return {handled:false};
  // Strip secrets before awaiting any request or showing messages.
  replace(url.pathname);
  const code = params.get('error_code') || hash.get('error_code') || params.get('error') || hash.get('error');
  if (code) return {handled:true, ok:false, message:authMessage({code})};
  try {
    let response;
    if (params.get('code')) response = await auth.exchangeCodeForSession(params.get('code'));
    else if (params.get('token_hash') && params.get('type') === 'email') response = await auth.verifyOtp({token_hash:params.get('token_hash'), type:'email'});
    else if (hash.get('access_token') && hash.get('refresh_token')) response = await auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});
    else return {handled:true, ok:false, message:'登入連結不完整，請重新索取。'};
    return response.error ? {handled:true,ok:false,message:authMessage(response.error)} : {handled:true,ok:true,message:'登入連結已驗證。'};
  } catch { return {handled:true,ok:false,message:authMessage(null)}; }
}
