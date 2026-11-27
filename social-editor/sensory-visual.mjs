import preset from './visual-preset.json' with {type:'json'};

export const editorialScenes=Object.freeze({
 cottage:'白色小屋及山間木屋，遠距斜角拍攝，讓牆面或天空保留安靜文字區',
 path:'森林步道，低視角透視，濕地與樹幹形成清楚前後層次',
 garden:'安靜庭園，從邊緣取景，以石徑和植物錯落呈現生活尺度',
 fern:'蕨類單株，側向近拍，保留葉片自然結構與乾淨遠景',
 moss:'青苔與石縫，近距斜拍，呈現附著紋理和柔和的真實陰影',
 stream:'溪流，在岸邊低角度取景，水面反光克制且石材清晰',
 lake:'湖泊，從岸邊遠拍，以水面和地平線形成留白',
 wildflower:'一小片非柑橘野花及樹枝，以平視中景保留清晰背景',
 window:'白色窗框與建築光影，室內正側角，窗框結構真實',
 curtain:'棉質窗簾，近拍布面、輕微垂墜和透入的柔光',
 wood:'木質家具，拍攝木紋與桌角在自然光下的明暗層次',
 stone:'石材及建築轉角，貼近材質的斜角構圖，有可辨認空間深度',
 mineral:'未加工礦石，微距拍攝自然剖面，不增加不合理結晶',
 textile:'棉麻織物與石灰牆，俯拍清楚紋理並保留安靜空間',
 paper:'無字紙張與桌面，拍攝纖維和折線，畫面中沒有可辨識符號',
 life:'自然人物生活情境，遠景中自然入鏡，沒有刻意擺拍或特寫',
});

export function sensoryVisuals(lesson){
 const {palette,scenes}=lesson;
 if(!Array.isArray(palette)||palette.length<4||palette.length>6||new Set(palette).size!==palette.length||palette.some(color=>!/^#[0-9A-F]{6}$/.test(color)))throw Error('daily_palette_invalid');
 if(!Array.isArray(scenes)||scenes.length!==7||new Set(scenes).size!==7||scenes.some(id=>!Object.hasOwn(editorialScenes,id)))throw Error('daily_shots_invalid');
 return {preset_id:preset.sensory_editorial.id,style:preset.sensory_editorial.style,palette,materials:lesson.materials,lighting:lesson.light,
  layout_reference_design_id:preset.layout_reference_design_id,generation_mode:'individual_images',layout_status:'not_verified',
  artwork_ready:false,image_count:0,human_review:'not_started',
  shots:scenes.map((scene,i)=>({page:i+1,scene,direction:editorialScenes[scene],section:lesson.pages[i].section,
   text_clearance:'畫面上方約 35% 留低對比自然空間；四周預留約 7%，不可生成文字'}))};
}

export function sensoryVisualBrief(lesson,visual){
 return [visual.style,'色票 '+visual.palette.join(' / '),'場景與材質 '+visual.materials,'光線、色溫、飽和度與季節 '+visual.lighting,
  '七張獨立商業攝影質感圖片，4:5 PNG 1080 × 1350。不使用香水瓶、擴香瓶、香氛蠟燭、Logo、浮水印、文字或拼貼。場景與材料從拍攝設定統一。',
  ...visual.shots.map(shot=>`${shot.page}. ${shot.section}｜${shot.direction}。${shot.text_clearance}。`),
  '圖片未完成時只保留內部拍攝規格與文案，不作成品交付。正式交付前由 HANA 核對色彩、構圖、文字與瑕疵。',
 ].join('\n\n');
}
