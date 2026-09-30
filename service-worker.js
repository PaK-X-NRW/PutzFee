/* =========================================================================
   service-worker.js – Offline-Cache (App-Shell), wie in Noten-Fritze
   Cache-first für die statischen Dateien. Nutzdaten liegen in IndexedDB
   und werden vom Service Worker nicht angefasst.
   ========================================================================= */
// Cache-Name = App-Version (js/version.js). Erhöhen von APP_VERSION liefert
// installierten PWAs eine neue App-Shell – nur zusammen mit
// `updateViaCache: "none"` bei der Registrierung in js/app.js, sonst kommt
// version.js bei der Update-Prüfung aus dem HTTP-Cache (GitHub Pages:
// max-age=600) und der Sprung bleibt unbemerkt.
importScripts("./js/version.js");
const CACHE = "putzfee-" + self.APP_VERSION;
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/version.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/calc.js",
  "./js/moebel.js",
  "./js/haus.js",
  "./js/demo.js",
  "./js/store.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      // Neue Same-Origin-Antworten opportunistisch cachen
      const copy = res.clone();
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
