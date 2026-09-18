const CACHE='nova-v5-shell';
const ASSETS=['./index.html','./styles.css?v=4','./app.js?v=4','./worker.js?v=4','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith((async()=>{
    try{
      const resp=await fetch(e.request,{cache:'no-store'});
      if(resp.ok && new URL(e.request.url).origin===location.origin){
        const copy=resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
      }
      return resp;
    }catch(err){
      const cached=await caches.match(e.request);
      if(cached)return cached;
      throw err;
    }
  })());
});
