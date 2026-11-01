/* BiteCast 4 · service worker (μόνο για τον φάκελο v4/).
   Δικά μας αρχεία: πρώτα δίκτυο, αλλιώς αποθηκευμένο αντίγραφο. Γραμματοσειρές: αποθηκευμένο αντίγραφο πρώτα. */
const V = 'bitecast4-038';
const SHELL = ['./', 'index.html', 'app.css', 'forecast.css', 'core.js', 'ui.js', 'shell.js', 'forecast-view.js', 'forecast-more.js', 'advise.js', 'store.js', 'bite-form.js', 'log-view.js', 'profile-view.js', 'log.css', 'map.css', 'map-view.js', 'tackle-view.js', 'gear-view.js', 'boat-view.js', 'friends-view.js', 'community-view.js', 'trip.js', 'trip-extra.js', 'sea-tools.js', 'smart.js', '../ext.js', '../divelog.js', '../coords.js', '../regions.js', '../windwatch.js', '../coastgrid.js', '../exposure.js', '../bitewx.js', 'alerts-view.js', 'cards.js', 'datatools.js', 'insights.js', 'start-pick.js', 'bc-hero-boat.jpg', 'bc-card-shore.jpg', 'bc-card-boat.jpg', 'bc-hero-spear.jpg', 'bc-th-boatrod.jpg', 'bc-th-spear.jpg', 'bc-th-shorerod.jpg', '../species.js', '../rules.js', 'guide-core.js', 'guide-view.js', '../cy100.js', '../regions.js', '../knots.js', '../coastgrid.js', '../exposure.js', '../bathy-lines.js', '../windmap.js', '../windlocal.js', '../seastate.js', '../ruler.js', '../ports.js', '../orient.js', '../navigator.js', '../route.js', '../leaflet.js', '../leaflet.css', '../zones.js', '../dams_levels.json', '../version.js', '../hist.js', 'manifest.webmanifest',
  '../units.js', '../knowledge.js', '../forecast.js', '../personal.js', '../icon-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bitecast4-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(V).then(c => c.match(e.request).then(r => r || fetch(e.request).then(n => { if (n.ok || n.type === 'opaque') c.put(e.request, n.clone()); return n; }))));
    return;
  }
  /* πλακίδια χάρτη: πρώτα όσα κατέβασες για χρήση χωρίς σήμα (κοινή αποθήκη με την κλασική) */
  if (/(^|\.)(arcgisonline\.com|tile\.openstreetmap\.org|openseamap\.org)$/.test(u.hostname)) {
    e.respondWith(caches.open('psaro-tiles').then(c => c.match(e.request.url, { ignoreVary: true })).then(r => r || fetch(e.request)));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(new Request(e.request, { cache: 'no-cache' }))
      .then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.open(V).then(c => c.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(r => r || (e.request.mode === 'navigate' ? c.match('index.html') : undefined))))
  );
});
