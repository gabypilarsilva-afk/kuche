const CACHE_VERSION="kuche-shell-v1.3";
const SHELL_CACHE=⁠ ${CACHE_VERSION}-shell ⁠;
const RUNTIME_CACHE=⁠ ${CACHE_VERSION}-runtime ⁠;
const APP_SHELL=["./","./index.html","./manifest.webmanifest"];
const EXTERNAL_STATIC=[
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@700;800;900&display=swap"
];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await cache.addAll(APP_SHELL);
    for(const url of EXTERNAL_STATIC){
      try{
        const res=await fetch(new Request(url,{mode:"no-cors",cache:"reload"}));
        await cache.put(url,res);
      }catch(e){}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>!k.startsWith(CACHE_VERSION)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);

  // Nunca interceptar API/Auth/Realtime de Supabase.
  if(url.hostname.endsWith(".supabase.co"))return;

  if(req.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(SHELL_CACHE);
        cache.put("./index.html",fresh.clone());
        return fresh;
      }catch(e){
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  const staticExternal=["cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"].includes(url.hostname);
  if(staticExternal){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      if(cached)return cached;
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(RUNTIME_CACHE);
        cache.put(req,fresh.clone());
        return fresh;
      }catch(e){return cached;}
    })());
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      const network=fetch(req).then(async fresh=>{
        const cache=await caches.open(RUNTIME_CACHE);
        cache.put(req,fresh.clone());
        return fresh;
      }).catch(()=>null);
      return cached || await network || Response.error();
    })());
  }
});
