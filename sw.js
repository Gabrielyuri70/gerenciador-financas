const V = 'fp-v29';
const APP = ['./', 'index.html', 'style.css?v=29', 'app.js?v=29', 'manifest.json', 'img/icon-192.png', 'img/icon-512.png', 'img/perfil.jpg', 'img/perfil2.jpg'];
// Bibliotecas externas: baixadas uma vez na instalação e guardadas para uso sem internet
const CDN = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];
async function guardar(cache, url) { try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) { await cache.put(url, r.clone()); return r; } } catch (e) { } return null; }
self.addEventListener('install', e => e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all(APP.map(u => c.add(u).catch(() => { })));
    for (const u of CDN) {
        const r = await guardar(c, u);
        if (r && u.endsWith('all.min.css')) { // Font Awesome: guarda também os arquivos de fonte citados no CSS
            const css = await r.clone().text(), base = new URL('.', u);
            const fontes = [...new Set([...css.matchAll(/url\(["']?([^)"']+?\.(?:woff2|woff|ttf))[^)"']*["']?\)/g)].map(m => new URL(m[1], base).href))];
            await Promise.all(fontes.map(f => guardar(c, f)));
        }
    }
    self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url), mesmaOrigem = url.origin === location.origin;
    if (!mesmaOrigem) { // bibliotecas externas: cache primeiro (versões fixas)
        e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { const cp = r.clone(); caches.open(V).then(x => x.put(e.request, cp)); return r; })));
        return;
    }
    // arquivos do app: rede primeiro (sempre atualizado); sem internet usa o cache
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then(c => c || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
