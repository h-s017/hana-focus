import {editorialScenes} from './sensory-visual.mjs';

export const contentEpoch='2026-11-26';
export const editorialKinds=['sensory','service_marketing','founder_story'];
const dayNumber=date=>Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(contentEpoch+'T00:00:00Z'))/86400000);
export const scheduledKinds=date=>dayNumber(date)<0?[]:editorialKinds.filter(kind=>kind!=='service_marketing'||dayNumber(date)%3===0);

const scores={
 thresholds:['J. S. Bach','Cello Suite No. 1 in G major, BWV 1007: Prélude','聽連續音型如何跨過不同和聲，對照動線的轉折。'],
 dilution:['Frédéric Chopin','Prelude in E minor, Op. 28 No. 4','留意和聲小幅變動時，旋律的辨識感如何維持。'],
 'color-language':['Claude Debussy','Préludes, Book I: La fille aux cheveux de lin','先記音色，再試兩種色彩描述，對照色詞與聆聽感受。'],
 'scent-cues':['Robert Schumann','Kinderszenen, Op. 15: Träumerei','第一次聽完記一個具體片段，再辨識回想時增加的聯想。'],
 'material-carrier':['Claude Debussy','Estampes: Pagodes','分辨音型與承載它的聲音質地。'],
 'home-light':['Erik Satie','Gymnopédie No. 1','用和聲與停頓練習觀察安靜情境中的變化。'],
 'sound-timing':['Maurice Ravel','Pavane pour une infante défunte','比對樂句的開始、延長與留白。'],
 'brand-identity':['Ludwig van Beethoven','Piano Sonata No. 27 in E minor, Op. 90','兩個樂章的表情不同，試著描述它們各自如何維持清晰的方向。'],
};
export function sensoryMetadata(lesson){
 const [composer,work,reason]=scores[lesson.id]||['J. S. Bach','Well-Tempered Clavier, Book I: Prelude in C major, BWV 846','聽同一聲部的變化，並記錄一項能反覆核對的觀察。'];
 return {objective:lesson.pages[0].body,hashtags:['#HanaScentArtist','#HANA感官誌','#嗅覺藝術','#氣味設計'],
  alt_text_plan:lesson.scenes.map((scene,i)=>({page:i+1,description:editorialScenes[scene],status:'planned'})),
  music:{composer,work,reason,recording_rights:'未取得特定錄音授權'}};
}

