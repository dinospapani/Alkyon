/* Alkyon 4 · service worker (μόνο για τον φάκελο v4/).
   Δικά μας αρχεία: πρώτα δίκτυο, αλλιώς αποθηκευμένο αντίγραφο. Γραμματοσειρές: αποθηκευμένο αντίγραφο πρώτα. */
const V = 'alkyon4-1.9.79';
const SHELL = ['./', 'index.html', 'errlog.js', 'app.css', 'forecast.css', 'core.js', 'ui.js', 'shell.js', 'lazy.js', 'clarity.js', 'forecast-view.js', 'forecast-more.js', 'advise.js', 'tripfill.js', 'common.js', 'store.js', 'account.js', 'bite-form.js', 'log-view.js', 'profile-view.js', 'log.css', 'map.css', 'polish.css', 'polish.js', 'fonts/commissioner-greek.woff2', 'fonts/commissioner-latin.woff2', 'fonts/commissioner-latin-ext.woff2', 'map-view.js', 'medland.js', 'wxfx.js', 'opps.js', 'coordpick.js', 'extras.js', 'seabed.js', 'bestspot.js', 'seareports.js', 'coordscan.js', 'portnotes.js', 'tackle-view.js', 'tackle-core.js', 'gear-view.js', 'boat-view.js', 'friends-view.js', 'community-view.js', 'trip.js', 'say.js', 'troll.js', 'trip-extra.js', 'autostart.js', 'night.js', 'bigtrip.js', 'records.js', 'live.js', 'help.js', 'sea-tools.js', 'smart.js', '../ext.js', '../divelog.js', '../coords.js', '../regions.js', '../windwatch.js', '../coastgrid.js', '../exposure.js', '../bitewx.js', 'alerts-view.js', 'cards.js', 'datatools.js', 'import-view.js', 'insights.js', 'years.js', 'backup.js', 'garmin.js', 'prefetch.js', 'syscheck.js', 'start-pick.js', 'alk-hero-boat.jpg', 'alk-hero.jpg', 'alk-card-shore.jpg', 'alk-card-boat.jpg', 'alk-hero-spear.jpg', 'alk-th-boatrod.jpg', 'alk-th-spear.jpg', 'alk-th-lake.jpg', 'alk-th-shorerod.jpg', '../species.js', '../rules.js', 'guide-core.js', 'guide-view.js', '../cy100.js', '../regions.js', '../knots.js', '../coastgrid.js', '../exposure.js', '../bathy-lines.js', '../windmap.js', '../windlocal.js', '../seastate.js', '../ruler.js', '../ports.js', '../orient.js', '../navigator.js', '../route.js', '../leaflet.js', '../leaflet.css', '../zones.js', '../dams_levels.json', '../version.js', '../hist.js', 'manifest.webmanifest',
  '../units.js', '../knowledge.js', '../i18n.js', '../i18n-en.js', '../forecast.js', '../personal.js', '../icon-192.png', '../migrate.js',
  /* 1.3.0: αρχεία που φορτώνονται αργότερα: αποθηκεύονται από την αρχή για να δουλεύουν offline χωρίς να έχουν ανοιχτεί πρώτα */
  '../tackle-lib.js', '../tackle-guide.js', '../fish-photos.js', '../cy100-en.js', '../push-config.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})) /* 1.3.3: χωρίς την HTTP cache, ώστε να μη μπουν παλιά αρχεία στη νέα έκδοση */)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('alkyon4-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
    e.respondWith(caches.open('alkyon-tiles').then(c => c.match(e.request.url, { ignoreVary: true })).then(r => r || fetch(e.request)));
    return;
  }
  /* v31z521: βάθη (EMODnet) και καιρός (Open-Meteo): πρώτα ό,τι κατέβασες, μετά το δίκτυο· χωρίς σήμα, η τελευταία απάντηση για το ίδιο αίτημα */
  if (/(^|\.)(emodnet-bathymetry\.eu|open-meteo\.com)$/.test(u.hostname)) {
    e.respondWith(caches.open('alkyon-tiles').then(c => c.match(e.request.url, { ignoreVary: true })).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open('alkyon-offdata').then(c => c.put(e.request.url, cp).then(() => { if (Math.random() < 0.04) c.keys().then(ks => { const n = ks.length - 900; for (let i = 0; i < n; i++) c.delete(ks[i]); }); })); }
      return r;
    }).catch(err => caches.open('alkyon-offdata').then(c => c.match(e.request.url)).then(r => { if (r) return r; throw err; }))));
    return;
  }
  /* 1.9.65: φωτογραφίες της Κοινότητας: δεν αλλάζουν ποτέ (κάθε αρχείο έχει μοναδικό όνομα) → πρώτα η αποθήκη, ανοίγουν αμέσως και χωρίς σήμα */
  if (u.hostname === 'sgfohmqwdwtkhtrebnix.supabase.co' && u.pathname.indexOf('/storage/v1/object/public/community/') === 0) {
    e.respondWith(caches.open('alkyon-comm-img').then(c => c.match(e.request.url).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); c.put(e.request.url, cp).then(() => { if (Math.random() < 0.05) c.keys().then(ks => { const n = ks.length - 400; for (let i = 0; i < n; i++) c.delete(ks[i]); }); }); }
      return r; }))));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(own(e));
});
/* v31z550: δικά μας αρχεία — πρώτα δίκτυο για να έρχονται αμέσως οι ενημερώσεις, ΑΛΛΑ αν το δίκτυο αργεί (αδύναμο σήμα στη θάλασσα)
   ή δεν υπάρχει, ανοίγει αμέσως από το αποθηκευμένο αντίγραφο και το δίκτυο συνεχίζει στο παρασκήνιο να ενημερώνει την αποθήκη. */
