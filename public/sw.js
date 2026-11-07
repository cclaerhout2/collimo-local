/*
 * Service worker de la version web locale de Collimo : l'app s'ouvre aussi sans réseau.
 * Réseau d'abord (une nouvelle version est prise dès qu'elle est en ligne), copie locale sinon.
 * Les photos et les collages ne passent pas par ici : ils sont dans le stockage du navigateur.
 */
const CACHE = 'collimo-web-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html'])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          void caches.open(CACHE).then((cache) => cache.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match('./index.html'))),
  )
})
