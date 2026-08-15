const CACHE_NAME="study-os-2026.08.15-cache-sync-fix-1";
const SHELL=[
  "./",
  "./index.html",
  "./setup.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).catch(()=>{})
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="SKIP_WAITING")self.skipWaiting();
});

async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(err){
    const cached=await cache.match(request);
    if(cached)return cached;
    if(request.mode==="navigate"){
      const fallback=await cache.match("./index.html");
      if(fallback)return fallback;
    }
    throw err;
  }
}

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  // Navigation and same-origin app files prefer the network.
  // This prevents an old Study OS HTML from surviving across deployments.
  event.respondWith(networkFirst(req));
});
