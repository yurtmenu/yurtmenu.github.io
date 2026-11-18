// Uygulamayı internetsiz de açılır yapan önbellek.
// 60a43f5 yayın sırasında otomatik doldurulur; elle değiştirmeye gerek yok.
const VERSION = 'yurtmenu-60a43f5';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
// Menü verisi sürümden ayrı durur: uygulama güncellenince silinmesin, internetsiz de açılsın.
const DATA_CACHE = 'yurtmenu-veri';
const DATA_PATH = new URL('data/menu.json', self.registration.scope).pathname;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // cache: 'reload' -> tarayıcının kendi önbelleğindeki eski kopyayı değil, sunucudaki yenisini al
    await cache.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})));
    // İlk açılışta sayfa menüyü bu çalışan devreye girmeden alır; internetsiz açılış için burada da saklanır.
    try {
      const res = await fetch(DATA_PATH, {cache: 'no-cache'});
      if (res.ok) await (await caches.open(DATA_CACHE)).put(DATA_PATH, res);
    } catch (err) { /* internet yoksa eldeki veri kalır */ }
    // v2'den geçişte beklemeden devral (v2'nin "yenile" bildirimi yok)
    if (await caches.has('yurtmenu-v1')) self.skipWaiting();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('yurtmenu-') && k !== VERSION && k !== DATA_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/panel')) return; // istatistik paneli ayrı sayfa, menü ona karışmaz

  // Menü verisi: önce internetten (her zaman güncel), yoksa önbellekten
  if (url.pathname.includes('/data/')) {
    e.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      try {
        const res = await fetch(req, {cache: 'no-cache'});
        if (res.ok) cache.put(url.pathname, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(url.pathname)) || new Response('{}', {status: 503, headers: {'Content-Type': 'application/json'}});
      }
    })());
    return;
  }

  // Uygulama dosyaları: önbellekten (yeni sürüm uygulama arka plana alınınca ya da Ayarlar'daki yenile tuşuyla gelir)
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, {ignoreSearch: true}) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('Çevrimdışı', {status: 503});
    }
  })());
});
