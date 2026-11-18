function githubURL(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='github.com'&&!url.username&&!url.password&&!url.port;}catch{return false;}}
export function validateTaskContext(context){
 if(!context||typeof context.action!=='string'||typeof context.reason!=='string'||typeof context.done!=='string'||typeof context.source!=='string'||!(context.url===null||githubURL(context.url))||!Array.isArray(context.evidence)||context.evidence.some(e=>!e||typeof e.label!=='string'||!githubURL(e.url)))throw Error('作業の根拠の形式が正しくありません');
 if(context.draft!==undefined){const d=context.draft;if(!d||['before','after','updated'].some(key=>typeof d[key]!=='string')||!(d.sourceUpdatedAt===null||(typeof d.sourceUpdatedAt==='string'&&!Number.isNaN(Date.parse(d.sourceUpdatedAt)))))throw Error('作業の修正案の形式が正しくありません');}
 return context;
}
export function contextFromCandidate(candidate){
 const context={action:candidate.action,reason:candidate.reason,done:candidate.done,source:candidate.source,url:candidate.url,evidence:structuredClone(candidate.evidence||[])};
 if(candidate.draft){const {before,after,updated,sourceUpdatedAt}=candidate.draft;context.draft={before,after,updated,sourceUpdatedAt};}
 return validateTaskContext(context);
}
const fence=text=>'`'.repeat(Math.max(3,...Array.from(text.matchAll(/^`+/gm),m=>m[0].length+1)));
export function taskContextMarkdown(context){
 const links=[{label:context.source,url:context.url},...context.evidence].filter(e=>e.url).map(e=>'- ['+e.label.replace(/[\[\]\\]/g,'\\$&')+']('+e.url+')');
 return ['保存した作業: '+context.action,context.reason,'完了の目安: '+context.done,...links,...(context.draft?['Issue 本文の修正案:',fence(context.draft.updated)+'\n'+context.draft.updated+'\n'+fence(context.draft.updated)]:[])].join('\n\n');
}
