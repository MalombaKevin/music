// Service worker: makes the site installable as an app (no URL bar / browser menu)
// and keeps the core pages available offline. Bump CACHE when shipping changes.
const CACHE = 'kd-v1';
const CORE = [
  '/', '/kwara', '/dana', '/discover',
  '/styles.css', '/script.js', '/site.webmanifest',
  '/images/icons/icon-192.png', '/images/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates show straight away), cache as the offline fallback.
// Only same-origin GETs are handled; YouTube and fonts go straight to the network.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
  );
});
