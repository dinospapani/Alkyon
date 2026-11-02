/* BiteCast 4 · service worker (μόνο για τον φάκελο v4/).
   Δικά μας αρχεία: πρώτα δίκτυο, αλλιώς αποθηκευμένο αντίγραφο. Γραμματοσειρές: αποθηκευμένο αντίγραφο πρώτα. */
const V = 'bitecast4-060';
const SHELL = ['./', 'index.html', 'app.css', 'forecast.css', 'core.js', 'ui.js', 'shell.js', 'clarity.js', 'forecast-view.js', 'forecast-more.js', 'advise.js', 'store.js', 'bite-form.js', 'log-view.js', 'profile-view.js', 'log.css', 'map.css', 'map-view.js', 'wxfx.js', 'opps.js', 'coordpick.js', 'extras.js', 'seabed.js', 'tackle-view.js', 'gear-view.js', 'boat-view.js', 'friends-view.js', 'community-view.js', 'trip.js', 'trip-extra.js', 'sea-tools.js', 'smart.js', '../ext.js', '../divelog.js', '../coords.js', '../regions.js', '../windwatch.js', '../coastgrid.js', '../exposure.js', '../bitewx.js', 'alerts-view.js', 'cards.js', 'datatools.js', 'import-view.js', 'insights.js', 'start-pick.js', 'bc-hero-boat.jpg', 'bc-card-shore.jpg', 'bc-card-boat.jpg', 'bc-hero-spear.jpg', 'bc-th-boatrod.jpg', 'bc-th-spear.jpg', 'bc-th-lake.jpg', 'bc-th-shorerod.jpg', '../species.js', '../rules.js', 'guide-core.js', 'guide-view.js', '../cy100.js', '../regions.js', '../knots.js', '../coastgrid.js', '../exposure.js', '../bathy-lines.js', '../windmap.js', '../windlocal.js', '../seastate.js', '../ruler.js', '../ports.js', '../orient.js', '../navigator.js', '../route.js', '../leaflet.js', '../leaflet.css', '../zones.js', '../dams_levels.json', '../version.js', '../hist.js', 'manifest.webmanifest',
  '../units.js', '../knowledge.js', '../i18n.js', '../forecast.js', '../personal.js', '../icon-192.png'];
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
  /* v31z521: βάθη (EMODnet) και καιρός (Open-Meteo): πρώτα ό,τι κατέβασες, μετά το δίκτυο· χωρίς σήμα, η τελευταία απάντηση για το ίδιο αίτημα */
  if (/(^|\.)(emodnet-bathymetry\.eu|open-meteo\.com)$/.test(u.hostname)) {
    e.respondWith(caches.open('psaro-tiles').then(c => c.match(e.request.url, { ignoreVary: true })).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open('psaro-offdata').then(c => c.put(e.request.url, cp).then(() => { if (Math.random() < 0.04) c.keys().then(ks => { const n = ks.length - 900; for (let i = 0; i < n; i++) c.delete(ks[i]); }); })); }
      return r;
    }).catch(err => caches.open('psaro-offdata').then(c => c.match(e.request.url)).then(r => { if (r) return r; throw err; }))));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(new Request(e.request, { cache: 'no-cache' }))
      .then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.open(V).then(c => c.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(r => r || (e.request.mode === 'navigate' ? c.match('index.html') : undefined))))
  );
});

/* v31z521: ειδοποίηση εξόδου με κουμπιά «Ψάρι εδώ» / «Χάθηκε». Φαίνεται και στο ρολόι (Garmin, Wear OS).
   Το πάτημα γράφεται εδώ (IndexedDB bc4q) χωρίς να ανοίξει η εφαρμογή· η εφαρμογή το περνά στο Ημερολόγιο με την ώρα του και τη θέση της διαδρομής. */
function qdb() { return new Promise((res, rej) => { const r = indexedDB.open('bc4q', 1); r.onupgradeneeded = () => r.result.createObjectStore('q', { autoIncrement: true }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function qadd(v) { return qdb().then(db => new Promise((res, rej) => { const tx = db.transaction('q', 'readwrite'); tx.objectStore('q').add(v); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); })); }
self.addEventListener('notificationclick', e => {
  const n = e.notification, d = n.data || {};
  if (!d.bc4trip) return;
  const en = d.lang === 'en', T = (a, b) => en ? b : a;
  if (e.action === 'fish' || e.action === 'lost') {
    const miss = e.action === 'lost', t = Date.now(), hm = new Date(t).toLocaleTimeString(en ? 'en-GB' : 'el-GR', { hour: '2-digit', minute: '2-digit', hour12: false });
    e.waitUntil(qadd({ t: t, miss: miss }).then(() => self.registration.showNotification(miss ? T('✕ Χάθηκε, ', '✕ Lost, ') + hm : T('🐟 Ψάρι, ', '🐟 Catch, ') + hm, {
      body: T('Γράφτηκε στο Ημερολόγιο. Πάτα ξανά για το επόμενο.', 'Saved to the Logbook. Tap again for the next one.'), tag: 'psaro-trip', renotify: true, silent: false, requireInteraction: true, vibrate: [80],
      icon: '../icon-192.png', badge: '../icon-192.png', data: d, actions: n.actions && n.actions.length ? n.actions : [{ action: 'fish', title: T('🐟 Ψάρι εδώ', '🐟 Fish here') }, { action: 'lost', title: T('✕ Χάθηκε', '✕ Lost') }] }))
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true })).then(cs => cs.forEach(c => c.postMessage({ type: 'bc4q' }))));
    return;
  }
  n.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => /\/v4\//.test(x.url)); if (c) { c.postMessage({ type: 'bc4q' }); return c.focus(); } return self.clients.openWindow('./#map'); }));
});

