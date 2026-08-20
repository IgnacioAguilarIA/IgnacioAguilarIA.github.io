const CACHE="agenda-fich-v13";
const APP_SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest"
];
self.addEventListener("install", event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event=>{
  const req=event.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname.endsWith("/events.json")){
    event.respondWith(fetch(req,{cache:"no-store"}).catch(()=>caches.match(req)));
    return;
  }
  if(req.mode==="navigate"){
    event.respondWith(fetch(req).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy));return resp;}).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));return resp;}).catch(()=>cached)));
});
