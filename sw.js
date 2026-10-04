/* Tract service worker: keeps the app shell available offline. County data always comes live from the network. */
var VERSION = "tract-v5";
var SHELL = ["./", "index.html", "css/app.css", "js/localities.js", "js/firms.js", "js/core.js", "js/map.js", "js/parcel.js", "js/search.js",
  "js/network.js", "js/activity.js", "js/sites.js", "js/saved.js", "js/settings.js", "js/app.js",
  "data/states.json", "data/va-localities.json", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Boundary files rarely change: serve from cache first so the map draws instantly on a phone
  if (/\/data\/[^/]+\.json$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); return res; });
      return hit || net;
    }));
    return;
  }
  // Network first so updates show up right away; fall back to the cached shell offline.
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); }); }));
});
