const CACHE_NAME = 'ABSENSI-PG-V9'; // naikkan dari V8 → V9
const URLS_TO_CACHE = [
  '/absensi-PG/',
  '/absensi-PG/index.html',
  '/absensi-PG/app.js',
  '/absensi-PG/manifest.json',
  '/absensi-PG/icon-192.png',
  '/absensi-PG/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('script.google.com') || 
      event.request.url.includes('nominatim.openstreetmap.org')) {
    return event.respondWith(fetch(event.request));
  }
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});

// === TAMBAHAN UNTUK NOTIFIKASI ===
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      for (const c of list) {
        if (c.url.includes('/absensi-PG/') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/absensi-PG/');
    })
  );
});
