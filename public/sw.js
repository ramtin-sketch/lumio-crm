/* Netz zuerst, damit Updates sofort ankommen. Ohne Netz kommt die letzte Fassung aus dem Speicher. */
const C = 'lumio-v4-1';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(DATEIEN))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  // Nur die App selbst zwischenspeichern, nie Daten aus der Datenbank
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const kopie = r.clone(); caches.open(C).then(c => c.put(e.request, kopie)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
