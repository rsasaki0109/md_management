// Headings are block identities, so duplicate labels remain distinct targets.
export function outlineEntries(blocks){return blocks.filter(b=>b.type==='h1'||b.type==='h2').map(b=>({id:b.id,level:b.type==='h1'?1:2,title:b.text.replace(/\s+/g,' ').trim()||'無題の見出し'}));}
