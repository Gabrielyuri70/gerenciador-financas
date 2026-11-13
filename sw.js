const V = 'fp-v18';
const APP = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(APP)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => { // rede primeiro (sempre atualizado); sem internet usa o cache (inclui Bootstrap/Chart.js já baixados)
    if (e.request.method !== 'GET') return;
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
