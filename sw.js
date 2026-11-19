// sw.js - TIDAK PERLU DIUBAH VERSI LAGI SAAT DEPLOY
const CACHE_NAME = 'pamili-garmen-cache';
// File yang WAJIB selalu terbaru (Network-First):
const NETWORK_FIRST = ['index.html', 'app.js'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.replace(/^\//, '') || 'index.html';
  const isNetworkFirst = req.mode === 'navigate' || NETWORK_FIRST.includes(path);

  if (isNetworkFirst) {
    // Network-First: ambil terbaru dari GitHub, simpan ke cache sbg cadangan offline
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))
      )
    );
  } else {
    // Aset lain (icon, manifest, dll): Stale-While-Revalidate (cepat + auto-refresh)
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          const c = res.clone();
          caches.open(CACHE_NAME).then(x => x.put(req, c));
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
