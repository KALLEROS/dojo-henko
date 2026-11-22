// Service worker de Dojo Henko: guarda la página para abrirla sin señal.
// IMPORTANTE: sube el número de VERSION cada vez que cambies un archivo de la página.
const VERSION = "dojo-henko-v1";
const ARCHIVOS = [
  "./", "index.html", "estilos.css", "app.js", "config.js", "datos-respaldo.js", "manifest.json",
  "img/logo.png", "img/tatami.jpg", "img/favicon.png", "img/icono-192.png", "img/icono-512.png", "img/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // La Hoja de Google y el mapa siempre van a internet (los datos frescos los guarda app.js)
  if (/docs\.google\.com|google\.com\/maps|maps\.google/.test(url.href)) return;

  // Fuentes de Google: guardar al primer uso
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req); c.put(req, r.clone()); return r;
    }));
    return;
  }

  if (url.origin !== location.origin) return;
  // Archivos propios: internet primero, copia guardada si no hay señal
  e.respondWith(fetch(req).then(r => {
    const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return r;
  }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
});
