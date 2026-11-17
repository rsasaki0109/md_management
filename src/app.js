import {mergeRepositories} from './projects.js';
import {showProjects,projectPanel} from './projects-ui.js';
import {joinAdjacent,duplicateBlock} from './editor.js';
import {searchPages,highlightParts} from './search.js';
import {outlineEntries} from './outline.js';
import {setupOffline} from './offline.js';
import {resolvePage,pageUrl,pageAncestors,createPageRouter} from './navigation.js';
import {reorderItems} from './reorder.js';
import {createDragScope,dropPosition,clearDropHints} from './drag.js';
import {showTemplatePicker} from './templates-ui.js';
import {moveToTrash,restoreFromTrash,permanentlyDelete,trashCount} from './trash.js';
import {createDatabase} from './database.js';
import {renderDatabase} from './database-ui.js';
import {pageLinks,backlinks,linkQuery,insertPageLink} from './links.js';
import {History,markdownShortcut} from './history.js';
import {types,block,page,canMove,toMarkdown,fromMarkdown,validateBackup,initial} from './model.js';
const $=s=>document.querySelector(s), KEY='folia-workspace-v1';
let state,readFailed=false;
try {const saved=localStorage.getItem(KEY);state=saved?validateBackup(JSON.parse(saved)):initial();}catch{state=initial();readFailed=true;}
let active=state.pages.find(p=>p.id===state.activeId)||state.pages[0], collapsed=new Set(), menu=null,saveFailed=false,linkPicker=null;
const initialRoute=resolvePage(state.pages,window.location.hash,state.activeId);active=initialRoute.page;state.activeId=active.id;
const router=createPageRouter(window,hash=>{
 const route=resolvePage(state.pages,hash,active.id);
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close('cancel');
 open(route.page.id,{replace:true});if(route.missing)toast('リンク先が見つかりません。削除済み、またはこのブラウザにないページです。');
});
router.write(active.id,{replace:true});
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
const history=new History(state);
const outlineOpen=new Map();
function renderOutline(){const outline=$('#page-outline');if(!outline)return;const entries=outlineEntries(active.blocks);outline.hidden=!entries.length;outline.querySelector('summary').textContent='このページの目次 · '+entries.length;const list=outline.querySelector('ol');list.replaceChildren();for(const entry of entries){const item=el('li','outline-level-'+entry.level),link=button(entry.title,()=>{const target=document.getElementById('edit-'+entry.id);if(!target)return;restoreFocus({id:target.id,offset:0});target.scrollIntoView({block:'start'});},'outline-link');link.setAttribute('aria-label','見出し '+entry.level+': '+entry.title);item.append(link);list.append(item);}}
function editorFocus(){
 const target=document.activeElement;
 if(target?.matches('.task-title'))return {id:target.id,offset:target.selectionStart};
 if(!target?.matches('.block-edit, #page-title'))return null;
 const selection=window.getSelection();let offset=target.textContent.length;
 if(selection.rangeCount&&target.contains(selection.anchorNode)){
  const range=document.createRange();range.selectNodeContents(target);range.setEnd(selection.anchorNode,selection.anchorOffset);offset=range.toString().length;
 }
 return {id:target.id,offset};
}
function restoreFocus(focus){
 requestAnimationFrame(()=>{
  const target=document.getElementById(focus?.id)||$('#page-title');if(!target)return;
  target.focus();if(target.matches('input')){const offset=Math.min(focus?.offset??target.value.length,target.value.length);target.setSelectionRange(offset,offset);return;}const range=document.createRange();const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let remaining=focus?.offset??target.textContent.length,node;
  while((node=walker.nextNode())){if(remaining<=node.length){range.setStart(node,remaining);break;}remaining-=node.length;}
  if(!node){range.selectNodeContents(target);range.collapse(false);}else range.collapse(true);
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
 });
}
function updateHistoryButtons(){$('#undo').disabled=!history.canUndo;$('#redo').disabled=!history.canRedo;}
function save(group=null,record=true,focus=editorFocus()){document.title=(active.title||'無題')+' — folia';state.activeId=active.id;active.updatedAt=new Date().toISOString();if(record)history.record(state,{group,focus});updateHistoryButtons();renderOutline();try{if(readFailed) throw Error();localStorage.setItem(KEY,JSON.stringify(state));saveFailed=false;$('#save-status').textContent='✓ 保存済み';}catch{saveFailed=true;$('#save-status').textContent='未保存 — バックアップしてください';}}
function travel(direction){
 const snapshot=history.step(direction);if(!snapshot)return;
 state=snapshot.value;active=state.pages.find(p=>p.id===state.activeId)||state.pages[0];
 router.write(active.id,{replace:true});save(null,false);render();restoreFocus(snapshot.focus);toast(direction<0?'元に戻しました':'やり直しました');
}
function open(id,{replace=false}={}){const p=state.pages.find(p=>p.id===id);if(!p)return;active=p;state.activeId=id;for(const parentId of pageAncestors(state.pages,id))collapsed.delete(parentId);router.write(id,{replace});save();render();$('#sidebar').classList.remove('mobile-open');window.scrollTo(0,0);}
function create(parentId=null){closeMenu();showTemplatePicker({dialog:$('#template-dialog'),pages:state.pages,parentId,onCreate:p=>{
 if(p.parentId&&!state.pages.some(parent=>parent.id===p.parentId))throw Error('作成先のページが見つかりません');
 state.pages.push(p);let parent=state.pages.find(parent=>parent.id===p.parentId);while(parent){collapsed.delete(parent.id);parent=state.pages.find(p=>p.id===parent.parentId);}open(p.id);requestAnimationFrame(()=>{$('#page-title').focus();document.execCommand('selectAll');});
}});}
function renderTree(){const root=$('#tree');root.replaceChildren();
 const favorites=state.pages.filter(p=>p.favorite);if(favorites.length){root.append(el('div','mini-label','お気に入り'));for(const p of favorites)root.append(button(p.icon+'  '+p.title,()=>open(p.id),'favorite-link '+(p.id===active.id?'selected':'')));root.append(el('div','mini-label','すべてのページ'));}
 function branch(parent,depth=0){for(const p of state.pages.filter(p=>p.parentId===parent)){const row=el('div','tree-row '+(p.id===active.id?'selected':''));row.style.paddingLeft=(10+depth*14)+'px';const children=state.pages.some(c=>c.parentId===p.id);const arrow=button(children?(collapsed.has(p.id)?'›':'⌄'):'·',()=>{collapsed.has(p.id)?collapsed.delete(p.id):collapsed.add(p.id);renderTree();},'tree-arrow');arrow.setAttribute('aria-label',p.title+' の子ページを開閉');const link=button(p.icon+'  '+(p.title||'無題'),()=>open(p.id),'tree-link');const add=button('＋',()=>create(p.id),'tree-add');add.setAttribute('aria-label',p.title+' に子ページを追加');row.append(arrow,link,add);root.append(row);if(!collapsed.has(p.id))branch(p.id,depth+1);}}
 branch(null);
}
function render(){document.title=(active.title||'無題')+' — folia';for(const id of pageAncestors(state.pages,active.id))collapsed.delete(id);closeMenu();renderTree();$('#trash-count').textContent=trashCount(state)||'';const crumbs=[];let p=active;while(p){crumbs.unshift(p);p=state.pages.find(x=>x.id===p.parentId);}$('#breadcrumb').replaceChildren();for(const [i,p] of crumbs.entries()){if(i)$('#breadcrumb').append(el('span','crumb-separator','/'));$('#breadcrumb').append(button(p.icon+' '+(p.title||'無題'),()=>open(p.id),'crumb'));}
 $('#favorite').textContent=active.favorite?'★':'☆';$('#favorite').setAttribute('aria-pressed',String(active.favorite));
 const main=$('#main');main.replaceChildren();const cover=el('div','cover');cover.append(el('span','cover-note','A LITTLE SPACE FOR BIG IDEAS'),el('div','cover-orbit'),el('div','cover-sun'));main.append(cover);
 const content=el('article','document'+(active.database?' document-with-database':''));const icon=button(active.icon,changeIcon,'page-icon');icon.setAttribute('aria-label','ページアイコンを変更');content.append(icon);const meta=el('div','document-meta');meta.append(el('span','eyebrow','YOUR PRIVATE SPACE'),button('＋ 子ページ',()=>create(active.id),'subtle'));content.append(meta);
 const title=el('h1','page-title',active.title);title.id='page-title';title.contentEditable='true';title.dataset.placeholder='無題';title.setAttribute('aria-label','ページタイトル');title.oninput=e=>{active.title=title.textContent.replace(/\n/g,'');save('title:'+active.id,!e.isComposing);renderTree();};title.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();focusBlock(active.blocks[0].id);}};title.oncompositionend=()=>{active.title=title.textContent.replace(/\n/g,'');save('title:'+active.id);renderTree();};title.onblur=()=>{if(!active.title.trim()){active.title='無題';title.textContent=active.title;save();renderTree();}};content.append(title);
 if(active.project)content.append(projectPanel(active,(group,record)=>save(group,record)));
 const outline=el('details','page-outline');outline.id='page-outline';outline.open=outlineOpen.get(active.id)||false;const outlinePageId=active.id;outline.ontoggle=()=>outlineOpen.set(outlinePageId,outline.open);outline.append(el('summary'),el('ol'));content.append(outline);
 content.append(el('p','editor-hint','クリックして編集 · 「/」でブロック · 「[[」でページリンク'));const blocks=el('div','blocks');blocks.id='blocks';content.append(blocks);main.append(content);renderBlocks();content.append(button('＋ ブロックを追加',()=>{const b=block();active.blocks.push(b);save();renderBlocks();focusBlock(b.id);},'add-block'));
 if(active.database){const database=renderDatabase(active,{save,confirm:(title,message)=>action(title,el('p','',message),'削除')});database.addEventListener('database-removed',()=>render());content.append(database);}
 else content.append(button('▤ タスクデータベースを追加',()=>{active.database=createDatabase();save();render();},'add-database'));
 const children=state.pages.filter(p=>p.parentId===active.id);if(children.length){const sub=el('div','child-pages');sub.append(el('div','mini-label','このページの中'));for(const p of children)sub.append(button(p.icon+' '+p.title+'  ↗',()=>open(p.id),'child-link'));content.append(sub);}
 const incoming=backlinks(state.pages,active.id);
 if(incoming.length){const section=el('section','backlinks');section.setAttribute('aria-label','このページへのリンク');section.append(el('h2','mini-label','このページへのリンク · '+incoming.length));for(const {page,blocks} of incoming){const link=button('',()=>open(page.id),'backlink');link.append(el('span','',page.icon+' '+page.title),el('small','',blocks.length+' ブロックから参照'));section.append(link);}content.append(section);}
}
function focusBlock(id){requestAnimationFrame(()=>{const e=document.getElementById('edit-'+id);if(e){e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const s=window.getSelection();s.removeAllRanges();s.addRange(r);}});}
function renderBlocks(){renderOutline();const area=$('#blocks');area.replaceChildren();const drag=createDragScope('block',active.id);const endDrag=()=>{drag.end();clearDropHints(area);};for(const b of active.blocks){const row=el('div','block block-'+b.type);row.dataset.id=b.id;const handle=button('⠿',e=>blockMenu(b,e.currentTarget),'block-handle');handle.setAttribute('aria-label','ブロックの種類と順序を変更');handle.id='block-handle-'+b.id;handle.draggable=true;handle.title='ドラッグで並べ替え · Alt+↑ / ↓ でも移動';handle.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown');
 handle.ondragstart=e=>{closeMenu();if(drag.start(b.id,e))row.classList.add('drag-source');};handle.ondragend=endDrag;
 handle.onkeydown=e=>{if(!e.isComposing&&e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const i=active.blocks.indexOf(b),target=active.blocks[i+(e.key==='ArrowUp'?-1:1)];if(target&&reorderItems(active.blocks,b.id,target.id,e.key==='ArrowUp'?'before':'after')){closeMenu();save();renderBlocks();document.getElementById(handle.id)?.focus();toast('ブロックを移動しました');}}};
 row.ondragover=e=>{if(!drag.matches(e))return;e.preventDefault();e.dataTransfer.dropEffect='move';for(const node of area.querySelectorAll('.drop-before,.drop-after'))node.classList.remove('drop-before','drop-after');row.classList.add('drop-'+dropPosition(row,e));};
 row.ondragleave=e=>{if(!row.contains(e.relatedTarget))row.classList.remove('drop-before','drop-after');};
 row.ondrop=e=>{if(!drag.matches(e))return;e.preventDefault();e.stopPropagation();const id=drag.read(e),position=dropPosition(row,e);endDrag();if(id&&reorderItems(active.blocks,id,b.id,position)){save();renderBlocks();document.getElementById('block-handle-'+id)?.focus();toast('ブロックを移動しました');}};
 row.append(handle);if(b.type==='divider'){row.append(el('hr'));area.append(row);continue;}
 if(b.type==='bullet')row.append(el('span','bullet-dot','•'));if(b.type==='todo'){const input=el('input');input.type='checkbox';input.checked=b.checked;input.setAttribute('aria-label','完了');input.onchange=()=>{b.checked=input.checked;row.classList.toggle('checked',b.checked);save();};row.append(input);if(b.checked)row.classList.add('checked');}
 const edit=el('div','block-edit',b.text);edit.id='edit-'+b.id;edit.contentEditable='plaintext-only';edit.setAttribute('role','textbox');edit.setAttribute('aria-label',types[b.type]);edit.dataset.placeholder=b.type==='text'?'入力、または「/」でコマンド…':types[b.type];
 edit.onclick=()=>{if(!updateLinkPicker(b,edit)&&menu?.dataset.block===b.id)closeMenu();};
 edit.onkeyup=e=>{if(e.isComposing)return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&!updateLinkPicker(b,edit)&&menu?.dataset.block===b.id)closeMenu();};
 edit.oncompositionend=()=>{b.text=edit.textContent;save('block:'+b.id);renderBlockLinks(b,row);updateLinkPicker(b,edit);};
 edit.oninput=e=>{b.text=edit.textContent;save('block:'+b.id,!e.isComposing);renderBlockLinks(b,row);if(e.isComposing){closeMenu();return;}if(b.text==='/')blockMenu(b,edit);else if(!updateLinkPicker(b,edit)&&menu?.dataset.block===b.id)closeMenu();};
 edit.onkeydown=e=>{if(e.isComposing)return;
 if(['Backspace','Delete'].includes(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){
  const selection=window.getSelection(),focus=editorFocus();
  if(selection.isCollapsed&&edit.contains(selection.anchorNode)&&focus?.id===edit.id&&((e.key==='Backspace'&&focus.offset===0)||(e.key==='Delete'&&focus.offset===b.text.length))){
   const joined=joinAdjacent(active.blocks,b.id,e.key==='Backspace'?'backward':'forward');
   if(joined){e.preventDefault();closeMenu();save(null,true,{id:'edit-'+joined.id,offset:joined.offset});renderBlocks();restoreFocus({id:'edit-'+joined.id,offset:joined.offset});return;}
  }
 }

 if(linkPicker?.blockId===b.id){
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const length=linkPicker.items.length;if(length){linkPicker.index=(linkPicker.index+(e.key==='ArrowDown'?1:-1)+length)%length;highlightLinkChoice();}return;}
  if((e.key==='Enter'||e.key==='Tab')&&linkPicker.items.length){e.preventDefault();chooseLink(linkPicker.items[linkPicker.index]);return;}
 }

 if(e.key===' '&&b.type==='text'){
  const shortcut=markdownShortcut(edit.textContent),selection=window.getSelection();
  if(shortcut&&selection.isCollapsed&&selection.rangeCount){
   const tail=selection.getRangeAt(0).cloneRange();tail.setEnd(edit,edit.childNodes.length);
   if(!tail.toString()) {e.preventDefault();Object.assign(b,shortcut,{text:''});closeMenu();let focus=b.id;if(b.type==='divider'){const next=block();active.blocks.splice(active.blocks.indexOf(b)+1,0,next);focus=next.id;}save();renderBlocks();focusBlock(focus);return;}
  }
 }
if(e.key==='Escape'){closeMenu();return;}if(e.key==='Enter'&&!e.shiftKey&&b.type!=='code'){e.preventDefault();closeMenu();const i=active.blocks.indexOf(b);if(!b.text&&['todo','bullet'].includes(b.type)){b.type='text';save();renderBlocks();focusBlock(b.id);return;}const selection=window.getSelection();const range=selection.rangeCount?selection.getRangeAt(0):null;let tail='';if(range&&edit.contains(range.startContainer)&&edit.contains(range.endContainer)){range.deleteContents();const rest=range.cloneRange();rest.setEnd(edit,edit.childNodes.length);tail=rest.toString();rest.deleteContents();b.text=edit.textContent;}const next=block(['todo','bullet'].includes(b.type)?b.type:'text',tail);active.blocks.splice(i+1,0,next);save();renderBlocks();restoreFocus({id:'edit-'+next.id,offset:0});}if(e.key==='Backspace'&&!b.text&&active.blocks.length>1){e.preventDefault();const i=active.blocks.indexOf(b);active.blocks.splice(i,1);save();renderBlocks();focusBlock(active.blocks[Math.max(0,i-1)].id);}};
 edit.addEventListener('paste',e=>{e.preventDefault();const text=e.clipboardData.getData('text/plain');document.execCommand('insertText',false,text);});const body=el('div','block-body');body.append(edit);row.append(body);renderBlockLinks(b,row);area.append(row);}}
