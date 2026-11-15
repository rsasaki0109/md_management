import {test} from 'node:test';
import assert from 'node:assert/strict';
import {History,markdownShortcut} from '../src/history.js';
import {initial,page,block,validateBackup} from '../src/model.js';

test('groups typing, separates pauses and other actions, restores snapshots without shared references',()=>{
 const state=initial(),id=state.pages[0].blocks[0].id,h=new History(state);
 const b=state.pages[0].blocks[0],original=b.text;
 b.text='a';h.record(state,{group:id,now:100,focus:{id,offset:1}});
 b.text='ab';h.record(state,{group:id,now:200,focus:{id,offset:2}});
 assert.equal(h.entries.length,2);
 b.text='abc';h.record(state,{group:id,now:1200});
 assert.equal(h.entries.length,3);
 const previous=h.step(-1);assert.equal(previous.value.pages[0].blocks[0].text,'ab');assert.equal(previous.focus.offset,2);
 previous.value.pages[0].blocks[0].text='mutated';
 assert.equal(h.step(-1).value.pages[0].blocks[0].text,original);
 assert.equal(h.step(1).value.pages[0].blocks[0].text,'ab');
});

test('navigation and save timestamps do not create undo steps',()=>{
 const state=initial(),h=new History(state);state.activeId=state.pages[1].id;state.pages[0].updatedAt='later';h.record(state);
 assert.equal(h.canUndo,false);assert.equal(h.step(-1),null);
});

test('a new edit after undo discards redo and does not merge into the old typing group',()=>{
 const state=initial(),h=new History(state);state.pages[0].title='first';h.record(state,{group:'title',now:100});state.pages[0].title='second';h.record(state,{group:'title',now:1000});
 const restored=h.step(-1).value;restored.pages[0].title='new branch';h.record(restored,{group:'title',now:1100});
 assert.equal(h.canRedo,false);assert.equal(h.step(-1).value.pages[0].title,'first');assert.equal(h.step(1).value.pages[0].title,'new branch');
});

test('undo and redo recover page deletion, tree structure, block identity and checked state',()=>{
 const state=initial(),h=new History(state);const p=page('child',state.pages[0].id);p.blocks=[block('todo','task',true)];state.pages.push(p);h.record(state);
 state.pages=state.pages.filter(x=>x.id!==p.id);h.record(state);
 const restored=h.step(-1).value;validateBackup(restored);assert.deepEqual(restored.pages.find(x=>x.id===p.id),p);
 assert.equal(h.step(1).value.pages.some(x=>x.id===p.id),false);
});

test('history limit retains only the newest states',()=>{
 const state=initial(),h=new History(state,{limit:3});for(let i=0;i<6;i++){state.pages[0].title=String(i);h.record(state);}
 assert.equal(h.entries.length,3);assert.equal(h.step(-1).value.pages[0].title,'4');assert.equal(h.step(-1).value.pages[0].title,'3');assert.equal(h.step(-1),null);
});

test('shortcut conversion is reversible and preserves block identity',()=>{
 const state=initial();const b=state.pages[0].blocks[0];b.type='text';b.text='[x]';const h=new History(state),id=b.id;
 Object.assign(b,markdownShortcut(b.text),{text:''});h.record(state);
 const undone=h.step(-1).value.pages[0].blocks[0];assert.equal(undone.text,'[x]');assert.equal(undone.type,'text');
 const redone=h.step(1).value.pages[0].blocks[0];assert.equal(redone.id,id);assert.equal(redone.checked,true);assert.equal(redone.type,'todo');
});

test('shortcut parser matches only exact supported prefixes',()=>{
 for(const [prefix,type] of [['#','h1'],['##','h2'],['-','bullet'],['*','bullet'],['[]','todo'],['[ ]','todo'],['- [ ]','todo'],['[x]','todo'],['- [x]','todo'],['>','quote'],['```','code'],['---','divider']])assert.equal(markdownShortcut(prefix).type,type);
 for(const text of ['hello #','# title','###',' #','','constructor','__proto__','toString'])assert.equal(markdownShortcut(text),null);
 assert.equal(markdownShortcut('[ ]').checked,false);assert.equal(markdownShortcut('[x]').checked,true);
});

test('undoing the first edit after navigation stays on the edited page',()=>{
 const state=initial(),h=new History(state);state.activeId=state.pages[1].id;h.record(state);
 const original=state.pages[1].title;state.pages[1].title='edited';h.record(state);
 const undone=h.step(-1).value;assert.equal(undone.activeId,state.pages[1].id);assert.equal(undone.pages[1].title,original);
});
