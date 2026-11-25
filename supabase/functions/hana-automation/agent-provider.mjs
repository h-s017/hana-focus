export function agentProvider({enabled,apiKey,model,fetcher=fetch}) {
 if (!enabled || !apiKey || !model) return null;
 return async (/** @type {{instructions:string,input:string,format?:object,maxOutputTokens?:number}} */ {instructions,input,format,maxOutputTokens=1800}) => {
  const response=await fetcher('https://api.openai.com/v1/responses',{
   method:'POST',
   signal:AbortSignal.timeout(60000),
   headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({model,instructions,input,store:false,max_output_tokens:maxOutputTokens,...(format?{text:{format}}:{})}),
  });
  if (!response.ok) throw Error('provider_failed');
  const data=await response.json();
  if (data.status!=='completed' || !Array.isArray(data.output)) throw Error('provider_failed');
  const result=data.output
   .filter(item=>item.type==='message'&&Array.isArray(item.content))
   .flatMap(item=>item.content)
   .filter(part=>part.type==='output_text'&&typeof part.text==='string')
   .map(part=>part.text)
   .join('\n').trim();
  if (!result || result.length>49000) throw Error('provider_failed');
  return result;
 };
}
