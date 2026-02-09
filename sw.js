const CACHE_NAME = 'focus-coach-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css', // Verifique se o nome da sua pasta é 'css' ou 'styles'
  './js/main.js',
  './js/model.js',
  './js/view.js',
  './js/controller.js',
  './js/ai.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://unpkg.com/@phosphor-icons/web',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. Instalação: Cacheia os arquivos estáticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 2. Ativação: Limpa caches antigos se houver update
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// 3. Fetch: Intercepta as requisições (Cache First, Network Fallback)
self.addEventListener('fetch', (e) => {
  // Ignora requisições de API (AI) e Chrome Extensions
  if (e.request.url.includes('generativelanguage') || e.request.url.includes('api.openai') || e.request.url.startsWith('chrome-extension')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});