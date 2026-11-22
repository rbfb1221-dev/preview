"use strict";

const cachePrefix = "window-repair-pwa-";
const cacheName = cachePrefix + "1";
const scope = new URL(self.registration.scope);
const home = scope.href;
const indexPath = new URL("index.html", scope).pathname;
const assetUrls = ["manifest.webmanifest", "icon-192.png", "icon-512.png"]
  .map(asset => new URL(asset, scope).href);
const cachedUrls = [home, ...assetUrls];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(cachedUrls.map(url => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== scope.origin) return;

  if (request.mode === "navigate" && [scope.pathname, indexPath].includes(url.pathname)) {
    event.respondWith(openPage(request));
    return;
  }

  if (assetUrls.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request);
      return cached || fetch(request);
    })());
  }
});

async function openPage(request) {
  const cache = await caches.open(cacheName);
  let response;
  try {
    response = await fetch(request);
  } catch {
    return (await cache.match(home)) || Response.error();
  }

  if (response.ok) {
    try {
      await cache.put(home, response.clone());
    } catch (error) {
      console.warn("Не удалось обновить офлайн-копию", error);
    }
  }
  return response;
}
