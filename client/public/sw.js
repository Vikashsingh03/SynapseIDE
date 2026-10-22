const CACHE_NAME = 'synapse-cache-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];
const STATIC_DESTINATIONS = ['script', 'style', 'image', 'font'];
const SW_ORIGIN = typeof self !== 'undefined' && self.location ? self.location.origin : null;

function routeFor(request) {
  if (!request || request.method !== 'GET') return 'bypass';
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return 'bypass';
  }
  if (SW_ORIGIN && url.origin !== SW_ORIGIN) return 'bypass';
  if (url.pathname.includes('/api/') || url.pathname.includes('socket.io')) return 'bypass';
  if (request.mode === 'navigate') return 'navigate';
  if (STATIC_DESTINATIONS.includes(request.destination) || url.pathname.startsWith('/assets/')) return 'static';
  return 'passthrough';
}

async function handleNavigate(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const fallback = await cache.match('/index.html');
    return fallback || Response.error();
  }
}

async function handleStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const response = await network;
  return response || Response.error();
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(APP_SHELL))
        .then(() => self.skipWaiting())
    );
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
        .then(() => self.clients.claim())
    );
  });
  self.addEventListener('fetch', (event) => {
    const route = routeFor(event.request);
    if (route === 'navigate') {
      event.respondWith(handleNavigate(event.request));
    } else if (route === 'static') {
      event.respondWith(handleStatic(event.request));
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { routeFor };
}
