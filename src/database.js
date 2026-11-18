import {validateTaskContext,taskContextMarkdown} from './task-context.js';
export const statuses={todo:'未着手',doing:'進行中',done:'完了'};
export const priorities={none:'なし',low:'低',medium:'中',high:'高'};
export const createDatabase=()=>({view:'table',rows:[]});
export const task=(status='todo')=>({id:crypto.randomUUID(),title:'',status,priority:'none',due:''});
export function validDate(value){
 if(value==='')return true;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;
 const date=new Date(value+'T00:00:00Z');return !Number.isNaN(+date)&&date.toISOString().slice(0,10)===value;
}
export function validateDatabase(db){
 if(!db||!['table','board','calendar'].includes(db.view)||!Array.isArray(db.rows))throw Error('データベースの形式が正しくありません');
 const ids=new Set();for(const row of db.rows){
  if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.title!=='string'||!Object.hasOwn(statuses,row.status)||!Object.hasOwn(priorities,row.priority)||typeof row.due!=='string'||!validDate(row.due))throw Error('タスクの形式が正しくありません');
  if(row.context!==undefined)validateTaskContext(row.context);
  ids.add(row.id);
 }
 return db;
}
export function visibleTasks(db,{query='',status='all',sort='manual'}={}){
 const q=query.trim().toLocaleLowerCase();let rows=db.rows.filter(r=>(status==='all'||r.status===status)&&r.title.toLocaleLowerCase().includes(q));
 if(sort==='due')rows.sort((a,b)=>(a.due||'9999-99-99').localeCompare(b.due||'9999-99-99'));
 if(sort==='priority'){const rank={high:0,medium:1,low:2,none:3};rows.sort((a,b)=>rank[a.priority]-rank[b.priority]);}
 return rows;
}
export function databaseSearch(db){return db?.rows.map(r=>[r.title,statuses[r.status],priorities[r.priority],r.due].join(' ')).join(' ')||'';}
const escapeCell=s=>s.replace(/&/g,'&amp;').replace(/\|/g,'&#124;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r\n?|\n/g,'<br>').replace(/\t/g,'&#9;').replace(/^ +| +$/g,s=>'&#32;'.repeat(s.length));
const unescapeCell=s=>s.replace(/<br>/g,'\n').replace(/&amp;|&#124;|&#32;|&#9;|&lt;|&gt;/g,s=>({'&amp;':'&','&#124;':'|','&#32;':' ','&#9;':'\t','&lt;':'<','&gt;':'>'}[s]));
export const databaseHeader='| Task | Status | Priority | Due |';
export function databaseMarkdown(db){return [databaseHeader,'| --- | --- | --- | --- |',...db.rows.map(r=>'| '+[r.title,statuses[r.status],priorities[r.priority],r.due].map(escapeCell).join(' | ')+' |')].join('\n')+db.rows.filter(r=>r.context).map(r=>'\n\n### '+r.title.replace(/[\r\n]/g,' ')+' — 作業の根拠\n\n'+taskContextMarkdown(r.context)).join('');}
export function parseDatabaseTable(lines,start){
 if(lines[start]!==databaseHeader||lines[start+1]!=='| --- | --- | --- | --- |')return null;
 const db=createDatabase();let end=start+2;
 for(;end<lines.length&&lines[end].startsWith('|');end++){
  const cells=lines[end].split('|');if(cells.length!==6||cells[0].trim()||cells[5].trim())return null;
  const [title,statusLabel,priorityLabel,due]=cells.slice(1,-1).map(s=>unescapeCell(s.trim()));
  const status=Object.keys(statuses).find(k=>statuses[k]===statusLabel),priority=Object.keys(priorities).find(k=>priorities[k]===priorityLabel);
  if(!status||!priority||!validDate(due))return null;
  db.rows.push({...task(),title,status,priority,due});
 }
 return {database:db,end};
}
