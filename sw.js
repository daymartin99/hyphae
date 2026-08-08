const b='hyphae-v2'
const a=['./','./index.html']
const c=['./manifest.webmanifest','./apple-touch-icon.png','./icon-512.png']
self.addEventListener('install',(e)=>{e.waitUntil(caches.open(b).then(async(cache)=>{const f=await Promise.all(a.map((u)=>cache.add(u).then(()=>!0,()=>!1)))
if(!f.some(Boolean))throw new Error('precache failed: no document cached')
await Promise.all(c.map((u)=>cache.add(u).catch(()=>{})))
await self.skipWaiting()}))})
self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((k)=>k!==b).map((k)=>caches.delete(k)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',(e)=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return
e.respondWith(caches.open(b).then(async(cache)=>{let g=await cache.match(e.request)
if(!g&&e.request.mode==='navigate'){for(const u of a)g=g||await cache.match(u)}const d=fetch(e.request).then((res)=>{if(res&&res.ok)cache.put(e.request,res.clone())
return res})
if(g){e.waitUntil(d.then(()=>{},()=>{}))
return g}return d.catch(()=>Response.error())}))})