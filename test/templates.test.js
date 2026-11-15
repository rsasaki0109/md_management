import {test} from 'node:test';
import assert from 'node:assert/strict';
import {templates,createFromTemplate,findTemplates} from '../src/templates.js';
import {initial,validateBackup,toMarkdown,fromMarkdown} from '../src/model.js';
import {History} from '../src/history.js';
import {moveToTrash,restoreFromTrash} from '../src/trash.js';
const date=new Date(2026,10,15,23,30);

test('every built-in produces a valid independent page with editable blocks and a valid destination',()=>{
 const state=initial(),parent=state.pages[0];
 for(const template of templates){const p=createFromTemplate(template.id,{parentId:parent.id,date});assert.equal(p.parentId,parent.id);assert.ok(p.blocks.length);state.pages.push(p);}
 validateBackup(state);const ids=state.pages.flatMap(p=>[p.id,...p.blocks.map(b=>b.id),...(p.database?.rows.map(r=>r.id)||[])]);assert.equal(new Set(ids).size,ids.length);
});

test('daily and meeting dates use the local calendar and titles can be customized',()=>{
 assert.equal(createFromTemplate('daily',{date}).title,'日報 2026-11-15');assert.equal(createFromTemplate('meeting',{date}).blocks[0].text,'日時: 2026-11-15');
 assert.equal(createFromTemplate('reading',{date,title:'  My book  '}).title,'My book');assert.equal(createFromTemplate('blank',{date,title:'  '}).title,'無題');
 assert.throws(()=>createFromTemplate('missing',{date}));assert.throws(()=>createFromTemplate('__proto__',{date}));assert.throws(()=>createFromTemplate('daily',{date:new Date('invalid')}));
});

test('reusing a template never shares IDs, tasks, blocks or edits',()=>{
 const a=createFromTemplate('project',{date}),b=createFromTemplate('project',{date});assert.notEqual(a.id,b.id);assert.notEqual(a.blocks[0].id,b.blocks[0].id);assert.notEqual(a.database.rows[0].id,b.database.rows[0].id);
 a.blocks[0].text='Changed';a.database.rows[0].status='done';assert.notEqual(b.blocks[0].text,'Changed');assert.equal(b.database.rows[0].status,'todo');assert.equal(createFromTemplate('project',{date}).database.rows[0].status,'todo');
});

test('project template contains a board with editable initial tasks while other templates stay document-only',()=>{
 const project=createFromTemplate('project',{date});assert.equal(project.database.view,'board');assert.equal(project.database.rows.length,3);assert.ok(project.database.rows.every(r=>r.status==='todo'&&r.due===''));
 for(const template of templates.filter(t=>t.id!=='project'))assert.equal(createFromTemplate(template.id,{date}).database,undefined);
 const blank=createFromTemplate('blank',{date});assert.equal(blank.blocks.length,1);assert.equal(blank.blocks[0].text,'');
});

test('template search covers names, categories and descriptions without mutating the catalog',()=>{
 assert.equal(findTemplates(' 議事録 ')[0].id,'meeting');assert.equal(findTemplates('ボード')[0].id,'project');assert.ok(findTemplates('仕事').some(t=>t.id==='meeting'));assert.equal(findTemplates('no-match').length,0);assert.equal(findTemplates().length,templates.length);assert.ok(Object.isFrozen(templates));assert.ok(Object.isFrozen(templates[0]));
});

test('created templates survive backup and Markdown export/import including project task values',()=>{
 const state=initial();for(const t of templates){const p=createFromTemplate(t.id,{date});state.pages.push(p);const imported=fromMarkdown(toMarkdown(p));assert.equal(imported.title,p.title);if(p.database)assert.deepEqual(imported.database.rows.map(({id,...r})=>r),p.database.rows.map(({id,...r})=>r));}
 const restored=validateBackup(JSON.parse(JSON.stringify(state)));assert.deepEqual(restored,state);
});

test('template creation is one reversible history action and trash restore retains generated content',()=>{
 const state=initial(),h=new History(state),p=createFromTemplate('project',{date,parentId:state.pages[0].id});state.pages.push(p);state.activeId=p.id;h.record(state);
 assert.equal(h.step(-1).value.pages.some(x=>x.id===p.id),false);assert.deepEqual(h.step(1).value.pages.find(x=>x.id===p.id),p);
 const before=structuredClone(p),entry=moveToTrash(state,p.id);restoreFromTrash(state,entry.id);assert.deepEqual(state.pages.find(x=>x.id===p.id),before);validateBackup(state);
});
