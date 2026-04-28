const CACHE_NAME = 'pamili-absen-v2'; // NAIKIN VERSI TIAP UPDATE
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// INSTALL: CACHE FILE STATIS
self.addEventListener('install', event => {
  self.skipWaiting(); // LANGSUNG AKTIF GA NUNGGU TAB DITUTUP
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// ACTIVATE: HAPUS CACHE LAMA
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key!== CACHE_NAME)
           .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // AMBIL ALIH SEMUA TAB
});

// FETCH: CACHE FIRST BUAT FILE, NETWORK ONLY BUAT APPS SCRIPT
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // KALAU REQUEST KE GOOGLE APPS SCRIPT, JANGAN CACHE. LANGSUNG NETWORK
  if (url.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // BUAT FILE LAIN: CACHE FIRST, FALLBACK NETWORK
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchRes => {
        // SIMPEN KE CACHE BUAT NEXT LOAD
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchRes.clone());
          return fetchRes;
        });
      });
    }).catch(() => {
      // KALAU OFFLINE + GA ADA DI CACHE, BALIKIN INDEX.HTML
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
