'use strict';
// Cache simples para jogar offline. Tenta a rede primeiro; se falhar, usa o cache.
const CACHE = 'fio-do-destino-v7';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'js/data.js', 'js/cartas.js', 'js/cenarios.js', 'js/logic.js', 'js/mapas.js', 'js/minis.js', 'js/tatica.js', 'js/vendor/three.min.js', 'js/modelos3d.js', 'js/cena3d.js', 'js/tutorial.js', 'js/ui.js', 'manifest.json', 'icon.svg'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
