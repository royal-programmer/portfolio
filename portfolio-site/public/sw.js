/*
 * The terminal's service worker: hand-written, no libraries. One copy serves every host (each
 * host registers it with scope "/", so it caches that host's own pages).
 *
 *   precache   the shell (/, /?via=pwa), the résumé, the portrait, the manifest, the icons and
 *              the Next static files listed in /sw-manifest.json (written after `next build`
 *              by scripts/sw-manifest.mjs; absent in dev, where the list is empty and the
 *              worker only caches what the page actually asks for)
 *   pages      network first, 3 s timeout, then the cached copy, then the cached "/" shell
 *   /_next/static  cache first (hashed names never change); in dev, network first
 *   images, fonts, /og, pdf  stale while revalidate
 *   /api, api.github.com     never touched (always the network)
 *
 * Caches are named xp-v<build id>; activate deletes every other xp-* cache. A new worker takes
 * over at once (skipWaiting + clients.claim) and tells open pages, which show "update ready".
 * It is only registered in production builds, or in dev with localStorage["xp-sw-dev"] = "1".
 */

const META = "xp-meta"; // holds the build id between worker restarts
const SHELL = ["/", "/?via=pwa", "/resume.pdf", "/portrait.jpg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/apple-touch-icon.png"];
const NAV_TIMEOUT = 3000;

let build = null;

/** The build id, from memory or the meta cache ("dev" if neither knows). */
async function version() {
  if (build) return build;
  const hit = await (await caches.open(META)).match("/__build");
  build = hit ? await hit.text() : "dev";
  return build;
}
const cacheName = async () => `xp-v${await version()}`;
const open = async () => caches.open(await cacheName());

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // The generated list of static files; a 404 (dev) means an empty list.
      let files = [];
      build = "dev";
      try {
        const res = await fetch("/sw-manifest.json", { cache: "no-store" });
        if (res.ok) {
          const m = await res.json();
          build = String(m.build || "dev");
          files = Array.isArray(m.files) ? m.files : [];
        }
      } catch {}
      await (await caches.open(META)).put("/__build", new Response(build));
      const cache = await caches.open(`xp-v${build}`);
      // Each file on its own: one miss must not fail the install.
      await Promise.allSettled([...SHELL, ...files].map((u) => cache.add(new Request(u, { cache: "reload" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([META, await cacheName()]);
      for (const k of await caches.keys()) if (k.startsWith("xp-") && !keep.has(k)) await caches.delete(k);
      await self.clients.claim();
      // Pages that were already open learn that a new version is running.
      for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ type: "sw-updated", build: await version() });
    })(),
  );
});

/** Only complete, same-origin answers go in the cache. */
const cacheable = (res) => res && res.ok && res.status === 200 && res.type === "basic";

async function networkFirst(request, timeout) {
  const cache = await open();
  const url = new URL(request.url);
  try {
    const res = await Promise.race([fetch(request), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), timeout))]);
    if (cacheable(res)) {
      cache.put(request, res.clone());
      // The bare shell is the offline fallback; a copy with ?via= or ?run= would replay that arrival.
      if (request.mode === "navigate" && url.pathname === "/" && !url.search) cache.put("/", res.clone());
    }
    return res;
  } catch (err) {
    // Slow or offline: the cached copy of this page, else the shell. A late network answer is dropped.
    return (await cache.match(request)) || (request.mode === "navigate" ? await cache.match("/") : undefined) || Promise.reject(err);
  }
}

async function cacheFirst(request) {
  const cache = await open();
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await open();
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (cacheable(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit || (await fresh) || Response.error();
}

const STATIC_ASSET = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|pdf)$/i;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  // GitHub's API and our own /api are always live: no caching, no fallback.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // Router data fetches (RSC) are not documents; leave them to the network.
  if (request.headers.has("rsc") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") return void event.respondWith(networkFirst(request, NAV_TIMEOUT));
  if (url.pathname.startsWith("/_next/static/")) {
    // Hashed in production, so a hit is always right; dev chunks keep their names, so ask the network first.
    return void event.respondWith(version().then((v) => (v === "dev" ? networkFirst(request, NAV_TIMEOUT) : cacheFirst(request))));
  }
  if (url.pathname === "/og" || url.pathname.startsWith("/_next/image") || STATIC_ASSET.test(url.pathname)) return void event.respondWith(staleWhileRevalidate(request));
});