function renderBlockLinks(b,row){
 row.querySelector('.block-links')?.remove();if(['code','divider'].includes(b.type))return;
 const links=pageLinks(b.text,state.pages);if(!links.length)return;
 const list=el('div','block-links');
 for(const link of links){const chip=button((link.page?.icon||'↗')+' '+link.label,()=>{if(link.page)open(link.page.id);else toast(link.ambiguous?'同じ名前のページがあります。「[[」からリンク先を選び直してください。':'リンク先のページが見つかりません');},'page-link'+(link.page?'':' missing-link'));chip.title=link.page?'ページを開く':link.ambiguous?'同名ページが複数あります':'リンク先がありません';list.append(chip);}
 row.querySelector('.block-body')?.append(list);
}
function updateLinkPicker(b,edit){
 if(['code','divider'].includes(b.type))return false;
 const focus=editorFocus(),selection=window.getSelection();
 if(!focus||focus.id!==edit.id||!selection.isCollapsed)return false;
 const query=linkQuery(b.text,focus.offset);if(!query)return false;
 const items=state.pages.filter(p=>p.id!==active.id&&p.title.toLocaleLowerCase().includes(query.query.toLocaleLowerCase()));
 const m=showMenu(edit);m.dataset.block=b.id;m.classList.add('link-picker');m.style.left=Math.max(8,Math.min(edit.getBoundingClientRect().left,innerWidth-Math.min(300,innerWidth-16)-8))+'px';m.append(el('div','mini-label','ページにリンク · ↑↓ で選択 / Enter で挿入'));
 linkPicker={blockId:b.id,query,items,index:0,text:b.text};
 if(!items.length)m.append(el('p','link-empty','一致するページがありません'));
 for(const p of items){const choice=button('',()=>chooseLink(p),'link-choice');choice.append(el('span','',p.icon+' '+p.title),el('small','',p.parentId?state.pages.find(x=>x.id===p.parentId)?.title||'子ページ':'ワークスペース直下'));m.append(choice);}
 highlightLinkChoice();return true;
}
function highlightLinkChoice(){if(!menu||!linkPicker)return;menu.querySelectorAll('.link-choice').forEach((b,i)=>{b.classList.toggle('selected',i===linkPicker.index);b.setAttribute('aria-current',String(i===linkPicker.index));if(i===linkPicker.index)b.scrollIntoView({block:'nearest'});});}
function chooseLink(page){
 const picker=linkPicker,b=active.blocks.find(b=>b.id===picker?.blockId);
 if(!b||b.text!==picker.text){closeMenu();return;}
 const result=insertPageLink(b.text,picker.query,page);b.text=result.text;save();closeMenu();renderBlocks();restoreFocus({id:'edit-'+b.id,offset:result.offset});
}
function closeMenu(){menu?.remove();menu=null;linkPicker=null;}

