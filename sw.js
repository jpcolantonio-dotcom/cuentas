// Libreta de Gastos — service worker
// Bump this whenever you deploy a new index.html/manifest/icons so old
// installed copies pick up the change instead of serving a stale cache.
var CACHE_NAME = "libreta-gastos-shell-v4";
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  var url = new URL(req.url);

  // Only handle our own shell files. Everything else (Supabase API calls,
  // Google Fonts, etc.) goes straight to the network untouched — the data
  // in this app must always be fresh, never served from a cache.
  if (url.origin !== self.location.origin || req.method !== "GET") return;

  // Network-first: always try to fetch the latest index.html/manifest/icons
  // when there's a connection, and only fall back to the cached copy if the
  // network fails (actually offline). This is what makes a new deploy show
  // up the very next time you open the app — a "cache-first" strategy here
  // would keep serving the OLD index.html indefinitely, which is exactly
  // what made it look like updates weren't landing.
  //
  // Critically, this fetch must bypass the browser's own HTTP cache too:
  // GitHub Pages serves every file with "Cache-Control: max-age=600", so a
  // plain fetch() here could still hand back a copy from BEFORE your last
  // deploy for up to 10 minutes — which is exactly the "F5 goes back to
  // the old version, but clearing the cache fixes it" symptom. Forcing
  // cache:"no-store" makes every check a real round trip to the server.
  event.respondWith(
    fetch(req, { cache: "no-store" }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