const services=[
 {id:'small_batch',label:'B2B 小量香氛製作',url:'https://hanascent.com/product-development/',audience:'準備開發品牌小量香氛的創辦人與產品企劃',tag:'#香氛產品開發',
  titles:['第一次做小量香氛，先定義產品會在哪裡被使用','從樣品到上市前，品牌要記錄哪些氣味決策？'],
  paragraphs:[['先釐清用途、使用時機、留香期待及想驗證的品牌印象。好聞可以是起點，產品簡報則需要把理想情境描述到能試用的程度。','樣品回饋分成喜好、品牌辨識度及使用條件三欄。同一批受試者以一致方式記錄差異，選定方向後再討論包裝與製作條件。'],['保留採用與未採用的方向，寫下每次修改原因。後續涉及容量、包材或用途時，可以回頭判斷是要調整包裝，或重新驗證香氣。','將配方樣品、包裝樣與正式生產條件分開確認。詢問小量製作前，可先提供核心市場、使用場景與初步交付需求。']],
  scene:'無字樣品紙、木質工作桌和單側自然窗光',cta:'查看品牌與產品開發服務，整理你的用途與樣品驗收條件。'},
 {id:'team',label:'企業團體調香課程',url:'https://hanascent.com/enterprise-fragrance-workshop/',audience:'規劃團隊交流或品牌 VIP 活動的企劃',tag:'#企業團課',
  titles:['讓團隊在同一堂調香課說出不同答案','品牌 VIP 氣味體驗如何與活動主題連起來？'],
  paragraphs:[['從活動目的出發。想促進跨部門交流，可以讓不同組使用同一組香氣線索，各自提出一個選材理由，再互相試聞與分享。','安排可以自行參與的方式，也保留觀察或記錄角色。用活動結束時每組能說出的選材理由，檢查這場體驗是否促進交流。'],['先選一個主題詞及一個能讓人做出選擇的橋段，例如在不同材質線索中找到最接近自己對品牌的印象。','在活動前核對場地及參與者條件，並以人流、時間與作品分享方式整理需求。場地、費用和可提供內容由雙方另行確認。']],
  scene:'光影清楚的共作長桌、無字紙卡與自然生活工作情境',cta:'查看企業活動與感官體驗服務，提供參與對象、活動目的與場地。'},
 {id:'kpia',label:'KPIA 專業調香課程',url:'https://hanascent.com/courses/',audience:'想建立系統調香知識的學習者',tag:'#KPIA',
  titles:['開始 KPIA 進修前，先把感官紀錄變成學習工具','想進入專業調香，如何判斷接下來該學什麼？'],
  paragraphs:[['先建立一個能重做的觀察方法。選同樣的試香條件，在不同時間記下強度、材質聯想和最容易辨識的氣味線索。','回讀時整理不確定的地方，將「想系統學習」轉成你的三個具體問題。用這些問題比較課程架構與自己的目標。'],['把學習需求拆成辨識、描述和組織：是材料之間難分辨、詞彙無法解釋，還是不確定如何讓素材成為完整作品？','已經會跟著做體驗課的人，可以先列出每次試作的問題和修正方法，再到專業調香課程頁核對哪一階段適合自己。']],
  scene:'安靜光線下的調香工作台及無字觀察筆記',cta:'查看 HANA 調香課程中的 KPIA 專業進修資訊。'},
 {id:'overture',label:'氣味藝術序曲',url:'https://hanascent.com/overture/',audience:'對氣味設計有興趣、想建立創作基礎的初學者',tag:'#氣味藝術序曲',
  titles:['氣味創作從描述開始：練習讀懂香氣結構','把一段氣味想像畫成三個創作節點'],
  paragraphs:[['試著先不說「好聞」，改記它像什麼材質、發生在什麼時間、哪一項線索留下最久。這些觀察能成為你開始構思作品的資料。','氣味藝術序曲以嗅覺與香氣結構切入。可先為熟悉的場所寫下三個感官詞，再思考哪一個能成為你想驗證的創作方向。'],['先標出開場、停留與結尾，為各點安排一個可觀察線索。若某一段只需留白，也把它寫進你的草圖。','回看構想時，分開處理真實感官觀察與藝術敘事。想進一步了解如何把氣味線索組織成作品，可從氣味藝術序曲入門介紹開始。']],
  scene:'半開窗邊的白色紙樣、天然石材與棉麻',cta:'查看氣味藝術序曲的課程內容與當前報名資訊。'},
];
export function marketingForDate(date,history=[]){
 const day=dayNumber(date);
 if(day<0||day%3)return null;
 const service=services[(day/3)%services.length],original=history.filter(entry=>entry.category===service.id).length;
 if(original>=service.titles.length)return null;
 const title=service.titles[original],body=service.paragraphs[original].join('\n\n');
 return {topic_id:service.id+'-'+original,category:service.id,title,audience:service.audience,objective:'讓合適的讀者了解服務及準備下一步',body,seo_title:title+'｜HANA SCENT ARTIST',seo_description:service.paragraphs[original][0],
  instagram_caption:title+'\n'+service.paragraphs[original][0]+'\n'+service.cta,facebook_caption:title+'\n'+body+'\n'+service.cta,
  cta:service.cta,service_url:service.url,hashtags:['#HanaScentArtist',service.tag],visual_brief:service.scene,alt_text_plan:[{page:1,description:service.scene,status:'planned'}]};
}

