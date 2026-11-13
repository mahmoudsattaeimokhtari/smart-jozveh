const CACHE_NAME = 'smart-jozveh-v9';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith('smart-jozveh-') && name !== CACHE_NAME) await caches.delete(name);
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never cache credentials, Google traffic, or Vite development modules.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') ||
      event.request.method !== 'GET' || /\.(?:tsx?|jsx?)$/.test(url.pathname) ||
      url.pathname.includes('@') || url.pathname.startsWith('/node_modules/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') await cache.put(event.request, response.clone());
      return response;
    } catch {
      return (await cache.match(event.request)) || Response.error();
    }
  })());
});
