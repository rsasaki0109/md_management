export function parsePageHash(hash){
 if(hash===''||hash==='#')return {kind:'empty',id:null};
 if(!hash.startsWith('#page='))return {kind:'invalid',id:null};
 try{const id=decodeURIComponent(hash.slice(6));return id?{kind:'page',id}:{kind:'invalid',id:null};}catch{return {kind:'invalid',id:null};}
}
export function resolvePage(pages,hash,fallbackId){
 if(!pages.length)throw Error('表示できるページがありません');
 const route=parsePageHash(hash),requested=route.kind==='page'?pages.find(p=>p.id===route.id):null;
 return {page:requested||pages.find(p=>p.id===fallbackId)||pages[0],missing:route.kind==='invalid'||(route.kind==='page'&&!requested)};
}
export function pageUrl(base,id){
 if(typeof id!=='string'||!id)throw Error('ページ ID が正しくありません');
 const url=new URL(base);url.hash='page='+encodeURIComponent(id);return url.href;
}
export function pageAncestors(pages,id){
 const byId=new Map(pages.map(p=>[p.id,p])),seen=new Set([id]),ancestors=[];let current=byId.get(id);
 while(current?.parentId!==null){const parent=byId.get(current?.parentId);if(!parent||seen.has(parent.id))break;seen.add(parent.id);ancestors.unshift(parent.id);current=parent;}
 return ancestors;
}
// pushState changes the URL without a reload. popstate and hashchange can fire
// for the same traversal, so consume a URL once and do not push it back again.
export function createPageRouter(browser,onNavigate){
 let lastUrl=browser.location.href,started=false;
 const receive=()=>{const url=browser.location.href;if(url===lastUrl)return;lastUrl=url;onNavigate(browser.location.hash);};
 return {
  write(id,{replace=false}={}){
   const url=pageUrl(browser.location.href,id);if(url===browser.location.href){lastUrl=url;return false;}
   const current=browser.history.state;
   const state={...(current&&typeof current==='object'&&!Array.isArray(current)?current:{}),foliaPage:id};
   browser.history[replace?'replaceState':'pushState'](state,'',url);lastUrl=url;return true;
  },
  start(){if(started)return;started=true;browser.addEventListener('popstate',receive);browser.addEventListener('hashchange',receive);},
  stop(){if(!started)return;started=false;browser.removeEventListener('popstate',receive);browser.removeEventListener('hashchange',receive);}
 };
}