function showMenu(anchor){closeMenu();menu=el('div','popup');menu.setAttribute('role','menu');document.body.append(menu);const r=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-270))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+5,innerHeight-370))+'px';return menu;}
function blockMenu(b,anchor){const m=showMenu(anchor);m.dataset.block=b.id;m.append(el('div','mini-label','ブロックを変換'));for(const [key,label] of Object.entries(types)){m.append(button(({text:'T',h1:'H₁',h2:'H₂',bullet:'•',todo:'☑',quote:'❝',code:'〈〉',divider:'—'}[key])+'   '+label,()=>{b.type=key;if(b.text==='/')b.text='';save();closeMenu();renderBlocks();focusBlock(b.id);}));}const actions=el('div','block-actions');for(const [label,offset] of [['↑',-1],['↓',1]]){const btn=button(label,()=>{const i=active.blocks.indexOf(b),j=i+offset;if(j>=0&&j<active.blocks.length){reorderItems(active.blocks,b.id,active.blocks[j].id,offset<0?'before':'after');save();renderBlocks();}closeMenu();});btn.setAttribute('aria-label',offset<0?'上へ移動':'下へ移動');actions.append(btn);}actions.append(button('複製',()=>{const copy=duplicateBlock(active.blocks,b.id);if(!copy)return;const focusId=copy.type==='divider'?'block-handle-'+copy.id:'edit-'+copy.id;closeMenu();save(null,true,{id:focusId,offset:copy.text.length});renderBlocks();if(copy.type==='divider')requestAnimationFrame(()=>document.getElementById(focusId)?.focus());else focusBlock(copy.id);toast('ブロックを複製しました');}));actions.append(button('削除',()=>{if(active.blocks.length===1)active.blocks=[block()];else active.blocks=active.blocks.filter(x=>x.id!==b.id);save();closeMenu();renderBlocks();},'danger'));m.append(actions);}
function changeIcon(e){const m=showMenu(e.currentTarget);const grid=el('div','icon-grid');for(const icon of ['📄','🌱','💡','📚','🗂️','📝','🎯','🚀','☕','🎨','🔖','🧭'])grid.append(button(icon,()=>{active.icon=icon;save();render();}));m.append(grid);}
async function action(title,body,label='保存'){closeMenu();$('#action-title').textContent=title;$('#action-body').replaceChildren(body);$('#action-confirm').textContent=label;const d=$('#action-dialog');d.returnValue='cancel';d.showModal();return new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});});}
$('#favorite').onclick=()=>{active.favorite=!active.favorite;save();render();};
async function copyPageLink(){
 closeMenu();const url=pageUrl(window.location.href,active.id);
 try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(url);toast('ページリンクをコピーしました');}
 catch{const body=el('div');body.append(el('p','','この URL をコピーしてください。同じブラウザと保存先のページを開くリンクです。'));const input=el('input','copy-page-url');input.readOnly=true;input.value=url;input.setAttribute('aria-label','ページ URL');body.append(input);action('ページリンク',body,'閉じる');requestAnimationFrame(()=>{input.focus();input.select();});}
}
$('#page-menu').onclick=e=>{const m=showMenu(e.currentTarget);m.append(button('ページリンクをコピー',copyPageLink));m.append(button('ページを複製',()=>{const p=structuredClone(active);p.id=crypto.randomUUID();p.title+=' のコピー';delete p.project;p.blocks=p.blocks.map(b=>({...b,id:crypto.randomUUID()}));if(p.database)p.database.rows=p.database.rows.map(r=>({...r,id:crypto.randomUUID()}));state.pages.push(p);open(p.id);}));m.append(button('ページを移動',async()=>{const select=el('select');select.setAttribute('aria-label','移動先');const option=el('option','','ワークスペース直下');option.value='';select.append(option);for(const p of state.pages.filter(p=>canMove(state.pages,active.id,p.id))){const o=el('option','',p.icon+' '+p.title);o.value=p.id;select.append(o);}select.value=active.parentId||'';if(await action('ページの移動先',select,'移動')){active.parentId=select.value||null;save();render();}}));m.append(button('ゴミ箱に移動',()=>{const entry=moveToTrash(state,active.id);open(state.activeId);toast(entry.pages.length+' ページをゴミ箱に移動しました');},'danger'));};
function renderTrash(){
 const list=$('#trash-list');list.replaceChildren();const query=$('#trash-search').value.trim().toLocaleLowerCase();
 const entries=(state.trash||[]).filter(entry=>entry.pages.some(p=>p.title.toLocaleLowerCase().includes(query)));
 $('#trash-empty').disabled=!(state.trash||[]).length;
 if(!entries.length)list.append(el('p','empty',query?'一致するページはありません':'ゴミ箱は空です'));
 for(const entry of entries){
  const root=entry.pages.find(p=>p.id===entry.rootId),row=el('div','trash-entry'),info=el('div','trash-info');info.append(el('strong','',root.icon+' '+root.title));
  const date=new Date(entry.deletedAt).toLocaleString('ja-JP');info.append(el('small','',entry.pages.length+' ページ · '+date));
  const actions=el('div','trash-actions');actions.append(button('復元',()=>{try{const restored=restoreFromTrash(state,entry.id);$('#trash-dialog').close();open(restored.id);toast('ページを復元しました');}catch(error){toast(error.message);}},'trash-restore'),button('完全削除',()=>purgeTrash(entry),'danger'));row.append(info,actions);list.append(row);
 }
}
async function purgeTrash(entry=null){
 const count=entry?entry.pages.length:trashCount(state);
 if(!await action(entry?'ページを完全削除しますか？':'ゴミ箱を空にしますか？',el('p','',count+' ページを完全に削除します。復元できなくなり、このタブの編集履歴も消去されます。'),'完全削除'))return;
 permanentlyDelete(state,entry?.id);history.reset(state);save(null,false);render();renderTrash();toast('完全に削除しました');
}
$('#trash-open').onclick=()=>{closeMenu();$('#trash-search').value='';renderTrash();$('#trash-dialog').showModal();$('#trash-search').focus();};
$('#trash-close').onclick=()=>$('#trash-dialog').close();$('#trash-search').oninput=renderTrash;$('#trash-empty').onclick=()=>purgeTrash();
$('.brand').onclick=e=>{e.preventDefault();open(state.pages.find(p=>p.parentId===null).id);};
$('#oss-open').onclick=()=>{closeMenu();showProjects({dialog:$('#oss-dialog'),getPages:()=>state.pages,onOpen:open,onTaskOpen:(pageId,taskId)=>{open(pageId);$('.database')?.dispatchEvent(new CustomEvent('focus-task',{detail:{id:taskId}}));},onSave:(p,group,record)=>{p.updatedAt=new Date().toISOString();save(group,record);render();},onImport:repos=>{
 const excluded=(state.trash||[]).flatMap(entry=>entry.pages.flatMap(p=>p.project?[p.project.repository]:[]));
 const result=mergeRepositories(state.pages,repos,snapshot=>{const p=page(snapshot.repository.split('/')[1]);p.icon='📦';p.blocks=[block('text',snapshot.description),block('text','https://github.com/'+snapshot.repository),block('h2','この OSS の目的'),block('text',''),block('h2','開発メモ・決定事項'),block('text','')];p.database=createDatabase();p.database.view='board';return p;},excluded);save();render();return result;
 }});};
