import {taskContextDetails} from './work-details-ui.js';
import {localToday,monthCells,shiftMonth,tasksForDate,rescheduleTask,filterDeadlines} from './calendar.js';
import {moveTask} from './reorder.js';
import {createDragScope,dropPosition,clearDropHints} from './drag.js';
import {statuses,priorities,task,visibleTasks,validDate} from './database.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(label,fn,cls='')=>{const node=el('button',cls,label);node.type='button';node.onclick=fn;return node;};
function select(options,value,label,change){const node=el('select');node.setAttribute('aria-label',label);for(const [key,label] of Object.entries(options)){const option=el('option','',label);option.value=key;node.append(option);}node.value=value;node.onchange=()=>change(node.value);return node;}
export function renderDatabase(page,{save,confirm}){
 const drag=createDragScope('task',page.id);
 const db=page.database,section=el('section','database');section.setAttribute('aria-label','タスクデータベース');
 let query='',status='all',deadline='all',sort='manual',selectedDate=localToday(),undatedOpen=false;
 let [year,month]=selectedDate.split('-').map(Number);
 const header=el('div','db-heading');header.append(el('h2','','タスクデータベース'));const count=el('span','db-count');header.append(count);
 header.append(button('データベースを削除',async()=>{if(await confirm('データベースを削除しますか？','タスク '+db.rows.length+' 件を削除します。Undo で元に戻せます。')){delete page.database;save();section.dispatchEvent(new CustomEvent('database-removed',{bubbles:true}));}},'db-delete'));
 const toolbar=el('div','db-toolbar'),views=el('div','db-views');
 const tableButton=button('▤ テーブル',()=>setView('table')),boardButton=button('▥ ボード',()=>setView('board'));const calendarButton=button('▦ カレンダー',()=>setView('calendar'));views.append(tableButton,boardButton,calendarButton);toolbar.append(views);
 const search=el('input','db-search');search.type='search';search.placeholder='タスクを検索…';search.setAttribute('aria-label','タスクを検索');search.oninput=()=>{query=search.value;draw();};toolbar.append(search);
 toolbar.append(select({all:'すべてのステータス',...statuses},status,'ステータスで絞り込み',value=>{status=value;draw();}));
 const deadlineSelect=select({all:'すべての期限',today:'今日',overdue:'期限切れ（未完了）',next7:'今後7日',undated:'期限未設定'},deadline,'期限で絞り込み',value=>{deadline=value;draw();});toolbar.append(deadlineSelect);
 toolbar.append(select({manual:'手動順',due:'期限が近い順',priority:'優先度が高い順'},sort,'並び順',value=>{sort=value;draw();}));
 toolbar.append(button('＋ タスク',()=>add(status==='all'?'todo':status),'db-add'));
 const body=el('div','db-content'),announcement=el('p','sr-only');announcement.setAttribute('role','status');section.append(header,toolbar,body,announcement);
 const endDrag=()=>{drag.end();clearDropHints(body);};
 function commitMove(id,status,targetId=null,position='before'){endDrag();if(moveTask(db,id,status,{targetId,position,reorder:sort==='manual'})){save();draw();document.getElementById('task-handle-'+id)?.focus();announcement.textContent='タスクを'+statuses[status]+'に移動しました';}}
 function setView(view){db.view=view;save();draw();}
 function add(status,due=db.view==='calendar'?selectedDate:''){const row={...task(status),due};db.rows.push(row);save();deadline='all';deadlineSelect.value='all';query='';search.value='';draw();requestAnimationFrame(()=>document.getElementById('task-'+row.id)?.focus());}
 async function remove(row){if(await confirm('タスクを削除しますか？',row.title||'無題のタスク')){db.rows=db.rows.filter(r=>r.id!==row.id);save();draw();}}
 function titleInput(row){const input=el('input','task-title');input.id='task-'+row.id;input.value=row.title;input.placeholder='タスク名を入力…';input.setAttribute('aria-label','タスク名');input.oninput=e=>{row.title=input.value;save('task:'+row.id+':title',!e.isComposing);};input.oncompositionend=()=>{row.title=input.value;save('task:'+row.id+':title');};return input;}
 function statusInput(row){const input=select(statuses,row.status,'ステータス',value=>{row.status=value;save();draw();});input.id='task-status-'+row.id;input.className='task-status status-'+row.status;return input;}
 function priorityInput(row){const input=select(priorities,row.priority,'優先度',value=>{row.priority=value;save();draw();});input.id='task-priority-'+row.id;input.className='task-priority priority-'+row.priority;return input;}
 function dueInput(row){const input=el('input','task-due');input.id='task-due-'+row.id;input.type='date';input.min='0001-01-01';input.max='9999-12-31';input.value=row.due;input.setAttribute('aria-label','期限');input.onchange=()=>{if(!validDate(input.value)){input.setCustomValidity('正しい日付を入力してください');input.reportValidity();return;}input.setCustomValidity('');rescheduleTask(db,row.id,input.value);save();draw();};return input;}
 function commitDate(id,date){
  endDrag();if(!rescheduleTask(db,id,date))return;
  if(date)selectedDate=date;else {const list=body.querySelector('.calendar-undated');if(list)list.open=true;}
  save();draw();document.getElementById('task-'+id)?.focus();announcement.textContent=date?'期限を '+date+' に変更しました':'期限を未設定に戻しました';
 }
 function dateDropTarget(node,date){
  node.ondragover=e=>{if(!drag.matches(e))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';node.classList.add('drop-column');};
  node.ondragleave=e=>{if(!node.contains(e.relatedTarget))node.classList.remove('drop-column');};
  node.ondrop=e=>{if(!drag.matches(e))return;e.preventDefault();e.stopPropagation();const id=drag.read(e);if(id)commitDate(id,date);else endDrag();};
 }
 function dateDragSource(node,row){node.draggable=true;node.ondragstart=e=>{if(drag.start(row.id,e))node.classList.add('drag-source');};node.ondragend=endDrag;}
 function drawCalendar(rows){
  const calendar=el('section','db-calendar');calendar.setAttribute('aria-label','期限カレンダー');const navigation=el('div','calendar-navigation');
  const previous=button('‹',()=>changeMonth(-1),'calendar-arrow'),next=button('›',()=>changeMonth(1),'calendar-arrow');previous.id='calendar-prev-'+page.id;next.id='calendar-next-'+page.id;previous.setAttribute('aria-label','前の月');next.setAttribute('aria-label','次の月');previous.disabled=!shiftMonth(year,month,-1);next.disabled=!shiftMonth(year,month,1);
  const label=el('h3','',year+' 年 '+month+' 月');label.setAttribute('aria-live','polite');navigation.append(previous,label,next,button('今日',()=>{selectedDate=localToday();[year,month]=selectedDate.split('-').map(Number);draw();},'calendar-today'));calendar.append(navigation);
  const scroll=el('div','calendar-scroll'),table=el('table','calendar-grid'),caption=el('caption','sr-only',year+' 年 '+month+' 月のタスク期限'),head=el('thead'),week=el('tr');for(const day of ['月','火','水','木','金','土','日']){const th=el('th','',day);th.scope='col';week.append(th);}head.append(week);table.append(caption,head);
  const tbody=el('tbody'),cells=monthCells(year,month),today=localToday();
  for(let i=0;i<cells.length;i+=7){const tr=el('tr');for(const date of cells.slice(i,i+7)){const td=el('td','calendar-cell');if(date){td.dataset.date=date;dateDropTarget(td,date);if(date===today)td.classList.add('calendar-current-day');if(date===selectedDate)td.classList.add('calendar-selected');const tasks=tasksForDate(rows,date),top=el('div','calendar-date-top'),number=button(String(Number(date.slice(-2))),()=>{selectedDate=date;draw();},'calendar-number');number.id='calendar-day-'+date;number.setAttribute('aria-label',date+' · '+tasks.length+' 件');if(date===today)number.setAttribute('aria-current','date');number.setAttribute('aria-pressed',String(date===selectedDate));const plus=button('＋',()=>{selectedDate=date;add(status==='all'?'todo':status,date);},'calendar-day-add');plus.setAttribute('aria-label',date+' にタスクを追加');top.append(number,plus);td.append(top);
    for(const task of tasks.slice(0,2)){const chip=button(task.title||'無題のタスク',()=>{selectedDate=date;draw();requestAnimationFrame(()=>document.getElementById('task-'+task.id)?.focus());},'calendar-task status-'+task.status);dateDragSource(chip,task);chip.title=(task.title||'無題のタスク')+' · '+statuses[task.status];td.append(chip);}if(tasks.length>2)td.append(button('ほか '+(tasks.length-2)+' 件',()=>{selectedDate=date;draw();},'calendar-more'));
   }else td.classList.add('calendar-padding');tr.append(td);}tbody.append(tr);}table.append(tbody);scroll.append(table);calendar.append(scroll);
  const selected=el('section','calendar-day-details');selected.setAttribute('aria-label',selectedDate+' のタスク');selected.append(el('h4','',selectedDate+' のタスク'));const scheduled=tasksForDate(rows,selectedDate);if(!scheduled.length)selected.append(el('p','db-empty','この日のタスクはありません'));for(const row of scheduled)selected.append(detailRow(row));selected.append(button('＋ この日に追加',()=>add(status==='all'?'todo':status),'db-column-add'));calendar.append(selected);
  const undated=el('details','calendar-undated'),withoutDue=tasksForDate(rows,'');undated.open=undatedOpen;dateDropTarget(undated,'');undated.append(el('summary','','期限未設定 · '+withoutDue.length+' 件'));for(const row of withoutDue)undated.append(detailRow(row));if(!withoutDue.length)undated.append(el('p','db-empty','期限未設定のタスクはありません'));calendar.append(undated);body.append(calendar);
 }
 function contextDetails(row){return taskContextDetails(row.context,{lastCheck:row.workCheck,onChecked:record=>{row.workCheck=record;save();},onUpdate:context=>{row.context=context;save();draw();},onComplete:row.status==='done'?undefined:()=>{row.status='done';save();draw();}});}
 function detailRow(row){const card=el('article','calendar-detail-row'),top=el('div','db-card-top'),handle=button('⠿',()=>{},'task-drag-handle');handle.id='calendar-handle-'+row.id;handle.setAttribute('aria-label',(row.title||'無題のタスク')+' の期限をドラッグで変更');handle.title='日付または期限未設定へドラッグ';dateDragSource(handle,row);top.append(handle,titleInput(row));card.append(top);const fields=el('div','calendar-detail-fields');fields.append(statusInput(row),priorityInput(row),dueInput(row),button('削除',()=>remove(row),'db-row-delete'));card.append(fields);if(row.context)card.append(contextDetails(row));return card;}
 function changeMonth(delta){const next=shiftMonth(year,month,delta);if(!next)return;year=next.year;month=next.month;selectedDate=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-01';draw();}
 function draw(){
  endDrag();
  const focusId=body.contains(document.activeElement)?document.activeElement.id:null;
  undatedOpen=body.querySelector('.calendar-undated')?.open??undatedOpen;
  const rows=filterDeadlines(visibleTasks(db,{query,status,sort}),deadline);body.replaceChildren();count.textContent=rows.length+' / '+db.rows.length;tableButton.classList.toggle('selected',db.view==='table');boardButton.classList.toggle('selected',db.view==='board');tableButton.setAttribute('aria-pressed',String(db.view==='table'));boardButton.setAttribute('aria-pressed',String(db.view==='board'));calendarButton.classList.toggle('selected',db.view==='calendar');calendarButton.setAttribute('aria-pressed',String(db.view==='calendar'));
  if(db.view==='table'){
   const wrap=el('div','db-table-scroll'),table=el('table','db-table'),caption=el('caption','sr-only','タスク一覧'),head=el('thead'),tr=el('tr');
   for(const label of ['タスク名','ステータス','優先度','期限','操作']){const th=el('th','',label);th.scope='col';tr.append(th);}head.append(tr);table.append(caption,head);
   const tbody=el('tbody');for(const row of rows){const tr=el('tr');for(const input of [titleInput(row),statusInput(row),priorityInput(row),dueInput(row),button('削除',()=>remove(row),'db-row-delete')]){const td=el('td');td.append(input);tr.append(td);}tbody.append(tr);if(row.context){const detailsRow=el('tr','task-work-row'),cell=el('td');cell.colSpan=5;cell.append(contextDetails(row));detailsRow.append(cell);tbody.append(detailsRow);}}table.append(tbody);wrap.append(table);body.append(wrap);
   if(!rows.length)body.append(el('p','db-empty',db.rows.length?'条件に一致するタスクはありません':'最初のタスクを追加して、計画をはじめましょう。'));
  }else if(db.view==='calendar'){
   drawCalendar(rows);
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
     top.append(handle,titleInput(row));card.append(top,statusInput(row));const fields=el('div','db-card-fields');fields.append(priorityInput(row),dueInput(row));card.append(fields,button('削除',()=>remove(row),'db-row-delete'));if(row.context)card.append(contextDetails(row));column.append(card);}
    if(!tasks.length)column.append(el('p','db-empty','タスクはありません'));column.append(button('＋ タスクを追加',()=>{status='all';toolbar.querySelector('select').value='all';add(key);},'db-column-add'));board.append(column);
   }body.append(board);
  }
  if(focusId)document.getElementById(focusId)?.focus();
 }
 section.addEventListener('focus-task',event=>{const row=db.rows.find(r=>r.id===event.detail?.id);if(!row)return;deadline='all';deadlineSelect.value='all';query='';search.value='';status='all';toolbar.querySelector('select').value='all';if(db.view==='calendar'){if(row.due){selectedDate=row.due;[year,month]=row.due.split('-').map(Number);}else{undatedOpen=true;const list=body.querySelector('.calendar-undated');if(list)list.open=true;}}draw();requestAnimationFrame(()=>{const input=document.getElementById('task-'+row.id);input?.scrollIntoView({block:'center'});input?.focus({preventScroll:true});});});
 draw();return section;
}
