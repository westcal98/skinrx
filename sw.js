const CACHE_NAME='skinrx-v2';
const NETWORK_FIRST=['/','index.html','/index.html','app.js','/app.js','styles.css','/styles.css','manifest.json','/manifest.json'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c=>c.addAll(['/icon-192.png','/icon-512.png']).catch(()=>{}))
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  const isNetworkFirst=NETWORK_FIRST.some(p=>url.pathname===p||url.pathname.endsWith('/'+p.replace(/^\//,'')));
  if(isNetworkFirst){
    e.respondWith(
      fetch(e.request)
        .then(res=>{
          const clone=res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));
          return res;
        })
        .catch(()=>caches.match(e.request))
    );
  }else{
    e.respondWith(
      caches.match(e.request).then(cached=>cached||fetch(e.request))
    );
  }
});
