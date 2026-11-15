import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePageHash,resolvePage,pageUrl,pageAncestors,createPageRouter} from '../src/navigation.js';
import {initial,page} from '../src/model.js';
import {moveToTrash,restoreFromTrash} from '../src/trash.js';
import {History} from '../src/history.js';
function fakeBrowser(href='https://example.test/app?mode=local'){
 const browser=new EventTarget();let stack=[{url:new URL(href).href,state:{existing:'kept'}}],index=0;
 Object.defineProperty(browser,'location',{get:()=>new URL(stack[index].url)});
 browser.history={get state(){return stack[index].state;},pushState(state,_,url){stack.splice(++index);stack.push({url:new URL(url,stack[index-1].url).href,state});},replaceState(state,_,url){stack[index]={url:new URL(url,stack[index].url).href,state};}};
 browser.go=delta=>{const next=index+delta;if(next<0||next>=stack.length)return;index=next;browser.dispatchEvent(new Event('popstate'));browser.dispatchEvent(new Event('hashchange'));};
 browser.hash=hash=>{const url=new URL(browser.location.href);url.hash=hash;browser.history.pushState({},'',url);browser.dispatchEvent(new Event('hashchange'));};
 Object.defineProperty(browser,'length',{get:()=>stack.length});return browser;
}

test('page hashes roundtrip Japanese and reserved characters and reject malformed links',()=>{
 for(const id of ['page-id','日本語 /?#%&=+','<script>']){const url=pageUrl('https://example.test/app?x=1#old',id);assert.deepEqual(parsePageHash(new URL(url).hash),{kind:'page',id});assert.equal(new URL(url).pathname,'/app');assert.equal(new URL(url).search,'?x=1');}
 for(const hash of ['#page=','#page=%E0%A4%A','#unknown','#page=%'])assert.equal(parsePageHash(hash).kind,'invalid');assert.equal(parsePageHash('').kind,'empty');assert.equal(parsePageHash('#').kind,'empty');assert.throws(()=>pageUrl('https://example.test',''));
});

test('deep links take precedence over last active page and missing or deleted pages use a live fallback',()=>{
 const state=initial(),target=state.pages[1];assert.equal(resolvePage(state.pages,'#page='+target.id,state.pages[0].id).page,target);assert.equal(resolvePage(state.pages,'',target.id).page,target);
 const entry=moveToTrash(state,target.id);const missing=resolvePage(state.pages,'#page='+target.id,state.activeId);assert.equal(missing.missing,true);assert.ok(state.pages.includes(missing.page));restoreFromTrash(state,entry.id);assert.equal(resolvePage(state.pages,'#page='+target.id).missing,false);
 assert.equal(resolvePage(state.pages,'#bad','missing').page,state.pages[0]);assert.throws(()=>resolvePage([],''));
});

test('ancestor paths support nested pages and tolerate missing parents or cycles without looping',()=>{
 const root=page('root'),child=page('child',root.id),leaf=page('leaf',child.id),pages=[root,child,leaf];assert.deepEqual(pageAncestors(pages,leaf.id),[root.id,child.id]);assert.deepEqual(pageAncestors(pages,'missing'),[]);assert.deepEqual(pageAncestors([leaf],leaf.id),[]);root.parentId=leaf.id;assert.deepEqual(pageAncestors(pages,leaf.id),[root.id,child.id]);
});

test('initial replacement, duplicate navigation and existing history metadata do not add entries',()=>{
 const browser=fakeBrowser(),router=createPageRouter(browser,()=>{});assert.equal(router.write('a',{replace:true}),true);assert.equal(browser.length,1);assert.equal(browser.history.state.existing,'kept');assert.equal(browser.history.state.foliaPage,'a');assert.equal(router.write('a'),false);assert.equal(browser.length,1);router.write('b');assert.equal(browser.length,2);
});

test('back and forward emit once even when both browser events fire and do not push loops',()=>{
 const browser=fakeBrowser(),visited=[];let router;router=createPageRouter(browser,hash=>{visited.push(parsePageHash(hash).id);router.write(parsePageHash(hash).id,{replace:true});});router.write('a',{replace:true});router.start();router.start();router.write('b');router.write('c');browser.go(-1);browser.go(-1);browser.go(1);assert.deepEqual(visited,['b','a','b']);assert.equal(browser.length,3);router.stop();browser.go(1);assert.deepEqual(visited,['b','a','b']);
});

test('manual hash edits are handled and invalid destinations replace rather than append a fallback',()=>{
 const browser=fakeBrowser(),pages=[page('a'),page('b')],visited=[];let router;router=createPageRouter(browser,hash=>{const route=resolvePage(pages,hash,pages[0].id);visited.push(route.missing);router.write(route.page.id,{replace:true});});router.write(pages[0].id,{replace:true});router.start();browser.hash('#page=missing');assert.deepEqual(visited,[true]);assert.equal(parsePageHash(browser.location.hash).id,pages[0].id);assert.equal(browser.length,2);browser.hash('#page='+pages[1].id);assert.deepEqual(visited,[true,false]);router.stop();
});

test('URL navigation does not create edit history and undo route replacement does not grow browser history',()=>{
 const state=initial(),h=new History(state),browser=fakeBrowser(),router=createPageRouter(browser,()=>{});router.write(state.activeId,{replace:true});state.activeId=state.pages[1].id;router.write(state.activeId);h.record(state);assert.equal(h.canUndo,false);
 state.pages[1].title='Edited';h.record(state);const snapshot=h.step(-1).value;router.write(snapshot.activeId,{replace:true});assert.equal(browser.length,2);assert.equal(parsePageHash(browser.location.hash).id,snapshot.activeId);
});
