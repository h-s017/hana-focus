import {skillResources} from './hq-skills.generated.mjs';
export const SKILLS=Object.freeze({
 'corporate-strategy':'企業策略',
 'operations-management':'營運管理',
 'sales-marketing':'業務與行銷',
 'people-management':'人才與合作',
 'research-development':'研究與開發',
 'financial-management':'財務管理',
 'business-systemization':'經營系統化'
});
export const hqError=(code)=>Object.assign(Error(code),{code});
export function loadSkill(id){
 if(!Object.hasOwn(SKILLS,id))throw hqError('hq_unknown_skill');
 const value=skillResources[id];
 if(!value?.content||!value.version||!value.hash)throw hqError('hq_skill_resource_missing');
 return {...value,connected:id==='sales-marketing',tools:id==='sales-marketing'?['public-source-read']:[]};
}
export function skillCatalogue(){return Object.keys(SKILLS).map(id=>{const s=loadSkill(id);return {id,label:SKILLS[id],version:s.version,hash:s.hash,source:s.source,status:s.connected?'available':'not_connected'};});}
