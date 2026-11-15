import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,page,block,validateBackup} from '../src/model.js';
import {moveToTrash,restoreFromTrash,permanentlyDelete,trashCount} from '../src/trash.js';
import {createDatabase,task} from '../src/database.js';
import {History} from '../src/history.js';
import {pageLinks,pageToken,backlinks} from '../src/links.js';
const reload=state=>validateBackup(JSON.parse(JSON.stringify(state)));

test('deletes a subtree as one entry while retaining its blocks, tasks, IDs and former parent',()=>{
 const state=initial(),root=state.pages.find(p=>p.title==='アイデアノート'),child=state.pages.find(p=>p.parentId===root.id);root.database=createDatabase();root.database.rows.push(task());state.activeId=child.id;
 const before=structuredClone([root,child]),entry=moveToTrash(state,root.id);
 assert.equal(trashCount(state),2);assert.equal(entry.pages.length,2);assert.deepEqual(entry.pages,before);assert.ok(state.pages.some(p=>p.id===state.activeId));assert.ok(!state.pages.some(p=>p.id===root.id||p.id===child.id));reload(state);
});

test('restores a child to its original parent after JSON roundtrip',()=>{
 let state=initial();const child=state.pages.find(p=>p.parentId!==null),original=structuredClone(child),entry=moveToTrash(state,child.id);assert.equal(entry.pages[0].parentId,null);
 state=reload(state);const restored=restoreFromTrash(state,entry.id);assert.deepEqual(restored,original);assert.equal(state.activeId,child.id);assert.equal(trashCount(state),0);reload(state);
});

test('restores at root if former parent is also trashed and supports separately restoring parent later',()=>{
 const state=initial(),child=state.pages.find(p=>p.parentId!==null),parentId=child.parentId,childEntry=moveToTrash(state,child.id),parentEntry=moveToTrash(state,parentId);
 const restored=restoreFromTrash(state,childEntry.id);assert.equal(restored.parentId,null);restoreFromTrash(state,parentEntry.id);assert.equal(state.pages.find(p=>p.id===child.id).parentId,null);reload(state);
});

test('deleting the final page creates an editable replacement and restoring preserves both',()=>{
 const last=page('Last'),state={version:1,pages:[last],activeId:last.id};const entry=moveToTrash(state,last.id);assert.equal(state.pages.length,1);assert.notEqual(state.pages[0].id,last.id);assert.equal(state.pages[0].id,state.activeId);
 restoreFromTrash(state,entry.id);assert.equal(state.pages.length,2);assert.equal(state.activeId,last.id);reload(state);
});

test('old backups load and malformed trash, cross-entry ID collisions and extra roots are rejected',()=>{
 assert.doesNotThrow(()=>reload(initial()));const state=initial();moveToTrash(state,state.pages[0].id);reload(state);
 for(const mutate of [s=>s.trash={},s=>s.trash.push(s.trash[0]),s=>s.trash[0].deletedAt='2026-02-30T00:00:00.000Z',s=>s.trash[0].pages.push(page('extra root')),s=>s.pages.push(structuredClone(s.trash[0].pages[0])),s=>s.trash[0].rootId='missing',s=>s.trash[0].pages[0].blocks[0].id=s.pages[0].blocks[0].id]){const copy=structuredClone(state);mutate(copy);assert.throws(()=>reload(copy));}
});

test('links and backlinks recover after the linked page is restored',()=>{
 const state=initial(),source=state.pages[0],target=state.pages[1];source.blocks=[block('text',pageToken(target))];const entry=moveToTrash(state,target.id);
 assert.equal(pageLinks(source.blocks[0].text,state.pages)[0].page,null);restoreFromTrash(state,entry.id);assert.equal(pageLinks(source.blocks[0].text,state.pages)[0].page.id,target.id);assert.equal(backlinks(state.pages,target.id)[0].page.id,source.id);
});

test('history records both trash contents and deletion/restoration and reset prevents resurrection',()=>{
 const state=initial(),h=new History(state),entry=moveToTrash(state,state.pages[0].id);h.record(state);restoreFromTrash(state,entry.id);h.record(state);
 const deleted=h.step(-1).value;assert.equal(trashCount(deleted),1);assert.equal(trashCount(h.step(-1).value),0);const redo=h.step(1).value;assert.equal(trashCount(redo),1);
 permanentlyDelete(redo,entry.id);h.reset(redo);assert.equal(h.canUndo,false);assert.equal(h.canRedo,false);assert.equal(h.step(-1),null);assert.equal(trashCount(redo),0);
});

test('permanent deletion affects only its entry or empties the bin and keeps live pages intact',()=>{
 const state=initial(),first=moveToTrash(state,state.pages[0].id);moveToTrash(state,state.pages[0].id);const live=structuredClone(state.pages);permanentlyDelete(state,first.id);assert.equal(state.trash.length,1);assert.deepEqual(state.pages,live);permanentlyDelete(state);assert.equal(trashCount(state),0);reload(state);
});

test('failed operations leave data unchanged',()=>{
 const state=initial();assert.throws(()=>moveToTrash(state,'missing'));assert.throws(()=>restoreFromTrash(state,'missing'));assert.throws(()=>permanentlyDelete(state,'missing'));
 const entry=moveToTrash(state,state.pages[0].id);state.pages.push(structuredClone(entry.pages[0]));const before=JSON.stringify(state);assert.throws(()=>restoreFromTrash(state,entry.id));assert.equal(JSON.stringify(state),before);
});
