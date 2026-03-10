// ============================================================
// MindSharp Service Worker
// Tüm kritik dosyaları önbelleğe alır — offline çalışmayı sağlar
// ============================================================

const CACHE_NAME = 'mindsharp-v2';

// Önbelleğe alınacak dosyalar
const ASSETS = [
  './',
  './index.html',
  './wood_bg.png',
  './music.mp3',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  // CDN kütüphaneleri — ilk açılışta önbelleğe alınır
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
];

// ── INSTALL: tüm dosyaları önbelleğe al ─────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching assets...');
      // Her dosyayı tek tek dene — biri başarısız olsa diğerleri etkilenmesin
      return Promise.allSettled(
        ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn('[SW] Could not cache:', url, err)
          )
        )
      );
    }).then(() => {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: eski cache'leri temizle ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW] Activate complete');
      return self.clients.claim();
    })
  );
});

// ── FETCH: önce cache, sonra network ────────────────────────
self.addEventListener('fetch', (event) => {
  // Firebase / Google API isteklerini ATLAT — her zaman network'ten al
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis.com') ||
    event.request.url.includes('googletagmanager.com') ||
    event.request.url.includes('google-analytics.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            event.request.method === 'GET'
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
