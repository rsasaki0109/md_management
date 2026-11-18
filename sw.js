const CACHE='folia-shell-v0.1.1-work-check-filter-1';
const PREFIX='folia-shell-';
const ASSETS=['/','/index.html','/manifest.webmanifest','/assets/icon-192.png','/assets/icon-512.png','/src/style.css','/src/app.js','/src/offline.js','/src/outline.js','/src/search.js','/src/editor.js','/src/model.js','/src/history.js','/src/links.js','/src/database.js','/src/database-ui.js','/src/calendar.js','/src/saved-work.js','/src/task-context.js','/src/work-details-ui.js','/src/work-evidence.js','/src/projects.js','/src/projects-ui.js','/src/navigation.js','/src/reorder.js','/src/drag.js','/src/trash.js','/src/templates.js','/src/templates-ui.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);}catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 // Serve one complete application version. Never store workspace data here.
 if(event.request.mode==='navigate'){event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match('/')||fetch(event.request);})());return;}
 if(!ASSETS.includes(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(url.pathname)||fetch(event.request);})());
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='ACTIVATE_UPDATE')return;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  if(windows.length>1){event.ports[0]?.postMessage({ok:false,reason:'tabs'});return;}
  event.ports[0]?.postMessage({ok:true});await self.skipWaiting();
 })());
});
