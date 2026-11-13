// =============================================================
// Kule Savaşları - servis çalışanı (ana ekrana ekleme + çevrimdışı kopya)
// Oyunu güncelleyip yüklerken ONBELLEK numarasını 1 artır.
// =============================================================

const ONBELLEK = 'kule-savaslari-v16';
const DOSYALAR = [
  './', 'index.html', 'style.css', 'fizik.js', 'bot.js', 'ses.js', 'sahne.js', 'ag.js', 'oyun.js',
  'manifest.webmanifest', 'ikonlar/ikon-192.png', 'ikonlar/ikon-512.png',
];

self.addEventListener('install', olay => {
  olay.waitUntil(caches.open(ONBELLEK).then(o => o.addAll(DOSYALAR.map(d => new Request(d, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', olay => {
  olay.waitUntil(caches.keys().then(adlar => Promise.all(adlar.filter(a => a !== ONBELLEK).map(a => caches.delete(a)))));
  self.clients.claim();
});
// Önce internet (en yeni sürüm), olmazsa kayıtlı kopya
self.addEventListener('fetch', olay => {
  if (olay.request.method !== 'GET') return;
  const ayniSite = new URL(olay.request.url).origin === self.location.origin;
  olay.respondWith(
    (ayniSite ? fetch(olay.request.url, { cache: 'no-cache' }) : fetch(olay.request))
      .then(cevap => { if (cevap.ok && ayniSite) { const k = cevap.clone(); caches.open(ONBELLEK).then(o => o.put(olay.request, k)); } return cevap; })
      .catch(() => caches.match(olay.request)),
  );
});
