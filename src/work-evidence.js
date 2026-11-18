import {validRepository} from './projects.js';

// Recognize explicit validation progress and its linked, same-repository JSON ledger.
export function progressReference(repository,item){
 if(!validRepository(repository)||item.pull_request||typeof item.body!=='string')return null;
 const count=item.body.match(/(?:accepted progress|受理済み(?:の)?進捗)\s*[:：]\s*\*{0,2}(\d+)\s*\/\s*(\d+)/i);if(!count)return null;
 const current=Number(count[1]),required=Number(count[2]);if(!Number.isSafeInteger(current)||!Number.isSafeInteger(required)||required<1||current>required)return null;
 for(const match of item.body.matchAll(/https:\/\/github\.com\/[^\s)<>]+/g)){
  const url=new URL(match[0]),parts=url.pathname.split('/').slice(1);
  if(parts.slice(0,2).join('/').toLowerCase()!==repository.toLowerCase()||parts[2]!=='blob'||parts.length<5||!parts.at(-1).endsWith('.json'))continue;
  const ref=parts[3],path=parts.slice(4).join('/');if(parts.some(p=>!p||p==='.'||p==='..'||/%2f|%5c|%2e/i.test(p)))continue;
  return {current,required,progress:count[0],start:count.index,url:url.origin+url.pathname,api:'https://api.github.com/repos/'+repository+'/contents/'+path+'?ref='+ref};
 }
 return null;
}
function acceptedProgress(repository,ledger){
 if(!Number.isSafeInteger(ledger?.required_validations)||ledger.required_validations<1||!Array.isArray(ledger.validations))throw Error('台帳の形式を確認できません');
 const ids=new Set(),reports=[];
 for(const row of ledger.validations){
  if(typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.acceptance?.status!=='string')throw Error('台帳の記録を確認できません');ids.add(row.id);
  if(row.acceptance.status!=='accepted')continue;
  const prefix='https://github.com/'+repository+'/issues/';
  if(row.independent_attestation!==true||row.result!=='passed'||typeof row.issue_url!=='string'||!row.issue_url.startsWith(prefix)||!/^\d+$/.test(row.issue_url.slice(prefix.length)))throw Error('受理済み報告を確認できません');
  if(reports.includes(row.issue_url))throw Error('報告が重複しています');reports.push(row.issue_url);
 }
 if(reports.length>ledger.required_validations)throw Error('必要件数を超えています');
 return {current:reports.length,required:ledger.required_validations,reports};
}
function progressDraft(item,reference,actual){
 const before=reference.progress,after=before.replace(/(\d+)(\s*\/\s*)(\d+)$/,(match,current,separator)=>actual.current+separator+actual.required);
 const updated=item.body.slice(0,reference.start)+after+item.body.slice(reference.start+before.length);
 const remaining=actual.required-actual.current,english=/accepted progress/i.test(before);
 const lines=english?['### Validation progress evidence','Accepted independent validations: **'+actual.current+' / '+actual.required+'**.',remaining?'Independent validations still needed: **'+remaining+'**.':'The required independent validations are complete.','- [Validation ledger]('+reference.url+')',...actual.reports.map(url=>'- [Accepted report #'+url.split('/').at(-1)+']('+url+')')]:['### 検証進捗の根拠','独立検証の受理済み件数: **'+actual.current+' / '+actual.required+'**。',remaining?'残り **'+remaining+'件** の独立検証を募集しています。':'必要な独立検証が揃いました。','- [検証台帳]('+reference.url+')',...actual.reports.map(url=>'- [受理済み報告 #'+url.split('/').at(-1)+']('+url+')')];
 const section='<!-- folia:validation-progress -->\n'+lines.join('\n')+'\n<!-- /folia:validation-progress -->';
 const block=/<!-- folia:validation-progress -->[\s\S]*?<!-- \/folia:validation-progress -->/;
 return {original:item.body,updated:block.test(updated)?updated.replace(block,()=>section):updated+'\n\n'+section+'\n',before,after,sourceUpdatedAt:item.updated_at||null};
}
export async function inspectWorkEvidence(repository,items,{fetcher=fetch,signal}={}){
 const results=new Map(),warnings=[],cache=new Map();let checked=0;
 for(const item of items){
  const reference=progressReference(repository,item);if(!reference)continue;if(checked===3)break;checked++;
  try{
   if(!cache.has(reference.api))cache.set(reference.api,(async()=>{const response=await fetcher(reference.api,{signal,headers:{Accept:'application/vnd.github.raw+json'}});if(!response.ok)throw Error('取得失敗');return acceptedProgress(repository,await response.json());})());
   const actual=await cache.get(reference.api);
   if(reference.current!==actual.current||reference.required!==actual.required){const before=reference.current+'/'+reference.required,after=actual.current+'/'+actual.required;
    results.set(item.number,{action:'Issue #'+item.number+' の検証進捗を '+before+' → '+after+' に更新し、根拠リンクと'+(actual.current===actual.required?'募集完了を明記する':'残り'+(actual.required-actual.current)+'件の募集を追記する'),reason:'Issue 本文は '+before+'、リンク先の検証台帳は受理済み '+after+' で一致していません',done:'Issue 本文と台帳の件数が一致し、台帳・受理済み報告へのリンクがある',draft:progressDraft(item,reference,actual),source:'Issue #'+item.number,url:'https://github.com/'+repository+'/issues/'+item.number,evidence:[{label:'検証台帳（受理済み '+after+'）',url:reference.url},...actual.reports.map(url=>({label:'受理済み報告 #'+url.split('/').at(-1),url}))]});
   }
  }catch(error){if(signal?.aborted)throw error;warnings.push('Issue #'+item.number+' の台帳を取得・照合できませんでした');}
 }
 return {items:items.map(item=>({...item,progressEvidence:results.get(item.number)})),warnings,checked};
}
