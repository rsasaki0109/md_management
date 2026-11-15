import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,task,validateDatabase,visibleTasks,validDate,databaseSearch,databaseMarkdown} from '../src/database.js';
import {initial,page,toMarkdown,fromMarkdown,validateBackup} from '../src/model.js';
import {History} from '../src/history.js';
const fields=rows=>rows.map(({id,...rest})=>rest);

test('filters and sorts derive views without mutating the shared rows',()=>{
 const db=createDatabase();const a={...task(),title:'Design UI',priority:'high',due:'2026-11-20'},b={...task('doing'),title:'Build API',priority:'low',due:'2026-11-18'},c={...task('done'),title:'Write notes',priority:'medium'};db.rows=[a,b,c];
 assert.deepEqual(visibleTasks(db,{query:'  API ',status:'doing'}),[b]);assert.deepEqual(visibleTasks(db,{status:'done'}),[c]);
 assert.deepEqual(visibleTasks(db,{sort:'due'}),[b,a,c]);assert.deepEqual(visibleTasks(db,{sort:'priority'}),[a,c,b]);assert.deepEqual(db.rows,[a,b,c]);
 b.status='done';assert.equal(visibleTasks(db,{status:'done'}).length,2);
});

test('calendar validation rejects impossible dates and accepts leap years and empty due dates',()=>{
 for(const s of ['','2024-02-29','2026-11-15','0001-01-01','9999-12-31'])assert.equal(validDate(s),true,s);
 for(const s of ['2025-02-29','2026-04-31','2026-13-01','0000-01-01','2026-1-01','2026-11-15<script>'])assert.equal(validDate(s),false,s);
});

test('old backups remain valid and new databases reject invalid records',()=>{
 assert.doesNotThrow(()=>validateBackup(initial()));const state=initial();state.pages[0].database=createDatabase();state.pages[0].database.rows.push(task());validateBackup(state);
 for(const mutate of [db=>db.view='unknown',db=>db.rows.push(db.rows[0]),db=>db.rows[0].status='unknown',db=>db.rows[0].priority='constructor',db=>db.rows[0].due='2026-02-30',db=>db.rows[0].title=null]){const copy=structuredClone(state);mutate(copy.pages[0].database);assert.throws(()=>validateBackup(copy));}
 assert.throws(()=>validateDatabase(null));
});

test('Markdown preserves task values, Japanese labels, pipes, HTML-like text and line breaks',()=>{
 const p=page('Tasks');p.database=createDatabase();p.database.rows=[{...task('doing'),title:' 設計 | <script>\n&amp; <br> &lt;\t ',priority:'high',due:'2026-11-30'},task('done')];
 const markdown=toMarkdown(p),restored=fromMarkdown(markdown);assert.deepEqual(fields(restored.database.rows),fields(p.database.rows));
 assert.match(markdown,/&#124;/);assert.match(markdown,/&lt;script&gt;/);assert.notEqual(restored.database.rows[0].id,p.database.rows[0].id);
});

test('empty tables import and malformed tables stay ordinary text',()=>{
 const p=page();p.database=createDatabase();assert.deepEqual(fromMarkdown(toMarkdown(p)).database.rows,[]);
 const malformed=databaseMarkdown({...createDatabase(),rows:[task()]}).replace('未着手','invalid');const imported=fromMarkdown(malformed);assert.equal(imported.database,undefined);assert.ok(imported.blocks.some(b=>b.text.includes('invalid')));
 const code=fromMarkdown('```\n'+databaseMarkdown(createDatabase())+'\n```');assert.equal(code.database,undefined);assert.equal(code.blocks[0].type,'code');
});

test('backup and history retain database view, task identity and reversible deletion',()=>{
 const state=initial();state.pages[0].database=createDatabase();const row=task();state.pages[0].database.rows.push(row);const h=new History(state);
 state.pages[0].database.view='board';state.pages[0].database.rows[0].status='done';h.record(state);
 delete state.pages[0].database;h.record(state);const restored=h.step(-1).value;validateBackup(JSON.parse(JSON.stringify(restored)));assert.equal(restored.pages[0].database.view,'board');assert.equal(restored.pages[0].database.rows[0].id,row.id);assert.equal(restored.pages[0].database.rows[0].status,'done');
 assert.equal(h.step(-1).value.pages[0].database.rows[0].status,'todo');assert.equal(h.step(1).value.pages[0].database.view,'board');
});

test('workspace search indexes task titles and property labels',()=>{
 const db=createDatabase();db.rows=[{...task('doing'),title:'リリース計画',priority:'high',due:'2026-12-01'}];const text=databaseSearch(db);for(const value of ['リリース計画','進行中','高','2026-12-01'])assert.ok(text.includes(value));assert.equal(databaseSearch(undefined),'');
});
