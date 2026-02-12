const CACHE_NAME = 'focus-coach-v1.0-production';

const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './js/model.js',
    './js/view.js',
    './js/controller.js',
    './js/ai.js', // Importante garantir que o cérebro novo esteja aqui
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://unpkg.com/@phosphor-icons/web',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'
];

self.addEventListener('install', (e) => {
    // Força o SW a ativar imediatamente
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    // Garante que o SW controle a página imediatamente
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Estratégia: Network First, falling back to Cache (Mais seguro para desenvolvimento)
    // Mas para PWA offline puro, usamos Cache First. Vamos manter Cache First.

    if (e.request.url.includes('http') && !e.request.url.includes('chrome-extension')) {
        e.respondWith(
            caches.match(e.request).then((response) => {
                return response || fetch(e.request).catch(() => {
                    // Se falhar tudo (offline e sem cache), retorna nada ou página de erro
                    return null;
                });
            })
        );
    }
});