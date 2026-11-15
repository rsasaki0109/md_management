import {validateDatabase,databaseMarkdown,parseDatabaseTable} from './database.js';
export const types = {text:'テキスト',h1:'見出し 1',h2:'見出し 2',bullet:'箇条書き',todo:'チェックリスト',quote:'引用',code:'コード',divider:'区切り線'};
export const uid = () => crypto.randomUUID();
export const block = (type='text',text='',checked=false) => ({id:uid(),type,text,checked});
export function page(title='無題',parentId=null) {return {id:uid(),title,icon:'📄',parentId,favorite:false,updatedAt:new Date().toISOString(),blocks:[block()]};}
export function descendants(pages,id) {const ids=new Set([id]); let size; do {size=ids.size; for(const p of pages) if(ids.has(p.parentId)) ids.add(p.id);} while(size!==ids.size); return ids;}
export function canMove(pages,id,parentId) {return parentId===null || (pages.some(p=>p.id===parentId) && !descendants(pages,id).has(parentId));}
function fencedCode(text){const lengths=[...(text.matchAll(/^`+/gm))].map(m=>m[0].length);const fence='`'.repeat(Math.max(3,...lengths.map(n=>n+1)));return fence+'\n'+text+'\n'+fence;}
export function toMarkdown(p) {return '# '+p.title+'\n\n'+p.blocks.map(b=>({h1:'# ',h2:'## ',bullet:'- ',todo:b.checked?'- [x] ':'- [ ] ',quote:'> '}[b.type]??'')+(b.type==='divider'?'---':b.type==='code'?fencedCode(b.text):b.text)).join('\n\n')+(p.database?'\n\n'+databaseMarkdown(p.database):'')+'\n';}
export function fromMarkdown(source,title='インポートしたページ') {
  const p=page(title); p.blocks=[]; let code=null;
  const lines=source.replace(/\r\n?/g,'\n').split('\n');
  for(let i=0;i<lines.length;i++) {
    const line=lines[i];
    if(code!==null){const closing=line.match(/^(`{3,})\s*$/);if(closing&&closing[1].length>=code.fence){p.blocks.push(block('code',code.lines.join('\n')));code=null;}else code.lines.push(line);continue;}
    const opening=line.match(/^(`{3,})([^`]*)$/);if(opening){code={fence:opening[1].length,lines:[]};continue;}
    const table=!p.database?parseDatabaseTable(lines,i):null;
    if(table){p.database=table.database;i=table.end-1;continue;}
    if(!line.trim()) continue;
    if(!p.blocks.length && line.startsWith('# ') && p.title===title) {p.title=line.slice(2);p.blocks.push(block('text',''));continue;}
    let m; if((m=line.match(/^- \[([ xX])\] (.*)$/))) p.blocks.push(block('todo',m[2],m[1].toLowerCase()==='x'));
    else if((m=line.match(/^(#{1,2}) (.*)$/))) p.blocks.push(block(m[1].length===1?'h1':'h2',m[2]));
    else if((m=line.match(/^[-*] (.*)$/))) p.blocks.push(block('bullet',m[1]));
    else if(line==='---') p.blocks.push(block('divider'));
    else if(line.startsWith('> ')) p.blocks.push(block('quote',line.slice(2)));
    else p.blocks.push(block('text',line));
  }
  if(code!==null) p.blocks.push(block('code',code.lines.join('\n')));
  if(p.blocks[0]?.text==='' && p.blocks.length>1) p.blocks.shift();
  if(!p.blocks.length) p.blocks=[block()]; return p;
}
export function validateBackup(data) {
  if(!data || data.version!==1 || !Array.isArray(data.pages) || !data.pages.length) throw Error('バックアップの形式が正しくありません');
  const ids=new Set(); const blockIds=new Set();
  for(const p of data.pages) {
    if(typeof p.id!=='string'||ids.has(p.id)||typeof p.title!=='string'||typeof p.icon!=='string'||typeof p.favorite!=='boolean'||!Array.isArray(p.blocks)||!p.blocks.length) throw Error('ページの形式が正しくありません');
    ids.add(p.id);
    if(p.database!==undefined)validateDatabase(p.database);
    for(const b of p.blocks) {if(typeof b.id!=='string'||blockIds.has(b.id)||!Object.hasOwn(types,b.type)||typeof b.text!=='string'||typeof b.checked!=='boolean') throw Error('ブロックの形式が正しくありません');blockIds.add(b.id);}
  }
  for(const p of data.pages) {if(p.parentId!==null && !ids.has(p.parentId)) throw Error('親ページが見つかりません'); let parent=p; const seen=new Set(); while(parent) {if(seen.has(parent.id)) throw Error('ページ階層が循環しています');seen.add(parent.id);parent=data.pages.find(x=>x.id===parent.parentId);}}
  if(data.trash!==undefined){
    if(!Array.isArray(data.trash))throw Error('ゴミ箱の形式が正しくありません');
    const entryIds=new Set();
    for(const entry of data.trash){
      if(!entry||typeof entry.id!=='string'||!entry.id||entryIds.has(entry.id)||typeof entry.rootId!=='string'||!(entry.originalParentId===null||typeof entry.originalParentId==='string')||typeof entry.deletedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(entry.deletedAt)||Number.isNaN(Date.parse(entry.deletedAt))||new Date(entry.deletedAt).toISOString()!==entry.deletedAt)throw Error('ゴミ箱の項目が正しくありません');
      entryIds.add(entry.id);validateBackup({version:1,pages:entry.pages});
      const root=entry.pages.find(p=>p.id===entry.rootId);
      if(!root||root.parentId!==null||descendants(entry.pages,root.id).size!==entry.pages.length)throw Error('ゴミ箱の階層が正しくありません');
      for(const p of entry.pages){
        if(ids.has(p.id))throw Error('ページ ID が重複しています');ids.add(p.id);
        for(const b of p.blocks){if(blockIds.has(b.id))throw Error('ブロック ID が重複しています');blockIds.add(b.id);}
      }
    }
  }
  return data;
}
export function initial() {
  const welcome=page('はじめに'); welcome.icon='🌱';welcome.favorite=true;
  welcome.blocks=[block('text','ようこそ、あなたのワークスペースへ。'),block('quote','思いついたことを、思いついたままに。ここは、考えを少しずつ育てる場所です。'),block('h2','まずは、ひとつ書いてみよう'),block('text','この文章をクリックすると、そのまま編集できます。新しい行で「/」を入力すると、ブロックの種類を選べます。'),block('todo','最初のページをつくる',true),block('todo','今日のアイデアを書き留める'),block('todo','Markdown として書き出してみる'),block('h2','あなたらしい使い方で'),block('bullet','仕事のメモや、プロジェクトの計画に'),block('bullet','日々の気づきや、読みたい本のリストに'),block('bullet','ページの中にページをつくって、すっきり整理'),block('divider'),block('text','小さくはじめて、少しずつ。すべての変更は、このブラウザに自動で保存されます。')];
  const ideas=page('アイデアノート'); ideas.icon='💡';ideas.blocks=[block('h2','次につくりたいもの'),block('text','まだ形になっていないアイデアも、ここから。'),block('bullet','気になったこと、試してみたいことを集める')];
  const project=page('プロジェクト');project.icon='🗂️';project.blocks=[block('h2','小さな一歩を積み重ねる'),block('todo','ゴールを決める'),block('todo','やることを書き出す')];
  const child=page('読書メモ',ideas.id);child.icon='📚'; child.blocks=[block('text','心に残った言葉を集めていきましょう。')];
  return {version:1,pages:[welcome,ideas,child,project],activeId:welcome.id};
}
