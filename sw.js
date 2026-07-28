// The game is a single document with no subresources, so the cache holds exactly
// one entry: the whole thing.
//
// Serve that entry first and revalidate behind it. BIBLE D01 asks for first paint
// under 400 ms from local storage, and a network-first worker cannot promise that
// — it makes every launch wait on a round trip before the first byte of a file it
// already has. Answering from the cache and refreshing in the background costs one
// launch of staleness on the rare occasion the file changes, which for a game that
// keeps its progress in its own save is nothing, and it is what makes the thing
// open instantly on a train.
const CACHE = 'hyphae-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((hit) => {
        // Kicked off either way: on a hit it is the update for next launch, on a
        // miss it is the response itself.
        const fresh = fetch(e.request)
          .then((res) => {
            if (res && res.ok) cache.put(e.request, res.clone())
            return res
          })
          .catch(() => hit || cache.match('/'))
        return hit || fresh
      })
    )
  )
})
