"use strict";

/*
  Field Measurement service worker.

  Goal: the app must open and run with no signal on a job site, after it has
  been loaded online at least once.

  Strategy:
  - Precache the local app shell on install (must all succeed).
  - Best-effort precache the three cdnjs libraries (pdf.js, its worker, and
    html2pdf). A failure here does NOT abort install; they are runtime-cached
    on the first successful online load instead.
  - Same-origin files: serve from cache, refresh in the background.
  - cdnjs libraries: cache-first (the URLs are version-pinned and never change).

  Deploy note: bump CACHE_VERSION whenever you upload new app files so old
  cached copies are cleared and every device picks up the new version.
*/

const CACHE_VERSION = "field-measurement-combined-v1-v2-10";
const CACHE_NAME = CACHE_VERSION;

// Same-origin app shell, relative to the service worker location.
const APP_SHELL = [
  "./",
  "index.html",
  "style.css",
  "db.js",
  "save.js",
  "workspace.js",
  "app.js",
  "manifest.json",
  "lib/pdf.min.js",
  "lib/pdf.worker.min.js",
  "lib/html2pdf.bundle.min.js"
];

// Libraries are now hosted locally in /lib, so there are no cross-origin assets.
const CDN_ASSETS = [];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // App shell must all succeed, or the install fails and we keep the old SW.
    await cache.addAll(APP_SHELL);

    // Libraries are best-effort so one CDN hiccup cannot break installation.
    await Promise.all(CDN_ASSETS.map(async url => {
      try {
        const response = await fetch(url, { mode: "no-cors", cache: "reload" });
        await cache.put(url, response);
      } catch (error) {
        // Ignored on purpose: runtime caching will pick these up later.
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isCdn = url.hostname === "cdnjs.cloudflare.com";
  const isSameOrigin = url.origin === self.location.origin;

  // Anything else (analytics, other origins) is left to the browser.
  if (!isCdn && !isSameOrigin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: isCdn });

    if (cached) {
      // Version-pinned CDN files never change, so cache-first is final.
      if (isCdn) return cached;

      // Same-origin: serve instantly, then quietly refresh for next time.
      refreshInBackground(cache, request);
      return cached;
    }

    try {
      const network = await fetch(
        request,
        isCdn ? { mode: "no-cors" } : undefined
      );

      // Opaque responses (cross-origin no-cors) are fine to cache for <script>.
      if (network && (network.ok || network.type === "opaque")) {
        cache.put(request, network.clone()).catch(() => {});
      }

      return network;
    } catch (error) {
      // Fully offline and nothing cached: fall back to the app shell for pages.
      if (request.mode === "navigate") {
        const fallback =
          (await cache.match("index.html")) || (await cache.match("./"));

        if (fallback) return fallback;
      }

      throw error;
    }
  })());
});

function refreshInBackground(cache, request) {
  fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
    })
    .catch(() => {});
}