const notes=[
 ['focus-block','時間管理','一人公司容易用回覆訊息填滿早晨。先留一段時間給最能推進客戶價值的決定，再回到收件匣。','晨光從工作室窗框落在灰白牆面，桌角只有一本閉合的筆記本','窗景'],
 ['scope-proof','客戶價值','接案前先寫下雙方如何知道工作做完了。交付標準越具體，創意階段越有空間專心試作。','兩張不同大小的無字紙樣及清楚的桌面影子','桌面'],
 ['ask-first','銷售能力','如果每一次提案都要先解釋你能做多少事，先試著問對方最想解開哪個決策。明確的問題會縮短合作的起點。','安靜咖啡館入口，焦點在木門和門縫的室內光','咖啡館'],
 ['capacity','資源配置','答應一個新案之前，先找出它會擠掉哪一件事。能說出代價，才知道這份工作是否值得接。','自然人物從空曠樓梯轉角走遠的背影','建築'],
 ['micro-budget','財務紀律','先為失誤留一點預算，再談擴張。小公司最難補回的，往往是一段被好幾項承諾同時借走的時間。','雨後巷道的石材與克制的水面反光','雨街'],
 ['feedback','失敗與調整','收到模糊的退回時，別急著加更多東西。請對方指出哪一步沒看懂，下一版只改那個地方。','設計工作室側拍，焦點在不同材質的無字樣本','工作室'],
 ['reusable','一人公司的成長','忙過一次之後，留下一份下一次能直接使用的步驟。公司慢慢變大，有時只是同樣的工作少重做幾次。','有序疊放的空白紙檔與自然光下的書架','文件'],
 ['brand-choice','品牌經營','確定品牌語氣之前，先寫下三件你不提供的服務。客戶知道界線，才能更快判斷該不該來找你。','灰白建築立面與一條乾淨、無字的門框線','建築立面'],
 ['recheck','經營決策','把暫時不能回答的問題設一個回看日期。到時只核對新增證據，避免把一次猜測變成長期決策。','行旅途中從座位望向遠山與一段光線明亮的路','旅途'],
 ['market-proof','專業與市場','專業可以從作品裡看見，市場需要更具體的使用理由。找三個正在解決同一問題的人，先問他們現在怎麼做。','清晨街道與正在拉開店門的遠景自然人物','街道'],
 ['quiet-plan','自我管理','排一個下午嘗試三種新方法之前，先寫下其中哪一個做完就夠。創作時間需要開始，也需要可以停下的地方。','岩石步道通往山林轉角，視線留有呼吸感','山林'],
 ['slow-repeat','長期主義','每週記一項可重做的小改進。回看一季時，你會知道成長來自哪個方法反覆有效，而不只記得最忙的那幾天。','自然窗光照過有細微層次的書籍側邊','書架'],
 ['price-time','創作者的商業思維','算一件作品的成本時，把往返確認與修訂也寫進去。有些報價落差，來自忽略了不會留在成品上的時間。','可以看見日影移動的清水混凝土室內','光影'],
 ['decision-first','創業心態','先挑一個能在這週驗證的小決定。當回饋改變你的想法，留下舊理由，讓自己看見是什麼促成修正。','有人在明亮而安靜的公共工作桌側身工作','人物'],
];
export function founderForDate(date,history=[]){
 if(dayNumber(date)<0)return null;
 const used=new Set(history.map(entry=>entry.topic_id)),recentScene=history[0]?.scene;
 const note=notes.find(entry=>!used.has(entry[0])&&entry[4]!==recentScene);
 if(!note)return null;
 const [topic_id,category,body,visual_brief,scene]=note;
 return {topic_id,category,title:category,body,scene,visual_brief,alt_text_plan:[{page:1,description:visual_brief,status:'planned'}],canvas:{width:1080,height:1920,pages:1},brand:'HANA Founder Notes｜創業者筆記'};
}
