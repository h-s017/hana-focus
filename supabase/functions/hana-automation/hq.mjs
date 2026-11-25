import {loadSkill,skillCatalogue,hqError} from './hq-registry.mjs';
import {publicUrl} from './hq-source.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw hqError('hq_invalid_input');return value.trim();};
export function hqInput(value){
 if(!value||value.workspace!=='work')throw hqError('hq_work_only');
 const goal=clean(value.goal,1000,true),industry=clean(value.industry,100,true),region=clean(value.region,100,true),services=clean(value.services,1000,true);
 if(!Number.isInteger(value.limit)||value.limit<1||value.limit>10||!Array.isArray(value.companies)||value.companies.length>value.limit)throw hqError('hq_invalid_input');
 const companies=value.companies.map(c=>{
  const company_name=clean(c.company_name,140,true),website=publicUrl(clean(c.website,2000,true)),source_url=c.source_url?publicUrl(clean(c.source_url,2000,true)).url:null;
  if(source_url&&publicUrl(source_url).domain!==website.domain)throw hqError('hq_invalid_source');
  return {company_name,website:website.url,canonical_domain:website.domain,source_url,manual_excerpt:clean(c.manual_excerpt||'',4000),branch_key:clean(c.branch_key||'',100),branch_reason:clean(c.branch_reason||'',500)};
 });
 if(companies.some(c=>c.branch_key&&!c.branch_reason))throw hqError('hq_branch_reason_required');
 if(value.generation_mode!==undefined&&value.generation_mode!=='assisted')throw hqError('hq_invalid_input');
 return {workspace:'work',goal,context:clean(value.context||'',12000),industry,region,services,limit:value.limit,companies,...(value.generation_mode==='assisted'?{generation_mode:'assisted'}:{})};
}
const publicEvidence=e=>({url:e.url,checked_at:e.checked_at,excerpt:e.excerpt,content_hash:e.content_hash,verified:true,company_name_confirmed:true});
function opportunity(candidate,source,input,skill){
 const text=source.text.toLowerCase(),has=s=>s.trim().length>0&&text.includes(s.toLowerCase());
 // The rubric comes from the loaded versioned instruction resource. No claim
 // about actual demand, budget or willingness to cooperate is inferred.
 if(!skill.content.includes('需求適配 0–4、合作可行 0–3、證據完整 0–3'))throw hqError('hq_rubric_changed');
 const parts={need_fit:(has(input.industry)?2:0)+(has(input.region)?1:0)+(has(input.services)?1:0),cooperation:1+(source.public_business_contact?1:0)+(text.includes('合作')?1:0),evidence:3};
 const score=parts.need_fit+parts.cooperation+parts.evidence;
 const qualifies=has(input.industry)&&score>=6;
 const reasons=['公開網址已讀取，頁面包含公司名稱。',has(input.industry)?'來源包含指定產業詞「'+input.industry+'」。':'來源未證實指定產業。',has(input.region)?'來源包含指定區域詞。':'服務區域仍待人工確認。','此評分僅為規則式篩選，不代表客戶有採購需求。'];
 const draft=qualifies?'規則式提案草稿｜待 HANA 審核\n公司：'+candidate.company_name+'\n查核來源：'+source.url+'\n可核對內容：'+source.excerpt.slice(0,500)+'\n\n合作方向（假設，待訪談）：以「'+input.services+'」探索合作適用性。\n訪談：是否有相關需求？預計服務對象與時程為何？預算與決策流程尚未確認。\n下一步：HANA 核對來源與方向，再決定是否聯繫。未提供正式報價，未寄送。':null;
 return {...candidate,public_business_contact:source.public_business_contact,source_url:source.url,source_checked_at:source.checked_at,evidence_excerpt_or_summary:source.excerpt,evidence:[publicEvidence(source)],fit_reason:reasons.join(' '),fit_score:score,score_components:parts,stage:qualifies?'proposal_draft':'identified',draft,next_followup_at:null,stage_history:qualifies?['identified','qualified','proposal_draft']:['identified']};
}
function unverified(candidate,reason){return {...candidate,source_checked_at:null,evidence_excerpt_or_summary:candidate.manual_excerpt||null,evidence:candidate.manual_excerpt?[{url:candidate.source_url,excerpt:candidate.manual_excerpt,verified:false,kind:'user_supplied_unverified'}]:[],fit_reason:'來源未經工具查核：'+reason,fit_score:null,score_components:null,stage:'identified',draft:null,public_business_contact:null,next_followup_at:null};}
/** @typedef {ReturnType<typeof import('./hq-discovery.mjs').publicBusinessDiscovery>} PublicBusinessDiscovery */
/** @typedef {ReturnType<typeof import('./hq-analysis.mjs').businessAnalysis>} BusinessAnalysis */
export function businessHQ({store,sourceReader,now=()=>new Date(),discovery=/** @type {PublicBusinessDiscovery|null} */ (null),analyze=/** @type {BusinessAnalysis} */ (null),recordDiscovery=/** @type {((owner:string,count:number)=>Promise<void>)|null} */ (null)}){
 return async (owner,body)=>{
  if(body.workspace!=='work')throw hqError('hq_work_only');
  if(body.action==='hq_catalog')return {skills:skillCatalogue(),research:{mode:'public_url_read',available:sourceReader?.available===true,discovery:discovery?.available===true},generation:analyze?'optional_assisted':'rules',external_delivery:false};
  if(body.action==='hq_discover'){
   if(!discovery?.available)throw hqError('hq_discovery_not_configured');
   const {industry,region,services,limit}=body.criteria||{};
   const criteria={industry:clean(industry,100,true),region:clean(region,100,true),services:clean(services,1000,true),limit};
   if(!Number.isInteger(limit)||limit<1||limit>10)throw hqError('hq_invalid_input');
   const snapshot=await store.hqSnapshot(owner);
   const known=(snapshot.opportunities||[]).map(row=>row.canonical_domain);
   const candidates=await discovery.find(criteria,known);
   if(recordDiscovery)await recordDiscovery(owner,candidates.length);
   return {candidates:candidates.map(candidate=>({...candidate,source_check_available:sourceReader?.allows?.(candidate.source_url)===true})),external_delivery:false};
  }
  if(body.action==='hq_snapshot')return store.hqSnapshot(owner);
  if(body.action==='hq_review'){
   if(!uuid.test(body.run_id||'')||!['approved','rejected'].includes(body.decision))throw hqError('hq_invalid_input');
   return store.hqReview(owner,body.run_id,body.decision,clean(body.note||'',2000));
  }
  if(body.action==='hq_followup'){
   if(!uuid.test(body.opportunity_id||'')||!Number.isInteger(body.revision))throw hqError('hq_invalid_input');
   const value=body.next_followup_at;if(value!==null&&(!value||Number.isNaN(Date.parse(value))||Date.parse(value)<now().getTime()))throw hqError('hq_invalid_input');
   return store.hqFollowup(owner,body.opportunity_id,body.revision,value);
  }
  if(body.action==='hq_track'){
   if(!uuid.test(body.opportunity_id||'')||!Number.isInteger(body.revision)||body.manual_confirmation!==true||!['contacted','negotiating','won','lost'].includes(body.stage))throw hqError('hq_manual_record_required');
   const note=clean(body.note,2000,true);if(note.length<10)throw hqError('hq_manual_record_required');
   return store.hqTrack(owner,body.opportunity_id,body.revision,body.stage,note);
  }
  if(body.action!=='hq_run'||!uuid.test(body.request_id||''))throw hqError('hq_invalid_input');
  const skill=loadSkill(body.skill_id||'sales-marketing'),input=skill.connected?hqInput(body.input):{workspace:'work',goal:clean(body.input?.goal,1000,true),context:'',industry:'',region:'',services:'',limit:0,companies:[]};
  const assisted='generation_mode' in input&&input.generation_mode==='assisted';
  if(assisted&&!analyze)throw hqError('hq_analysis_not_configured');
  const claim=await store.hqStart(owner,body.request_id,input,{id:skill.id,version:skill.version,hash:skill.hash,source:skill.source},body.retry===true);
  if(!claim.claimed)return {status:claim.state,run_id:claim.run_id,replayed:true,external_delivery:false};
  const sources=[],trace=[{tool:'skill-resource',status:'loaded',skill_id:skill.id,version:skill.version,hash:skill.hash,source:skill.source}],candidates=[],blockers=[];
  const verified=[];
  let state='review',code=null,analysis=[],modelAttempts=0;
  const finish=async()=>{
   const output={goal:input.goal,skill_version:skill.version,skill_hash:skill.hash,sources,assumptions:['合作需求、預算、時程與決策者尚未由客戶確認。'],deliverables:candidates.map(c=>({company_name:c.company_name,canonical_domain:c.canonical_domain,stage:c.stage,draft:assisted?null:c.draft})),analysis,metrics:{requested_limit:input.limit,submitted_sources:input.companies.length,verified_sources:sources.length,candidate_count:candidates.length,paid_api_calls:modelAttempts,external_messages_sent:0},blockers,next_actions:['核對證據與缺漏','審核提案草稿','由 HANA 決定後續聯繫'],approval_required:true,mode:assisted?'assisted':'rules',research_mode:sourceReader?.available?'public_url_read':'manual_source_unverified',discovery_performed:false};
   return store.hqFinish(owner,claim.run_id,claim.attempt_token,{state,error_code:code,sources,tool_results:trace,output,opportunities:candidates});
  };
  try{
   if(!skill.connected){state='blocked';code='skill_not_connected';blockers.push(code);return await finish();}
   if(!input.companies.length){state='blocked';code='source_unavailable';blockers.push('沒有公司來源，未執行公司發現／搜尋。');return await finish();}
   const started=now().getTime();
   for(const c of input.companies){
    try{
     if(!sourceReader?.available||!c.source_url)throw hqError('hq_source_unavailable');
     if(now().getTime()-started>40000)throw hqError('hq_source_timeout');
     const source=await sourceReader.read(c);sources.push(publicEvidence(source));trace.push({tool:'public-source-read',status:'verified',url:source.url,checked_at:source.checked_at,content_hash:source.content_hash});
     const result=opportunity(c,source,input,skill);
     if(assisted){Object.assign(result,{stage:'identified',draft:null,fit_score:null,score_components:null,fit_reason:'已核對公開來源，等待企業分析。'});verified.push({candidate:result,source});}
     candidates.push(result);
    }catch(e){
     const reason=['hq_source_timeout','hq_source_not_authorized','hq_source_unavailable','hq_source_too_large','hq_source_insufficient','hq_company_unconfirmed'].includes(e.code)?e.code:'hq_source_unavailable';
     trace.push({tool:'public-source-read',status:'blocked',url:c.source_url,error_code:reason});blockers.push(c.company_name+'：'+reason);candidates.push(unverified(c,reason));
    }
   }
   if(!sources.length){state=trace.some(t=>t.error_code==='hq_source_timeout')?'failed':'blocked';code=state==='failed'?'source_timeout':'source_unavailable';}
   if(analyze&&assisted&&verified.length){
    try{
     modelAttempts++;
     analysis=await analyze({...input,verified});
     analysis.forEach((row,index)=>{
      const candidate=verified[index].candidate;
      candidate.fit_reason='AI 分析｜待人工審核。'+row.offer+' '+row.need_hypothesis;
      candidate.fit_score=row.fit_score;
      candidate.score_components={mode:'assisted'};
      if(row.fit){candidate.stage='proposal_draft';candidate.draft='AI 商務提案草稿｜待 HANA 審核\n來源：'+row.source_url+'\n證據摘錄：'+row.quote+'\n需求假設：'+row.need_hypothesis+'\n合作提案：'+row.proposal+'\n驗證問題：'+row.validation_question;}
     });
     trace.push({tool:'generated-business-analysis',status:'validated',source_count:verified.length});
    }catch{
     state='failed';code='hq_analysis_unavailable';blockers.push('生成式分析失敗。已核對的來源保留，沒有產生 AI 提案。');trace.push({tool:'generated-business-analysis',status:'failed',error_code:code});
    }
   }
   return await finish();
  }catch(e){
   // A DB timeout is an uncertain commit. Do not silently overwrite it with a
   // second finish; replaying request_id reads the committed receipt or lock.
   if(e.code?.startsWith('hq_'))throw e;
   throw hqError('hq_persistence_uncertain');
  }
 };
}
