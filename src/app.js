import {History,markdownShortcut} from './history.js';
import {types,block,page,descendants,canMove,toMarkdown,fromMarkdown,validateBackup,initial} from './model.js';
const $=s=>document.querySelector(s), KEY='folia-workspace-v1';
let state,readFailed=false;
try {const saved=localStorage.getItem(KEY);state=saved?validateBackup(JSON.parse(saved)):initial();}catch{state=initial();readFailed=true;}
let active=state.pages.find(p=>p.id===state.activeId)||state.pages[0], collapsed=new Set(), menu=null,saveFailed=false;
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
const history=new History(state);
function editorFocus(){
 const target=document.activeElement;
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
  target.focus();const range=document.createRange();const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let remaining=focus?.offset??target.textContent.length,node;
  while((node=walker.nextNode())){if(remaining<=node.length){range.setStart(node,remaining);break;}remaining-=node.length;}
  if(!node){range.selectNodeContents(target);range.collapse(false);}else range.collapse(true);
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
 });
}
function updateHistoryButtons(){$('#undo').disabled=!history.canUndo;$('#redo').disabled=!history.canRedo;}
function save(group=null,record=true){state.activeId=active.id;active.updatedAt=new Date().toISOString();if(record)history.record(state,{group,focus:editorFocus()});updateHistoryButtons();try{if(readFailed) throw Error();localStorage.setItem(KEY,JSON.stringify(state));saveFailed=false;$('#save-status').textContent='✓ 保存済み';}catch{saveFailed=true;$('#save-status').textContent='未保存 — バックアップしてください';}}
function travel(direction){
 const snapshot=history.step(direction);if(!snapshot)return;
 state=snapshot.value;active=state.pages.find(p=>p.id===state.activeId)||state.pages[0];
 save(null,false);render();restoreFocus(snapshot.focus);toast(direction<0?'元に戻しました':'やり直しました');
}
function open(id){const p=state.pages.find(p=>p.id===id);if(!p)return;active=p;state.activeId=id;save();render();$('#sidebar').classList.remove('mobile-open');}
function create(parentId=null){const p=page('無題',parentId);state.pages.push(p);if(parentId)collapsed.delete(parentId);open(p.id);$('#page-title').focus();document.execCommand('selectAll');}
function renderTree(){const root=$('#tree');root.replaceChildren();
 const favorites=state.pages.filter(p=>p.favorite);if(favorites.length){root.append(el('div','mini-label','お気に入り'));for(const p of favorites)root.append(button(p.icon+'  '+p.title,()=>open(p.id),'favorite-link '+(p.id===active.id?'selected':'')));root.append(el('div','mini-label','すべてのページ'));}
 function branch(parent,depth=0){for(const p of state.pages.filter(p=>p.parentId===parent)){const row=el('div','tree-row '+(p.id===active.id?'selected':''));row.style.paddingLeft=(10+depth*14)+'px';const children=state.pages.some(c=>c.parentId===p.id);const arrow=button(children?(collapsed.has(p.id)?'›':'⌄'):'·',()=>{collapsed.has(p.id)?collapsed.delete(p.id):collapsed.add(p.id);renderTree();},'tree-arrow');arrow.setAttribute('aria-label',p.title+' の子ページを開閉');const link=button(p.icon+'  '+(p.title||'無題'),()=>open(p.id),'tree-link');const add=button('＋',()=>create(p.id),'tree-add');add.setAttribute('aria-label',p.title+' に子ページを追加');row.append(arrow,link,add);root.append(row);if(!collapsed.has(p.id))branch(p.id,depth+1);}}
 branch(null);
}
function render(){closeMenu();renderTree();const crumbs=[];let p=active;while(p){crumbs.unshift(p);p=state.pages.find(x=>x.id===p.parentId);}$('#breadcrumb').replaceChildren();for(const [i,p] of crumbs.entries()){if(i)$('#breadcrumb').append(el('span','crumb-separator','/'));$('#breadcrumb').append(button(p.icon+' '+(p.title||'無題'),()=>open(p.id),'crumb'));}
 $('#favorite').textContent=active.favorite?'★':'☆';$('#favorite').setAttribute('aria-pressed',String(active.favorite));
 const main=$('#main');main.replaceChildren();const cover=el('div','cover');cover.append(el('span','cover-note','A LITTLE SPACE FOR BIG IDEAS'),el('div','cover-orbit'),el('div','cover-sun'));main.append(cover);
 const content=el('article','document');const icon=button(active.icon,changeIcon,'page-icon');icon.setAttribute('aria-label','ページアイコンを変更');content.append(icon);const meta=el('div','document-meta');meta.append(el('span','eyebrow','YOUR PRIVATE SPACE'),button('＋ 子ページ',()=>create(active.id),'subtle'));content.append(meta);
 const title=el('h1','page-title',active.title);title.id='page-title';title.contentEditable='true';title.dataset.placeholder='無題';title.setAttribute('aria-label','ページタイトル');title.oninput=e=>{active.title=title.textContent.replace(/\n/g,'');save('title:'+active.id,!e.isComposing);renderTree();};title.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();focusBlock(active.blocks[0].id);}};title.oncompositionend=()=>{active.title=title.textContent.replace(/\n/g,'');save('title:'+active.id);renderTree();};title.onblur=()=>{if(!active.title.trim()){active.title='無題';title.textContent=active.title;save();renderTree();}};content.append(title);
 content.append(el('p','editor-hint','クリックして編集 · 「/」でブロックを追加'));const blocks=el('div','blocks');blocks.id='blocks';content.append(blocks);main.append(content);renderBlocks();content.append(button('＋ ブロックを追加',()=>{const b=block();active.blocks.push(b);save();renderBlocks();focusBlock(b.id);},'add-block'));
 const children=state.pages.filter(p=>p.parentId===active.id);if(children.length){const sub=el('div','child-pages');sub.append(el('div','mini-label','このページの中'));for(const p of children)sub.append(button(p.icon+' '+p.title+'  ↗',()=>open(p.id),'child-link'));content.append(sub);}
}
function focusBlock(id){requestAnimationFrame(()=>{const e=document.getElementById('edit-'+id);if(e){e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const s=window.getSelection();s.removeAllRanges();s.addRange(r);}});}
function renderBlocks(){const area=$('#blocks');area.replaceChildren();for(const b of active.blocks){const row=el('div','block block-'+b.type);row.dataset.id=b.id;const handle=button('⠿',e=>blockMenu(b,e.currentTarget),'block-handle');handle.setAttribute('aria-label','ブロックの種類と順序を変更');row.append(handle);if(b.type==='divider'){row.append(el('hr'));area.append(row);continue;}
 if(b.type==='bullet')row.append(el('span','bullet-dot','•'));if(b.type==='todo'){const input=el('input');input.type='checkbox';input.checked=b.checked;input.setAttribute('aria-label','完了');input.onchange=()=>{b.checked=input.checked;row.classList.toggle('checked',b.checked);save();};row.append(input);if(b.checked)row.classList.add('checked');}
 const edit=el('div','block-edit',b.text);edit.id='edit-'+b.id;edit.contentEditable='plaintext-only';edit.setAttribute('role','textbox');edit.setAttribute('aria-label',types[b.type]);edit.dataset.placeholder=b.type==='text'?'入力、または「/」でコマンド…':types[b.type];
 edit.oncompositionend=()=>{b.text=edit.textContent;save('block:'+b.id);};
 edit.oninput=e=>{b.text=edit.textContent;save('block:'+b.id,!e.isComposing);if(b.text==='/')blockMenu(b,edit);else if(menu?.dataset.block===b.id)closeMenu();};
 edit.onkeydown=e=>{if(e.isComposing)return;
 if(e.key===' '&&b.type==='text'){
  const shortcut=markdownShortcut(edit.textContent),selection=window.getSelection();
  if(shortcut&&selection.isCollapsed&&selection.rangeCount){
   const tail=selection.getRangeAt(0).cloneRange();tail.setEnd(edit,edit.childNodes.length);
   if(!tail.toString()) {e.preventDefault();Object.assign(b,shortcut,{text:''});closeMenu();let focus=b.id;if(b.type==='divider'){const next=block();active.blocks.splice(active.blocks.indexOf(b)+1,0,next);focus=next.id;}save();renderBlocks();focusBlock(focus);return;}
  }
 }
if(e.key==='Escape'){closeMenu();return;}if(e.key==='Enter'&&!e.shiftKey&&b.type!=='code'){e.preventDefault();closeMenu();const i=active.blocks.indexOf(b);if(!b.text&&['todo','bullet'].includes(b.type)){b.type='text';save();renderBlocks();focusBlock(b.id);return;}const selection=window.getSelection();const range=selection.rangeCount?selection.getRangeAt(0):null;let tail='';if(range&&edit.contains(range.startContainer)&&edit.contains(range.endContainer)){range.deleteContents();const rest=range.cloneRange();rest.setEnd(edit,edit.childNodes.length);tail=rest.toString();rest.deleteContents();b.text=edit.textContent;}const next=block(['todo','bullet'].includes(b.type)?b.type:'text',tail);active.blocks.splice(i+1,0,next);save();renderBlocks();focusBlock(next.id);}if(e.key==='Backspace'&&!b.text&&active.blocks.length>1){e.preventDefault();const i=active.blocks.indexOf(b);active.blocks.splice(i,1);save();renderBlocks();focusBlock(active.blocks[Math.max(0,i-1)].id);}};
 edit.addEventListener('paste',e=>{e.preventDefault();const text=e.clipboardData.getData('text/plain');document.execCommand('insertText',false,text);});row.append(edit);area.append(row);}}
