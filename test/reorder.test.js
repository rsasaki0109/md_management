import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reorderItems,moveTask} from '../src/reorder.js';
import {createDragScope,dropPosition} from '../src/drag.js';
import {initial,block,validateBackup,toMarkdown} from '../src/model.js';
import {createDatabase,task,visibleTasks} from '../src/database.js';
import {History} from '../src/history.js';
const ids=items=>items.map(item=>item.id);
const event=()=>{const data=new Map();return {dataTransfer:{get types(){return [...data.keys()];},setData:(type,value)=>data.set(type,value),getData:type=>data.get(type)||'',effectAllowed:'none'}};};

test('block reorder handles both directions and append while preserving identity and content',()=>{
 const a=block('todo','Task',true),b=block('code','const x = 1'),c=block('divider'),items=[a,b,c];
 assert.equal(reorderItems(items,a.id,c.id,'after'),true);assert.deepEqual(ids(items),[b.id,c.id,a.id]);assert.equal(items[2],a);assert.equal(a.checked,true);
 reorderItems(items,a.id,b.id,'before');assert.deepEqual(items,[a,b,c]);reorderItems(items,b.id);assert.deepEqual(items,[a,c,b]);assert.equal(items[2],b);
});

test('no-op and invalid drops leave arrays unchanged',()=>{
 const a=block(),b=block(),items=[a,b];
 for(const args of [[a.id,a.id],[a.id,b.id,'before'],['missing',b.id],[a.id,'missing'],[a.id,b.id,'unknown'],[b.id,null]]){const before=[...items];assert.equal(reorderItems(items,...args),false);assert.deepEqual(items,before);}
});

test('task movement supports empty columns and manual ordering without losing properties',()=>{
 const db=createDatabase(),a={...task(),title:'a',due:'2026-12-01',priority:'high'},b={...task('doing'),title:'b'},c={...task('doing'),title:'c'};db.rows=[a,b,c];
 assert.equal(moveTask(db,a.id,'doing',{targetId:c.id,position:'before'}),true);assert.deepEqual(ids(visibleTasks(db,{status:'doing'})),[b.id,a.id,c.id]);assert.equal(a.due,'2026-12-01');assert.equal(a.priority,'high');assert.equal(db.rows[1],a);
 assert.equal(moveTask(db,a.id,'done'),true);assert.deepEqual(visibleTasks(db,{status:'done'}),[a]);
});

test('sorted views change only status and preserve underlying order, invalid targets never mutate',()=>{
 const db=createDatabase(),a={...task(),priority:'high'},b=task('doing');db.rows=[a,b];const before=[...db.rows];
 assert.equal(moveTask(db,a.id,'doing',{targetId:b.id,reorder:false}),true);assert.deepEqual(db.rows,before);
 const snapshot=JSON.stringify(db);for(const args of [[a.id,'constructor'],['missing','done'],[a.id,'done',{targetId:b.id}],[a.id,'done',{position:'invalid'}]]){assert.equal(moveTask(db,...args),false);assert.equal(JSON.stringify(db),snapshot);}
 assert.equal(moveTask(db,a.id,'doing',{reorder:false}),false);
});

test('manual reorder leaves filtered-out task identities and relative order intact',()=>{
 const db=createDatabase(),rows=[task(),task('done'),task(),task('doing'),task()];db.rows=rows.slice();moveTask(db,rows[4].id,'todo',{targetId:rows[0].id});
 assert.deepEqual(ids(visibleTasks(db,{status:'todo'})),[rows[4].id,rows[0].id,rows[2].id]);assert.deepEqual(ids(db.rows.filter(r=>r.status!=='todo')),[rows[1].id,rows[3].id]);
});

test('one drop is reversible as one undo step and survives backup and Markdown export',()=>{
 const state=initial(),p=state.pages[0];p.database=createDatabase();p.database.rows=[task(),task('doing')];const h=new History(state),before=structuredClone(state);
 reorderItems(p.blocks,p.blocks[0].id,p.blocks.at(-1).id,'after');h.record(state);const reordered=structuredClone(state);
 moveTask(p.database,p.database.rows[0].id,'done');h.record(state);validateBackup(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(h.step(-1).value,reordered);assert.deepEqual(h.step(-1).value,before);assert.deepEqual(h.step(1).value,reordered);
 assert.ok(toMarkdown(p).includes('完了'));assert.equal(p.blocks.at(-1).text,before.pages[0].blocks[0].text);
});

test('drag scopes accept only their own active drag and reject external, cross-page and stale data',()=>{
 const scope=createDragScope('block','page-a'),other=createDragScope('block','page-b'),taskScope=createDragScope('task','page-a'),e=event();
 assert.equal(scope.matches(e),false);assert.equal(scope.start('block-1',e),true);assert.equal(e.dataTransfer.effectAllowed,'move');assert.equal(scope.read(e),'block-1');assert.equal(other.read(e),null);assert.equal(taskScope.read(e),null);
 const external=event();external.dataTransfer.setData('text/plain','block-1');assert.equal(scope.read(external),null);
 scope.end();assert.equal(scope.read(e),null);scope.start('block-2',event());assert.equal(scope.read(e),null);
 assert.equal(scope.start('block-3',{}),false);assert.equal(scope.read(e),null);
});

test('malformed or modified drag payloads are rejected and midpoint determines insertion side',()=>{
 const scope=createDragScope('task','page'),e=event();scope.start('task',e);const mime=e.dataTransfer.types[0],original=JSON.parse(e.dataTransfer.getData(mime));
 for(const data of ['invalid',JSON.stringify({...original,id:'other'}),JSON.stringify({...original,owner:'other'}),JSON.stringify({...original,token:'other'})]){e.dataTransfer.setData(mime,data);assert.equal(scope.read(e),null);}
 const node={getBoundingClientRect:()=>({top:100,height:40})};assert.equal(dropPosition(node,{clientY:119}),'before');assert.equal(dropPosition(node,{clientY:120}),'after');
});
