// Service worker: cache the app shell so the app works offline. Bump VERSION when files change.
const VERSION = 'sde-recon-v2';
const FILES = ['./', 'index.html', 'style.css', 'calc.js', 'config.js', 'app.js', 'manifest.webmanifest',
  'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Cache-first, fall back to network
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
