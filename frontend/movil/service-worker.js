"use strict";

const CACHE_VERSION = "pdv-gardenias-v2";
const APP_SHELL = [
  "./",
  "./login.html",
  "./dashboard.html",
  "./index.html",
  "./productos.html",
  "./inventario.html",
  "./entradas.html",
  "./movimientos-caja.html",
  "./cortes.html",
  "./ajustes-inventario.html",
  "./ventas-historial.html",
  "./venta-detalle.html",
  "./importes.html",
  "./fiados.html",
  "./promociones.html",
  "./traspasos.html",
  "./traspaso-detalle.html",
  "./reportes.html",
  "./usuarios.html",
  "./config-terminal.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.jpg",
  "./icons/icon-512.jpg",
  "./icons/icon-512-maskable.jpg",
  "../assets/gardenia.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(response => response || caches.match("./login.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      }))
  );
});
