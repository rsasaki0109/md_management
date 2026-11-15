// ID-based links survive renames. Manually typed [[title]] links resolve only
// when that title is unique. All values are text; never render them as HTML.
export function pageToken(page) {
  const label=page.title.replace(/[\[\]|\r\n]/g,' ').trim()||'無題';
  return `[[${page.id}|${label}]]`;
}
export function pageLinks(text,pages) {
  return [...text.matchAll(/\[\[([^\[\]\r\n]+)\]\]/g)].map(match=>{
    const [target,...labels]=match[1].split('|');
    const candidates=pages.filter(p=>p.title===target.trim());
    const page=pages.find(p=>p.id===target.trim()) || (labels.length===0&&candidates.length===1?candidates[0]:null);
    return {start:match.index,end:match.index+match[0].length,page:page||null,label:page?.title||labels.join('|')||target,ambiguous:!page&&labels.length===0&&candidates.length>1};
  });
}
export function backlinks(pages,targetId) {
  return pages.filter(p=>p.id!==targetId).flatMap(page=>{
    const blocks=page.blocks.filter(b=>!['code','divider'].includes(b.type)&&pageLinks(b.text,pages).some(link=>link.page?.id===targetId));
    return blocks.length?[{page,blocks}]:[];
  });
}
export function linkQuery(text,offset) {
  if(!Number.isInteger(offset)||offset<0||offset>text.length)return null;
  const before=text.slice(0,offset),start=before.lastIndexOf('[[');
  if(start<0)return null;
  const query=before.slice(start+2);
  if(/[\[\]\r\n|]/.test(query))return null;
  return {start,end:offset,query};
}
export function insertPageLink(text,query,page) {
  const token=pageToken(page);
  const end=query.end+(text.slice(query.end,query.end+2)===']]'?2:0);
  return {text:text.slice(0,query.start)+token+text.slice(end),offset:query.start+token.length};
}
