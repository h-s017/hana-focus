import preset from './visual-preset.json' with {type:'json'};

// Current confirmed direction takes precedence over older default-style notes.
export function dailyVisuals(lesson){
 if(typeof lesson?.style!=='string'||!lesson.style.trim())throw Error('daily_visual_style_required');
 return {
  preset_id:preset.id,
  style:lesson.style.trim(),
  style_mode:preset.style_mode,
  layout_reference_design_id:preset.layout_reference_design_id,
  original_reference_design_id:preset.original_reference_design_id,
  typography:preset.typography,
  layout_status:'not_verified',
  artwork_ready:false,image_count:0,human_review:'not_started'
 };
}

export function dailyVisualBrief(lesson){
 const visual=dailyVisuals(lesson);
 return [
  '## 唯一視覺風格',
  '每日風格：'+visual.style+'。同日六頁維持單一風格、色彩與排版邏輯；不同日可不同，不固定紙白水彩或全黑背景。',
  '## 原核准版型',
  '排版依據：https://www.canva.com/design/'+preset.layout_reference_design_id+'/edit；原始參照：https://www.canva.com/design/'+preset.original_reference_design_id+'/edit。',
  '保留原 Canva 的可編輯字體、字級、文字位置、間距與品牌署名。新圖需配合版面保留文字空間，不以另一套自訂字體與版面代替。參考圖片不得重用。',
  '## 指定版面','Instagram 輪播 1080 × 1350 px（4:5），六頁各自獨立。參考設計目前為五頁；六頁是新稿目標，不代表已存在六頁核准模板。',
  '## 文字與圖像分層','Canva 的中文標題、內文、頁碼都必須是可編輯文字。圖像素材不得含任何 AI 生成的文字。',
  '## 禁用','不得出現人物、身體器官、人體圖示、柑橘、過量樹葉光影、反覆香水瓶、來源不明的照片或未授權使用的作品。不得讀取或重用私人照片庫。',
  '## 圖像與版型狀態','本排程只生成創作指示與文字。尚未產生圖片、尚未套入原 Canva 版型；文字與圖像檢查通過不代表視覺符合預設。',
  '## 建議構圖',...lesson.pages.map((p,i)=>String(i+1)+'. '+p.title+'：依本日單一風格安排不同構圖，保留原版型文字區。')
 ].join('\n\n');
}
