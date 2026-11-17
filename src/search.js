import {statuses,priorities} from './database.js';
export function searchPages(pages,query){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return pages.flatMap(page=>{
  const sources=[{kind:'title',id:page.id,text:page.title,rank:0},...page.blocks.filter(b=>b.type!=='divider').map(b=>({kind:'block',id:b.id,text:b.text,rank:1})),...(page.database?.rows||[]).map(r=>({kind:'task',id:r.id,text:[r.title,statuses[r.status],priorities[r.priority],r.due].join(' '),rank:2}))];
  if(page.project)sources.push({kind:'title',id:page.id,text:[page.project.repository,page.project.description,page.project.nextAction].join(' '),rank:0});
  const haystack=sources.map(s=>s.text).join(' ').toLowerCase();if(!terms.every(t=>haystack.includes(t)))return [];
  const matching=sources.filter(s=>terms.some(t=>s.text.toLowerCase().includes(t)));const source=matching[0]||sources[0];
  const text=terms.length?source.text:(page.blocks.find(b=>b.text.trim())?.text||'まだ本文がありません');
  const positions=terms.map(t=>text.toLowerCase().indexOf(t)).filter(i=>i>=0),start=Math.max(0,(positions.length?Math.min(...positions):0)-30);
  return [{pageId:page.id,title:page.title,icon:page.icon,kind:source.kind,targetId:source.id,rank:source.rank,snippet:(start?'…':'')+text.slice(start,start+140)+(text.length>start+140?'…':''),terms}];
 }).sort((a,b)=>a.rank-b.rank);
}
export function highlightParts(text,terms){
 const lower=text.toLowerCase(),ranges=[];
 for(const term of terms){if(!term)continue;let from=0,index;while((index=lower.indexOf(term.toLowerCase(),from))>=0){ranges.push([index,index+term.length]);from=index+1;}}
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
 const parts=[];let from=0;for(const [start,end] of merged){if(start>from)parts.push({text:text.slice(from,start),match:false});parts.push({text:text.slice(start,end),match:true});from=end;}if(from<text.length)parts.push({text:text.slice(from),match:false});return parts;
}
