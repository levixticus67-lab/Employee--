const CACHE = "lenz-v3";

// Only pre-cache the offline fallback page — NOT index.html
// (index.html changes on every deploy; caching it causes stale app shells)
const PRECACHE = [];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => PRECACHE.length ? c.addAll(PRECACHE) : Promise.resolve())
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip non-http(s) requests
  if (!["http:", "https:"].includes(url.protocol)) return;

  // Skip cross-origin requests entirely — let the browser handle Cloudinary,
  // Firebase Storage, Google APIs, etc. directly with no SW interference
  if (url.origin !== self.location.origin) return;

  // Skip API calls — always fresh from the server
  if (url.pathname.startsWith("/api/")) return;

  // Hashed static assets (JS/CSS/fonts from Vite) — safe to cache forever
  // because the hash changes with every content change
  const isHashedAsset = url.pathname.startsWith("/assets/");

  if (isHashedAsset) {
    // Cache-first for immutable assets
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML pages (index.html / app shell) — network-first so deploys are instant,
  // fall back to cache only when truly offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached ?? new Response("Offline", { status: 503 })))
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes("/admin") && "focus" in c) return c.focus();
      }
      return clients.openWindow ? clients.openWindow("/admin/orders") : undefined;
    })
  );
});
