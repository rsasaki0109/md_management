import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageToken,pageLinks,backlinks,linkQuery,insertPageLink} from '../src/links.js';
import {page,block,toMarkdown,fromMarkdown,validateBackup} from '../src/model.js';

test('ID links follow page renames and moves and do not bind to a replacement after deletion',()=>{
 const target=page('Original'),source=page('Source'),token=pageToken(target);
 target.title='Renamed';target.parentId=source.id;
 assert.equal(pageLinks(token,[source,target])[0].page,target);assert.equal(pageLinks(token,[source,target])[0].label,'Renamed');
 const replacement=page('Original');const broken=pageLinks(token,[source,replacement])[0];assert.equal(broken.page,null);assert.equal(broken.label,'Original');
});

test('title links resolve only unique titles, exact IDs win, and malformed input is ignored',()=>{
 const a=page('メモ'),b=page('メモ');assert.equal(pageLinks('[[メモ]]',[a])[0].page,a);
 const ambiguous=pageLinks('[[メモ]]',[a,b])[0];assert.equal(ambiguous.page,null);assert.equal(ambiguous.ambiguous,true);
 assert.equal(pageLinks(`[[${b.id}|メモ]]`,[a,b])[0].page,b);
 assert.deepEqual(pageLinks('[[unfinished\n[[bad\nline]] []',[a]),[]);
});

test('backlinks group multiple blocks per source and omit code blocks and self references',()=>{
 const target=page('Target'),source=page('Source'),code=page('Code');const token=pageToken(target);
 target.blocks=[block('text',token)];source.blocks=[block('text',token+' '+token),block('todo',token)];code.blocks=[block('code',token)];
 const refs=backlinks([target,source,code],target.id);assert.equal(refs.length,1);assert.equal(refs[0].page.id,source.id);assert.equal(refs[0].blocks.length,2);
 source.blocks=[];assert.deepEqual(backlinks([target,source,code],target.id),[]);
});

test('picker finds query at caret and inserts without losing trailing text or duplicating closing brackets',()=>{
 const target=page('Target'),text='before [[Tar]] after',offset=text.indexOf(']]');const query=linkQuery(text,offset);
 assert.equal(query.query,'Tar');const result=insertPageLink(text,query,target);assert.equal(result.text,'before '+pageToken(target)+' after');assert.equal(result.offset,('before '+pageToken(target)).length);
 assert.equal(insertPageLink('[[',linkQuery('[[',2),target).text,pageToken(target));
 for(const [text,offset] of [['[[done]]',8],['[[a|b',5],['[[a\nb',5],['plain',5],['[[',3]])assert.equal(linkQuery(text,offset),null);
});

test('links survive Markdown export/import and JSON backup restoration',()=>{
 const target=page('日本語のページ'),source=page('Source');source.blocks=[block('text','参考: '+pageToken(target))];
 const imported=fromMarkdown(toMarkdown(source));assert.equal(pageLinks(imported.blocks[0].text,[target])[0].page.id,target.id);
 const backup=validateBackup(JSON.parse(JSON.stringify({version:1,pages:[source,target],activeId:source.id})));
 assert.equal(backlinks(backup.pages,target.id)[0].page.id,source.id);
});

test('link text remains literal and token labels cannot break their delimiters',()=>{
 const target=page('evil [[name]]|\n<script>alert(1)</script>');const token=pageToken(target),links=pageLinks(token,[target]);
 assert.equal(links.length,1);assert.equal(links[0].page,target);assert.equal(links[0].label,target.title);
 assert.equal(pageLinks('[[missing|<img src=x onerror=alert(1)>]]',[])[0].label,'<img src=x onerror=alert(1)>');
});
