// The game is a single document plus a handful of PWA sidecar files, so the
// cache is tiny and the document is the only entry that matters offline.
//
// Serve from the cache first and revalidate behind it. BIBLE D01 asks for first
// paint under 400 ms from local storage, and a network-first worker cannot
// promise that — it makes every launch wait on a round trip before the first
// byte of a file it already has. Answering from the cache and refreshing in the
// background costs one launch of staleness on the rare occasion the file
// changes, which for a game that keeps its progress in its own save is nothing,
// and it is what makes the thing open instantly on a train.
const CACHE = 'hyphae-v2'

// The document is precached at install under both names a host can serve it by
// — some static hosts answer './', some only './index.html' — so the FIRST
// offline launch after a single visit already boots, rather than the second.
// One of the two must land for install to count; the sidecars are best-effort
// because the game boots without them.
const DOC_URLS = ['./', './index.html']
const SIDECARS = ['./manifest.webmanifest', './apple-touch-icon.png', './icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const landed = await Promise.all(DOC_URLS.map((u) => cache.add(u).then(() => true, () => false)))
      if (!landed.some(Boolean)) throw new Error('precache failed: no document cached')
      await Promise.all(SIDECARS.map((u) => cache.add(u).catch(() => {})))
      await self.skipWaiting()
    })
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  // Only same-origin GETs are ours; anything else falls through untouched.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // A navigation anywhere in scope is this one document, so a miss on the
      // exact URL falls back to whichever spelling install managed to cache.
      let hit = await cache.match(e.request)
      if (!hit && e.request.mode === 'navigate') {
        for (const u of DOC_URLS) hit = hit || await cache.match(u)
      }
      const fresh = fetch(e.request).then((res) => {
        if (res && res.ok) cache.put(e.request, res.clone())
        return res
      })
      if (hit) {
        // Kicked off behind the cached answer: the update lands for next
        // launch. waitUntil keeps the worker alive long enough to store it.
        e.waitUntil(fresh.then(() => {}, () => {}))
        return hit
      }
      return fresh.catch(() => Response.error())
    })
  )
})
