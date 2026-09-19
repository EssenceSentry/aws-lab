/* Generated at build time. URLs are relative to the GitHub Pages project scope. */
const BUILD = "__BUILD__";
const CORE_FILES = __CORE_FILES__;
const BASE = self.registration.scope;
const PREFIX = "waypoint-" + new URL(BASE).pathname + "-";
const CORE_CACHE = PREFIX + "core-" + BUILD;
const IMAGE_CACHE = PREFIX + "images-v1";
const absolute = (path) => new URL(path, BASE).href;

self.addEventListener("install", (event) => {
  // A new build reuses data URLs. Fetch their current bytes instead of carrying
  // fresh-but-obsolete HTTP-cache entries into the new versioned app cache.
  const requests = CORE_FILES.map((path) => new Request(absolute(path), { cache: "reload" }));
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(requests)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX + "core-") && key !== CORE_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !request.url.startsWith(BASE)) return;
  if (url.pathname.startsWith(new URL("data/images/", BASE).pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch { return new Response("Diagram is not saved offline.", { status: 503 }); }
    })());
  } else if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(4000) });
        if (response.ok) return response;
      } catch { /* Fall through to the saved app shell. */ }
      return await caches.match(absolute("index.html")) ?? new Response("Connect to the internet to finish setup.", { status: 503 });
    })());
  } else if (CORE_FILES.some((path) => absolute(path) === url.origin + url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      return cached ?? fetch(request);
    })());
  }
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (!["OFFLINE_STATUS", "DOWNLOAD_IMAGES"].includes(event.data?.type)) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      const core = await caches.open(CORE_CACHE);
      const response = await core.match(absolute("data/image-manifest.json"));
      if (!response) throw new Error("Offline setup is incomplete.");
      const manifest = await response.json();
      const cache = await caches.open(IMAGE_CACHE);
      const saved = new Set((await cache.keys()).map((request) => request.url));
      const urls = manifest.images.map((path) => absolute("data/" + path));
      const missing = urls.filter((url) => !saved.has(url));
      let cached = urls.length - missing.length;
      const status = (done) => port.postMessage({ cached, total: urls.length, bytes: manifest.bytes, done });
      if (event.data.type === "OFFLINE_STATUS") { status(true); return; }
      status(false);
      let cursor = 0;
      let failed = false;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (cursor < missing.length && !failed) {
          const url = missing[cursor++];
          try {
            const image = await fetch(url, { signal: AbortSignal.timeout(30000) });
            if (!image.ok) throw new Error("A diagram could not be downloaded.");
            await cache.put(url, image);
            cached++;
            status(false);
          } catch (error) { failed = true; throw error; }
        }
      }));
      status(true);
    } catch {
      port.postMessage({ error: "The download was interrupted. Reconnect and try again; diagrams already saved will be kept." });
    }
  })());
});