function closeMenu(){menu?.remove();menu=null;}
function showMenu(anchor){closeMenu();menu=el('div','popup');menu.setAttribute('role','menu');document.body.append(menu);const r=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-270))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+5,innerHeight-370))+'px';return menu;}
function blockMenu(b,anchor){const m=showMenu(anchor);m.dataset.block=b.id;m.append(el('div','mini-label','ブロックを変換'));for(const [key,label] of Object.entries(types)){m.append(button(({text:'T',h1:'H₁',h2:'H₂',bullet:'•',todo:'☑',quote:'❝',code:'〈〉',divider:'—'}[key])+'   '+label,()=>{b.type=key;if(b.text==='/')b.text='';save();closeMenu();renderBlocks();focusBlock(b.id);}));}const actions=el('div','block-actions');for(const [label,offset] of [['↑',-1],['↓',1]]){const btn=button(label,()=>{const i=active.blocks.indexOf(b),j=i+offset;if(j>=0&&j<active.blocks.length){[active.blocks[i],active.blocks[j]]=[active.blocks[j],active.blocks[i]];save();renderBlocks();}closeMenu();});btn.setAttribute('aria-label',offset<0?'上へ移動':'下へ移動');actions.append(btn);}actions.append(button('削除',()=>{if(active.blocks.length===1)active.blocks=[block()];else active.blocks=active.blocks.filter(x=>x.id!==b.id);save();closeMenu();renderBlocks();},'danger'));m.append(actions);}
function changeIcon(e){const m=showMenu(e.currentTarget);const grid=el('div','icon-grid');for(const icon of ['📄','🌱','💡','📚','🗂️','📝','🎯','🚀','☕','🎨','🔖','🧭'])grid.append(button(icon,()=>{active.icon=icon;save();render();}));m.append(grid);}
async function action(title,body,label='保存'){closeMenu();$('#action-title').textContent=title;$('#action-body').replaceChildren(body);$('#action-confirm').textContent=label;const d=$('#action-dialog');d.showModal();return new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});});}
$('#favorite').onclick=()=>{active.favorite=!active.favorite;save();render();};
$('#page-menu').onclick=e=>{const m=showMenu(e.currentTarget);m.append(button('ページを複製',()=>{const p=structuredClone(active);p.id=crypto.randomUUID();p.title+=' のコピー';p.blocks=p.blocks.map(b=>({...b,id:crypto.randomUUID()}));state.pages.push(p);open(p.id);}));m.append(button('ページを移動',async()=>{const select=el('select');select.setAttribute('aria-label','移動先');const option=el('option','','ワークスペース直下');option.value='';select.append(option);for(const p of state.pages.filter(p=>canMove(state.pages,active.id,p.id))){const o=el('option','',p.icon+' '+p.title);o.value=p.id;select.append(o);}select.value=active.parentId||'';if(await action('ページの移動先',select,'移動')){active.parentId=select.value||null;save();render();}}));m.append(button('ページを削除',async()=>{const ids=descendants(state.pages,active.id);if(await action('ページを削除しますか？',el('p','',`「${active.title}」と子ページを含む ${ids.size} ページを削除します。必要なら先にバックアップしてください。`),'削除')){state.pages=state.pages.filter(p=>!ids.has(p.id));if(!state.pages.length)state.pages=[page()];open(state.pages[0].id);}},'danger'));};
$('#new-page').onclick=()=>create();$('#add-root').onclick=()=>create();$('#home').onclick=()=>open(state.pages.find(p=>p.parentId===null).id);$('#toggle-sidebar').onclick=()=>{if(innerWidth<=760)$('#sidebar').classList.toggle('mobile-open');else document.body.classList.toggle('sidebar-hidden');};
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=()=>download((active.title||'無題').replace(/[\\/:*?"<>|]/g,'_')+'.md',toMarkdown(active),'text/markdown;charset=utf-8');
$('#backup').onclick=()=>download('folia-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json');
$('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('5 MB 以下のファイルを選んでください');const p=fromMarkdown(await f.text(),f.name.replace(/\.(md|markdown)$/i,''));state.pages.push(p);open(p.id);toast('Markdown を読み込みました');}catch(err){toast(err.message);}e.target.value='';};
$('#restore').onclick=()=>$('#backup-file').click();$('#backup-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20*1024*1024)throw Error('20 MB 以下のファイルを選んでください');const data=validateBackup(JSON.parse(await f.text()));if(await action('バックアップを復元',el('p','',`${data.pages.length} ページを読み込み、現在の内容を置き換えます。`),'復元')){state=data;readFailed=false;open(data.activeId||data.pages[0].id);toast('復元しました');}}catch(err){toast('復元できませんでした: '+err.message);}e.target.value='';};
function search(){const q=$('#search-input').value.trim().toLowerCase();const results=$('#search-results');results.replaceChildren();for(const p of state.pages.filter(p=>!q||(p.title+' '+p.blocks.map(b=>b.text).join(' ')).toLowerCase().includes(q))){const b=button('',()=>{$('#search-dialog').close();open(p.id);},'search-result');b.append(el('span','',p.icon+' '+p.title),el('small','',p.blocks.map(b=>b.text).join(' ').slice(0,100)));results.append(b);}if(!results.children.length)results.append(el('p','empty','一致するページがありません'));}
function openSearch(){$('#search-dialog').showModal();$('#search-input').value='';search();$('#search-input').focus();}
$('#search-open').onclick=openSearch;$('#search-input').oninput=search;$('#search-close').onclick=()=>$('#search-dialog').close();$('#undo').onclick=()=>travel(-1);$('#redo').onclick=()=>travel(1);
document.addEventListener('beforeinput',e=>{
 if(!e.target.closest('.block-edit, #page-title')||e.isComposing)return;
 if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();travel(e.inputType==='historyUndo'?-1:1);}
});
document.addEventListener('keydown',e=>{
 if(e.isComposing)return;
 const key=e.key.toLowerCase(),command=e.metaKey||e.ctrlKey;
 if(command&&!e.altKey&&(key==='z'||(key==='y'&&!e.shiftKey))&&!e.target.closest('dialog, input, textarea, select')){e.preventDefault();travel(key==='y'||e.shiftKey?1:-1);return;}
 if(command&&key==='k'){e.preventDefault();openSearch();}});
document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target)&&!e.target.closest('.block-handle'))closeMenu();});for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close('cancel');}});
window.addEventListener('beforeunload',e=>{if(saveFailed){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===KEY){readFailed=true;saveFailed=true;$('#save-status').textContent='別タブで変更されました。バックアップ後に再読み込み';toast('競合を防ぐため保存を停止しました。バックアップ後に再読み込みしてください。');}});
render();updateHistoryButtons();if(readFailed){saveFailed=true;$('#save-status').textContent='保存データを読み込めませんでした';toast('元のデータは上書きしていません。バックアップを復元してください。');}
