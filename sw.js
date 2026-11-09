/* AYSO Field Worksheet: offline support and Google Drive sync.
 *
 * - Keeps a copy of the app on the device so it opens with no signal.
 * - Each time the app opens with a connection, it quietly fetches the newest
 *   index.html; the new version is used the next time the app is opened.
 * - When the connection comes back, PDFs waiting on the device are sent to
 *   Google Drive, even if the app has been closed (Chrome on Android).
 */
importScripts('drive.js');

const VERSION = 'v2';
const APP_CACHE = 'ayso-worksheet-' + VERSION;
const FONT_CACHE = 'ayso-fonts';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
const SHELL = ['./', './index.html', './config.js', './drive.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})));
    try { await cacheFonts(); } catch (e) { /* fonts are optional; system fonts are used offline */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ayso-worksheet-') && k !== APP_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFonts(){
  const cache = await caches.open(FONT_CACHE);
  const res = await fetch(FONT_CSS, {mode: 'cors'});
  if (!res.ok) return;
  await cache.put(FONT_CSS, res.clone());
  const css = await res.text();
  const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
  await Promise.all(urls.map(async u => {
    if (await cache.match(u)) return;
    const r = await fetch(u, {mode: 'cors'});
    if (r.ok) await cache.put(u, r);
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(fromCacheThenRefresh(event, './index.html'));
    } else if (SHELL.some(p => new URL(p, self.location).href === url.href)) {
      event.respondWith(fromCacheThenRefresh(event, req));
    }
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('', {status: 504});
      }
    })());
  }
});

/* Answer from the saved copy straight away, and refresh the copy in the background. */
async function fromCacheThenRefresh(event, request){
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(request, {ignoreSearch: true});
  const refresh = fetch(request, {cache: 'no-cache'}).then(res => {
    if (res && res.ok) return cache.put(request, res.clone()).then(() => res);
    return res;
  }).catch(() => null);
  if (hit) { event.waitUntil(refresh); return hit; }
  const res = await refresh;
  return res || new Response('Offline, and the app has not been saved on this device yet. Open it once with a connection.', {status: 503, headers: {'Content-Type': 'text/plain'}});
}

/* ---------------- Google Drive sync ---------------- */
/* When the connection comes back, Chrome wakes this worker (even with the app
   closed) and any PDFs waiting on the device are sent to Google Drive.
   If the Google sign-in has run out, they wait until the app is next opened. */
async function syncNow(){
  const r = await self.AYSODrive.flush();
  if (r && r.sent) for (const c of await self.clients.matchAll({includeUncontrolled: true})) c.postMessage({type: 'drive-synced', count: r.sent});
}
self.addEventListener('sync', event => {
  if (event.tag === 'drive-sync') event.waitUntil(syncNow());
});
self.addEventListener('periodicsync', event => {
  if (event.tag === 'drive-sync') event.waitUntil(syncNow().catch(() => {}));
});
