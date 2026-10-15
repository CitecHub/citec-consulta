// Solo se guarda en caché la "carcasa" de la app. NUNCA se guardan datos de socios.
const C = 'citec-consulta-v12';
const SHELL = ['./', 'index.html', 'app.js', 'supabase.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'logo-blanco.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => Promise.all(SHELL.map(f => c.add(f).catch(() => null))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase y demás: directo a la red
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
