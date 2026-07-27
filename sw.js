// The game is a single document with no subresources, so the cache holds
// exactly one entry. Network-first keeps a deployed update from being pinned
// behind a stale cache; the cached copy is what makes it work on a plane.
const CACHE = 'hyphae-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return
  e.respondWith(
    fetch(e.request)
      .then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return res })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
  )
})
