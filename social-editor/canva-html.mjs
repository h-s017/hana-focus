// Portable Canva import source: one fixed-page HTML element per editable IG page.
// No image binaries, copyrighted media, live customer data, or API credentials.
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PALETTE=['#252c2c','#303335','#343733','#292e33','#36332f','#27322f'];
const KEYWORDS=['OBSERVATION','LAYERING','FOREGROUND','BACKGROUND','BALANCE','EXERCISE'];
export function canvaImportHtml({title,pages,day,date}){
 if(!Array.isArray(pages)||pages.length!==6||pages.some(p=>typeof p.title!=='string'||typeof p.body!=='string'||!p.title||!p.body))throw Error('canva_six_pages_required');
 if(!Number.isInteger(day)||day<1||! /^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('canva_day_invalid');
 const slides=pages.map((p,i)=>{
  const n=String(i+1).padStart(2,'0'),background=PALETTE[i];
  const motif='<div style="position:absolute;left:80px;right:80px;top:180px;bottom:240px;border:1px solid #828c85;opacity:.35;transform:rotate('+((i%2)?-3:2)+'deg)"></div>'
   +'<div style="position:absolute;width:460px;height:460px;border:1px solid #b8b7aa;border-radius:500px;top:'+(320+i*17)+'px;left:'+(280-i*13)+'px;opacity:.28"></div>'
   +'<div style="position:absolute;width:280px;height:640px;background:#71746e;top:'+(200+i*12)+'px;left:'+(580-i*28)+'px;transform:rotate('+(13+i*3)+'deg);opacity:.16"></div>';
  return '<section data-document-role="page" data-label="HANA Day '+day+' / '+n+'" style="width:1080px;height:1350px;box-sizing:border-box;position:relative;overflow:hidden;background:'+background+';color:#f0eee8;font-family:Georgia,serif;padding:92px 100px;">'
   +motif
   +'<div style="position:relative;z-index:1;font-family:Arial,sans-serif;font-size:22px;letter-spacing:5px;color:#c0beb2;">HANA SCENT ARTIST</div>'
   +'<div style="position:relative;z-index:1;margin-top:10px;width:100%;height:1px;background:#a6aca4;opacity:.5"></div>'
   +'<div style="position:relative;z-index:1;margin-top:90px;font-family:Arial,sans-serif;font-size:22px;letter-spacing:8px;color:#cec6b5;">'+KEYWORDS[i]+'</div>'
   +'<div style="position:relative;z-index:1;margin-top:50px;font-family:serif;font-size:72px;font-weight:400;line-height:1.24;letter-spacing:3px;max-width:860px;">'+escape(p.title)+'</div>'
   +'<div style="position:relative;z-index:1;margin-top:55px;width:100px;height:2px;background:#b6a98f;"></div>'
   +'<div style="position:relative;z-index:1;margin-top:48px;font-size:34px;line-height:1.8;max-width:770px;white-space:pre-line;font-family:serif;color:#e0dfd8;">'+escape(p.body).replace(/\n/g,'&#10;')+'</div>'
   +'<div style="position:absolute;z-index:1;left:100px;bottom:125px;right:100px;height:1px;background:#b3b8b0;opacity:.5"></div>'
   +'<div style="position:absolute;z-index:1;left:100px;bottom:77px;font-family:Arial,sans-serif;font-size:18px;letter-spacing:3px;color:#bdbbb2;">OLFACTORY ART · '+escape(date.slice(0,4))+'</div>'
   +'<div style="position:absolute;z-index:1;right:100px;bottom:72px;font-family:Georgia,serif;font-size:28px;color:#e5e2d5;">'+n+' / 06</div>'
   +'</section>';
 }).join('');
 return '<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"/><title>'+escape(title)+'</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0">'+slides+'</body></html>';
}
