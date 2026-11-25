// Offline support. Network first: when online, always load the latest files
// (revalidating past the browser's HTTP cache); fall back to the saved copy
// only when offline.
const CACHE = 'money-lab-v3';
const FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'charts.js', 'finance.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// GitHub Pages tells browsers files stay fresh for 10 minutes, so the browser
// would reuse its in-memory copy without even asking. Re-label every response
// "no-cache" so each open checks for a newer version.
function noCache(res) {
  if (!res || res.type === 'opaque') return res;
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return noCache(res);
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(noCache)),
  );
});
