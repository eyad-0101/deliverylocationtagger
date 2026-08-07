// Minimal service worker. Two jobs only:
//   1. Make the app installable (a fetch handler is required by most
//      browsers' install criteria).
//   2. Cache a handful of static, never-changing assets (icons, manifest)
//      so the app shell loads instantly on repeat visits.
//
// Deliberately does NOT cache API responses, HTML pages, or anything
// auth-related — this app's whole point is showing live, server-side data
// (customer locations, live driver positions), and a stale-served page or
// cached /api/tags/search response would be actively misleading for a
// driver standing at a customer's door. Actual offline *writes* are
// already handled by lib/offlineQueue.ts, which is the correct layer for
// that (it queues real data, not a generic HTTP cache).

const CACHE_NAME = "delivery-tagger-shell-v1";
const SHELL_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellAsset = SHELL_ASSETS.includes(url.pathname);

  if (!isShellAsset) return; // let everything else hit the network normally

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});
