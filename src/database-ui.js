import {moveTask} from './reorder.js';
import {createDragScope,dropPosition,clearDropHints} from './drag.js';
import {statuses,priorities,task,visibleTasks,validDate} from './database.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(label,fn,cls='')=>{const node=el('button',cls,label);node.type='button';node.onclick=fn;return node;};
function select(options,value,label,change){const node=el('select');node.setAttribute('aria-label',label);for(const [key,label] of Object.entries(options)){const option=el('option','',label);option.value=key;node.append(option);}node.value=value;node.onchange=()=>change(node.value);return node;}
export function renderDatabase(page,{save,confirm}){
 const drag=createDragScope('task',page.id);
 const db=page.database,section=el('section','database');section.setAttribute('aria-label','タスクデータベース');
 let query='',status='all',sort='manual';
 const header=el('div','db-heading');header.append(el('h2','','タスクデータベース'));const count=el('span','db-count');header.append(count);
 header.append(button('データベースを削除',async()=>{if(await confirm('データベースを削除しますか？','タスク '+db.rows.length+' 件を削除します。Undo で元に戻せます。')){delete page.database;save();section.dispatchEvent(new CustomEvent('database-removed',{bubbles:true}));}},'db-delete'));
 const toolbar=el('div','db-toolbar'),views=el('div','db-views');
 const tableButton=button('▤ テーブル',()=>setView('table')),boardButton=button('▥ ボード',()=>setView('board'));views.append(tableButton,boardButton);toolbar.append(views);
 const search=el('input','db-search');search.type='search';search.placeholder='タスクを検索…';search.setAttribute('aria-label','タスクを検索');search.oninput=()=>{query=search.value;draw();};toolbar.append(search);
 toolbar.append(select({all:'すべてのステータス',...statuses},status,'ステータスで絞り込み',value=>{status=value;draw();}));
 toolbar.append(select({manual:'手動順',due:'期限が近い順',priority:'優先度が高い順'},sort,'並び順',value=>{sort=value;draw();}));
 toolbar.append(button('＋ タスク',()=>add(status==='all'?'todo':status),'db-add'));
 const body=el('div','db-content'),announcement=el('p','sr-only');announcement.setAttribute('role','status');section.append(header,toolbar,body,announcement);
 const endDrag=()=>{drag.end();clearDropHints(body);};
 function commitMove(id,status,targetId=null,position='before'){endDrag();if(moveTask(db,id,status,{targetId,position,reorder:sort==='manual'})){save();draw();document.getElementById('task-handle-'+id)?.focus();announcement.textContent='タスクを'+statuses[status]+'に移動しました';}}
 function setView(view){db.view=view;save();draw();}
 function add(status){const row=task(status);db.rows.push(row);save();query='';search.value='';draw();requestAnimationFrame(()=>document.getElementById('task-'+row.id)?.focus());}
 async function remove(row){if(await confirm('タスクを削除しますか？',row.title||'無題のタスク')){db.rows=db.rows.filter(r=>r.id!==row.id);save();draw();}}
 function titleInput(row){const input=el('input','task-title');input.id='task-'+row.id;input.value=row.title;input.placeholder='タスク名を入力…';input.setAttribute('aria-label','タスク名');input.oninput=e=>{row.title=input.value;save('task:'+row.id+':title',!e.isComposing);};input.oncompositionend=()=>{row.title=input.value;save('task:'+row.id+':title');};return input;}
 function statusInput(row){const input=select(statuses,row.status,'ステータス',value=>{row.status=value;save();draw();});input.id='task-status-'+row.id;input.className='task-status status-'+row.status;return input;}
 function priorityInput(row){const input=select(priorities,row.priority,'優先度',value=>{row.priority=value;save();draw();});input.id='task-priority-'+row.id;input.className='task-priority priority-'+row.priority;return input;}
 function dueInput(row){const input=el('input','task-due');input.id='task-due-'+row.id;input.type='date';input.min='0001-01-01';input.max='9999-12-31';input.value=row.due;input.setAttribute('aria-label','期限');input.onchange=()=>{if(!validDate(input.value)){input.setCustomValidity('正しい日付を入力してください');input.reportValidity();return;}input.setCustomValidity('');row.due=input.value;save();draw();};return input;}
 function draw(){
  endDrag();
  const focusId=body.contains(document.activeElement)?document.activeElement.id:null;
  const rows=visibleTasks(db,{query,status,sort});body.replaceChildren();count.textContent=rows.length+' / '+db.rows.length;tableButton.classList.toggle('selected',db.view==='table');boardButton.classList.toggle('selected',db.view==='board');tableButton.setAttribute('aria-pressed',String(db.view==='table'));boardButton.setAttribute('aria-pressed',String(db.view==='board'));
  if(db.view==='table'){
   const wrap=el('div','db-table-scroll'),table=el('table','db-table'),caption=el('caption','sr-only','タスク一覧'),head=el('thead'),tr=el('tr');
   for(const label of ['タスク名','ステータス','優先度','期限','操作']){const th=el('th','',label);th.scope='col';tr.append(th);}head.append(tr);table.append(caption,head);
   const tbody=el('tbody');for(const row of rows){const tr=el('tr');for(const input of [titleInput(row),statusInput(row),priorityInput(row),dueInput(row),button('削除',()=>remove(row),'db-row-delete')]){const td=el('td');td.append(input);tr.append(td);}tbody.append(tr);}table.append(tbody);wrap.append(table);body.append(wrap);
   if(!rows.length)body.append(el('p','db-empty',db.rows.length?'条件に一致するタスクはありません':'最初のタスクを追加して、計画をはじめましょう。'));
  }else{
   const board=el('div','db-board');for(const [key,label] of Object.entries(statuses)){
    const column=el('section','db-column');column.setAttribute('aria-label',label);
    column.ondragover=e=>{if(!drag.matches(e))return;e.preventDefault();e.dataTransfer.dropEffect='move';column.classList.add('drop-column');};
    column.ondragleave=e=>{if(!column.contains(e.relatedTarget))column.classList.remove('drop-column');};
    column.ondrop=e=>{if(!drag.matches(e))return;e.preventDefault();e.stopPropagation();const id=drag.read(e);if(id)commitMove(id,key);else endDrag();};
    const tasks=rows.filter(r=>r.status===key),heading=el('div','db-column-heading');heading.append(el('h3','status-'+key,label),el('span','',String(tasks.length)));column.append(heading);
    for(const row of tasks){const card=el('article','db-card'),top=el('div','db-card-top'),handle=button('⠿',()=>{},'task-drag-handle');handle.id='task-handle-'+row.id;handle.draggable=true;handle.title='ドラッグで列を移動 · Alt+← / → でも移動';handle.setAttribute('aria-label',(row.title||'無題のタスク')+' を移動');handle.setAttribute('aria-keyshortcuts','Alt+ArrowLeft Alt+ArrowRight');
     handle.ondragstart=e=>{if(drag.start(row.id,e))card.classList.add('drag-source');};handle.ondragend=endDrag;
     handle.onkeydown=e=>{if(e.isComposing||!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const keys=Object.keys(statuses),next=keys[keys.indexOf(row.status)+(e.key==='ArrowLeft'?-1:1)];if(next)commitMove(row.id,next);};
     card.ondragover=e=>{if(!drag.matches(e))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';for(const node of body.querySelectorAll('.drop-before,.drop-after'))node.classList.remove('drop-before','drop-after');if(sort==='manual')card.classList.add('drop-'+dropPosition(card,e));column.classList.add('drop-column');};
     card.ondragleave=e=>{if(!card.contains(e.relatedTarget))card.classList.remove('drop-before','drop-after');};
     card.ondrop=e=>{if(!drag.matches(e))return;e.preventDefault();e.stopPropagation();const id=drag.read(e);if(id)commitMove(id,key,row.id,dropPosition(card,e));else endDrag();};
     top.append(handle,titleInput(row));card.append(top,statusInput(row));const fields=el('div','db-card-fields');fields.append(priorityInput(row),dueInput(row));card.append(fields,button('削除',()=>remove(row),'db-row-delete'));column.append(card);}
    if(!tasks.length)column.append(el('p','db-empty','タスクはありません'));column.append(button('＋ タスクを追加',()=>{status='all';toolbar.querySelector('select').value='all';add(key);},'db-column-add'));board.append(column);
   }body.append(board);
  }
  if(focusId)document.getElementById(focusId)?.focus();
 }
 draw();return section;
}
