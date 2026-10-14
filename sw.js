// Solo se guarda en caché la "carcasa" de la app. NUNCA se guardan datos de socios.
const C = 'citec-consulta-v5';
const SHELL = ['./', 'index.html', 'app.js', 'supabase.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase y demás: directo a la red
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