function own(e) {
  const nav = e.request.mode === 'navigate';
  const cached = () => caches.open(V).then(c => c.match(e.request, { ignoreSearch: nav }).then(r => r || (nav ? c.match('index.html') : undefined)));
  const net = fetch(new Request(e.request, { cache: 'no-cache' })).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; });
  e.waitUntil(net.then(() => {}, () => {}));
  if (self.navigator && self.navigator.onLine === false) return cached().then(r => r || net);
  /* 1.6.1: αρχεία της εφαρμογής (js, css, εικόνες, η σελίδα): πρώτα από τη μνήμη της ίδιας έκδοσης, αμέσως· το δίκτυο ανανεώνει στο παρασκήνιο.
     Η αποθήκη ανήκει σε μία έκδοση (V) και γεμίζει ολόκληρη στην εγκατάσταση, άρα τα αρχεία ταιριάζουν πάντα μεταξύ τους· μια νέα έκδοση
     έρχεται με το νέο sw.js και η εφαρμογή ξαναφορτώνει («Ενημερώθηκε»). Τα δεδομένα (.json) μένουν πρώτα δίκτυο. */
  if (!/\.json(\?|$)/.test(new URL(e.request.url).pathname)) return cached().then(r => r || net);
  return new Promise(resolve => {
    let done = false; const fin = r => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => cached().then(fin), nav ? 2500 : 2000);
    net.then(r => { clearTimeout(t); fin(r); }, () => { clearTimeout(t); cached().then(r => { if (r) fin(r); else if (!done) { done = true; resolve(Response.error()); } }); });
  });
}

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
      body: T('Γράφτηκε στο Ημερολόγιο. Πάτα ξανά για το επόμενο.', 'Saved to the Logbook. Tap again for the next one.'), tag: 'alkyon-trip', renotify: true, silent: false, requireInteraction: true, vibrate: [80],
      icon: '../icon-192.png', badge: '../badge-96.png', data: d, actions: n.actions && n.actions.length ? n.actions : [{ action: 'fish', title: T('🐟 Ψάρι εδώ', '🐟 Fish here') }, { action: 'lost', title: T('✕ Χάθηκε', '✕ Lost') }] }))
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true })).then(cs => cs.forEach(c => c.postMessage({ type: 'bc4q' }))));
    return;
  }
  n.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => /\/v4\//.test(x.url)); if (c) { c.postMessage({ type: 'bc4q' }); return c.focus(); } return self.clients.openWindow('./#map'); }));
});