$('#new-page').onclick=()=>create();$('#add-root').onclick=()=>create();$('#home').onclick=()=>open(state.pages.find(p=>p.parentId===null).id);$('#toggle-sidebar').onclick=()=>{if(innerWidth<=760)$('#sidebar').classList.toggle('mobile-open');else document.body.classList.toggle('sidebar-hidden');};
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=()=>download((active.title||'無題').replace(/[\\/:*?"<>|]/g,'_')+'.md',toMarkdown(active),'text/markdown;charset=utf-8');
$('#backup').onclick=()=>download('folia-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json');
$('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('5 MB 以下のファイルを選んでください');const p=fromMarkdown(await f.text(),f.name.replace(/\.(md|markdown)$/i,''));state.pages.push(p);open(p.id);toast('Markdown を読み込みました');}catch(err){toast(err.message);}e.target.value='';};
$('#restore').onclick=()=>$('#backup-file').click();$('#backup-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20*1024*1024)throw Error('20 MB 以下のファイルを選んでください');const data=validateBackup(JSON.parse(await f.text()));if(await action('バックアップを復元',el('p','',`${data.pages.length} ページを読み込み、現在の内容を置き換えます。`),'復元')){state=data;readFailed=false;open(data.pages.find(p=>p.id===data.activeId)?.id||data.pages[0].id,{replace:true});toast('復元しました');}}catch(err){toast('復元できませんでした: '+err.message);}e.target.value='';};
let searchMatches=[],searchIndex=0;
function highlighted(tag,text,terms){const node=el(tag);for(const part of highlightParts(text,terms))node.append(part.match?el('mark','',part.text):document.createTextNode(part.text));return node;}
function selectSearch(){const buttons=$('#search-results').querySelectorAll('.search-result');buttons.forEach((button,index)=>button.setAttribute('aria-selected',String(index===searchIndex)));const chosen=buttons[searchIndex];if(chosen){$('#search-input').setAttribute('aria-activedescendant',chosen.id);chosen.scrollIntoView({block:'nearest'});}else $('#search-input').removeAttribute('aria-activedescendant');}
function openSearchMatch(match){if(!state.pages.some(p=>p.id===match.pageId))return;$('#search-dialog').close();open(match.pageId);if(match.kind==='block'){const target=document.getElementById('edit-'+match.targetId);if(target){restoreFocus({id:target.id,offset:0});target.scrollIntoView({block:'center'});}}else if(match.kind==='task')$('.database')?.dispatchEvent(new CustomEvent('focus-task',{detail:{id:match.targetId}}));}
function search(){searchMatches=searchPages(state.pages,$('#search-input').value);searchIndex=0;const results=$('#search-results');results.replaceChildren();results.setAttribute('role','listbox');for(const [index,match] of searchMatches.entries()){const result=button('',()=>openSearchMatch(match),'search-result');result.id='search-match-'+index;result.setAttribute('role','option');result.append(highlighted('span',match.icon+' '+match.title,match.terms),highlighted('small',({title:'ページ',block:'本文',task:'タスク'}[match.kind])+' · '+match.snippet,match.terms));results.append(result);}if(!searchMatches.length)results.append(el('p','empty','一致するページがありません'));selectSearch();}
function openSearch(){$('#search-dialog').showModal();$('#search-input').setAttribute('aria-expanded','true');$('#search-input').value='';search();$('#search-input').focus();}
$('#search-input').setAttribute('role','combobox');$('#search-input').setAttribute('aria-controls','search-results');$('#search-input').setAttribute('aria-autocomplete','list');$('#search-dialog').addEventListener('close',()=>$('#search-input').setAttribute('aria-expanded','false'));
$('#search-input').onkeydown=e=>{if(e.isComposing)return;if(['ArrowDown','ArrowUp'].includes(e.key)&&searchMatches.length){e.preventDefault();searchIndex=(searchIndex+(e.key==='ArrowDown'?1:-1)+searchMatches.length)%searchMatches.length;selectSearch();}else if(e.key==='Enter'&&searchMatches.length){e.preventDefault();openSearchMatch(searchMatches[searchIndex]);}};
$('#search-open').onclick=openSearch;$('#search-input').oninput=search;$('#search-close').onclick=()=>$('#search-dialog').close();$('#undo').onclick=()=>travel(-1);$('#redo').onclick=()=>travel(1);
document.addEventListener('beforeinput',e=>{
 if(!e.target.closest('.block-edit, #page-title, .task-title')||e.isComposing)return;
 if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();travel(e.inputType==='historyUndo'?-1:1);}
});
document.addEventListener('keydown',e=>{
 if(e.isComposing)return;
 const key=e.key.toLowerCase(),command=e.metaKey||e.ctrlKey;
 if(command&&!e.altKey&&(key==='z'||(key==='y'&&!e.shiftKey))&&!e.target.closest('dialog')&&(!e.target.closest('input, textarea, select')||e.target.matches('.task-title'))){e.preventDefault();travel(key==='y'||e.shiftKey?1:-1);return;}
 if(command&&key==='k'){e.preventDefault();openSearch();}});
document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target)&&!e.target.closest('.block-handle'))closeMenu();});for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close('cancel');}});
window.addEventListener('beforeunload',e=>{if(saveFailed){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===KEY){readFailed=true;saveFailed=true;$('#save-status').textContent='別タブで変更されました。バックアップ後に再読み込み';toast('競合を防ぐため保存を停止しました。バックアップ後に再読み込みしてください。');}});
render();updateHistoryButtons();router.start();if(initialRoute.missing&&!readFailed)toast('リンク先が見つかりません。削除済み、またはこのブラウザにないページです。');if(readFailed){saveFailed=true;$('#save-status').textContent='保存データを読み込めませんでした';toast('元のデータは上書きしていません。バックアップを復元してください。');}

setupOffline({canReload:()=>!saveFailed,notify:toast});
