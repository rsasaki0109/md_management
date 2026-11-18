import {test} from 'node:test';
import assert from 'node:assert/strict';
import {outlineEntries} from '../src/outline.js';
import {block} from '../src/model.js';
test('outline uses only heading blocks in document order with stable IDs',()=>{const a=block('h1','Title'),b=block('h2','Title'),text=block('text','# Not heading'),code=block('code','## Code');assert.deepEqual(outlineEntries([text,b,code,a]),[{id:b.id,level:2,title:'Title'},{id:a.id,level:1,title:'Title'}]);});
test('outline handles empty and multiline labels as literal text',()=>{const a=block('h2',' \n '),b=block('h1','<script>\nline');assert.equal(outlineEntries([a,b])[0].title,'無題の見出し');assert.equal(outlineEntries([a,b])[1].title,'<script> line');assert.deepEqual(outlineEntries([]),[]);});
test('outline follows edits, conversion, deletion and reorder without changing blocks',()=>{const a=block('h1','A'),b=block('h2','B'),blocks=[a,b];a.text='Changed';assert.equal(outlineEntries(blocks)[0].title,'Changed');a.type='text';assert.deepEqual(outlineEntries(blocks).map(x=>x.id),[b.id]);a.type='h1';blocks.reverse();const before=structuredClone(blocks);assert.deepEqual(outlineEntries(blocks).map(x=>x.id),[b.id,a.id]);assert.deepEqual(blocks,before);blocks.splice(0,1);assert.equal(outlineEntries(blocks).length,1);});
