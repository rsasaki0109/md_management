import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchPages,highlightParts} from '../src/search.js';
import {page,block} from '../src/model.js';
import {createDatabase,task} from '../src/database.js';
test('search matches all words across sources and ranks title matches first',()=>{const a=page('Notes'),b=page('Alpha');a.blocks=[block('text','alpha beta')];b.blocks=[block('text','beta')];assert.deepEqual(searchPages([a,b],' ALPHA beta ').map(r=>r.pageId),[b.id,a.id]);assert.equal(searchPages([a,b],'alpha missing').length,0);});
test('results identify block and task targets with snippets around late matches',()=>{const p=page('Page');const b=block('code','x'.repeat(200)+'needle');p.blocks=[b];let r=searchPages([p],'needle')[0];assert.equal(r.targetId,b.id);assert.ok(r.snippet.includes('needle'));p.database=createDatabase();const t={...task('doing'),title:'タスク検証'};p.database.rows=[t];r=searchPages([p],'タスク検証 進行中')[0];assert.equal(r.kind,'task');assert.equal(r.targetId,t.id);});
test('highlight merges overlapping ranges and keeps literal content intact',()=>{const text='<script> Banana';const parts=highlightParts(text,['script','ana','nan']);assert.equal(parts.map(p=>p.text).join(''),text);assert.ok(parts.some(p=>p.match&&p.text==='anana'));assert.deepEqual(highlightParts('plain',[]),[{text:'plain',match:false}]);});
