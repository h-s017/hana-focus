// Device-local visual preferences only. No account, customer data or remote writes.
export const APPEARANCE_KEY='hana-focus-appearance-v1';
export const DEFAULT_APPEARANCE=Object.freeze({background:'#ffffff',text:'#000000',brand:'#000000',fontSize:18,fontFamily:'sans'});
export const FONTS=Object.freeze({sans:'system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif',serif:'"Noto Serif TC","Songti TC","PMingLiU",serif'});
const color=(v,fallback)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fallback;
export function normalizeAppearance(value){const x=value&&typeof value==='object'&&!Array.isArray(value)?value:{};return {background:color(x.background,DEFAULT_APPEARANCE.background),text:color(x.text,DEFAULT_APPEARANCE.text),brand:color(x.brand,DEFAULT_APPEARANCE.brand),fontSize:Number.isInteger(x.fontSize)&&x.fontSize>=16&&x.fontSize<=24?x.fontSize:18,fontFamily:Object.hasOwn(FONTS,x.fontFamily)?x.fontFamily:'sans'};}
const luminance=c=>{const v=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
export function contrastRatio(a,b){const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
export function onBrand(brand){return contrastRatio(brand,'#ffffff')>=contrastRatio(brand,'#000000')?'#ffffff':'#000000';}
export function readAppearance(storage){try{return normalizeAppearance(JSON.parse(storage.getItem(APPEARANCE_KEY)||'null'));}catch{return {...DEFAULT_APPEARANCE};}}
export function applyAppearance(root,value){const x=normalizeAppearance(value);root.dataset.focusAppearance='';for(const [key,v] of Object.entries({'--focus-bg':x.background,'--focus-text':x.text,'--focus-brand':x.brand,'--focus-on-brand':onBrand(x.brand),'--focus-font-size':x.fontSize+'px','--focus-font-family':FONTS[x.fontFamily]}))root.style.setProperty(key,v);return x;}
export function mountAppearance(doc=document){
 if(doc.getElementById('focus-appearance-dialog'))return;
 let storage=null;try{storage=window.localStorage;}catch{}
 let current=readAppearance(storage);applyAppearance(doc.documentElement,current);
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const toggle=el('button','Aa 外觀');toggle.type='button';toggle.className='focus-appearance-toggle';toggle.setAttribute('aria-label','調整顏色與字型大小');toggle.setAttribute('aria-haspopup','dialog');
 const dialog=el('dialog');dialog.id='focus-appearance-dialog';dialog.setAttribute('aria-labelledby','focus-appearance-title');
 const title=el('h2','外觀設定');title.id='focus-appearance-title';const help=el('p','即時預覽顏色與文字大小，儲存後套用至這個瀏覽器的 HANA FOCUS 各頁面。');const form=el('form');
 const fields={};const grid=el('div');grid.className='appearance-fields';
 for(const [key,label] of [['brand','品牌色／按鈕色'],['background','背景色'],['text','文字顏色']]){const wrap=el('label',label),input=el('input');input.type='color';input.name=key;input.setAttribute('aria-label',label);fields[key]=input;wrap.append(input);grid.append(wrap);}
 const sizeLabel=el('label','字體大小'),range=el('input'),output=el('output');range.type='range';range.min='16';range.max='24';range.step='1';range.name='fontSize';range.id='focus-font-size';range.setAttribute('aria-label','字體大小');output.htmlFor=range.id;fields.fontSize=range;sizeLabel.append(range,output);grid.append(sizeLabel);
 const fontLabel=el('label','字型'),font=el('select');font.name='fontFamily';font.setAttribute('aria-label','字型');for(const [value,name] of [['sans','系統黑體'],['serif','明體']]){const o=el('option',name);o.value=value;font.append(o);}fields.fontFamily=font;fontLabel.append(font);grid.append(fontLabel);
 const sample=el('div');sample.className='appearance-sample';sample.append(el('strong','Hana Scent Artist'),el('p','預約與行程 · 10:00–18:00'),el('small','星期日開始的一週，清楚安排每一天。'));
 const message=el('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');const actions=el('div');actions.className='appearance-actions';
 const reset=el('button','恢復純白黑字'),cancel=el('button','取消'),save=el('button','儲存外觀');reset.type=cancel.type='button';save.type='submit';save.className='appearance-save';actions.append(reset,cancel,save);form.append(grid,sample,message,actions);dialog.append(title,help,form);doc.body.append(toggle,dialog);
 const status=el('p');status.className='appearance-toast';status.setAttribute('role','status');status.hidden=true;doc.body.append(status);let timer;
 function values(){return normalizeAppearance({background:fields.background.value,text:fields.text.value,brand:fields.brand.value,fontSize:Number(range.value),fontFamily:font.value});}
 function populate(value){for(const [key,v] of Object.entries(value))fields[key].value=String(v);preview();}
 function preview(){const x=values();output.value=x.fontSize+'px';sample.style.background=x.background;sample.style.color=x.text;sample.style.setProperty('--focus-text',x.text);sample.style.fontFamily=FONTS[x.fontFamily];sample.style.fontSize=x.fontSize+'px';const readable=contrastRatio(x.background,x.text)>=4.5;message.textContent=readable?'預覽中；按「儲存外觀」保留設定。':'背景與文字太接近，請調深文字或調淺背景，讓內容清楚可讀。';applyAppearance(doc.documentElement,readable?x:{...current,fontSize:x.fontSize,fontFamily:x.fontFamily});}
 for(const input of Object.values(fields))input.addEventListener('input',preview);
 toggle.onclick=()=>{populate(current);dialog.showModal();};
 cancel.onclick=()=>dialog.close();dialog.addEventListener('close',()=>applyAppearance(doc.documentElement,current));
 function persist(x){try{if(!storage)throw Error();storage.setItem(APPEARANCE_KEY,JSON.stringify(x));current=applyAppearance(doc.documentElement,x);status.hidden=false;status.textContent='外觀設定已儲存';clearTimeout(timer);timer=setTimeout(()=>status.hidden=true,3000);dialog.close();}catch{message.textContent='這個瀏覽器無法儲存外觀設定；尚未保存，請檢查瀏覽器儲存權限。';}}
 reset.onclick=()=>{populate(DEFAULT_APPEARANCE);persist({...DEFAULT_APPEARANCE});};
 form.onsubmit=event=>{event.preventDefault();const x=values();if(contrastRatio(x.background,x.text)<4.5){message.textContent='文字與背景對比不足，請調整顏色後再儲存。';return;}persist(x);};
 window.addEventListener('storage',event=>{if(event.key===APPEARANCE_KEY||event.key===null){current=readAppearance(storage);if(!dialog.open)applyAppearance(doc.documentElement,current);}});
}
if(typeof document!=='undefined'){let storage=null;try{storage=window.localStorage;}catch{}applyAppearance(document.documentElement,readAppearance(storage));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mountAppearance(),{once:true});else mountAppearance();}
