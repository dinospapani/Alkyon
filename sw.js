// Network first for the app's own files so updates arrive at once; cache is the offline fallback.
// Weather APIs and fonts are cross-origin and always go straight to the network.
importScripts('forecast.js');
const V = 'alkyon-1.5.1';
const CFG = 'alkyon-cfg';
/* 1.4.2: η κλασική αποσύρθηκε, οπότε εδώ μένουν μόνο οι σελίδες της ρίζας (ανακατεύθυνση στο v4/) και τα εικονίδια.
   Τα αρχεία της εφαρμογής τα κρατά για offline το v4/sw.js. Πριν κατέβαιναν εδώ ~6 MB σε κάθε ενημέρωση. */
const SHELL = ['./', 'index.html', 'classic.html', 'migrate.js', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
const cfgUrl = () => new URL('__cfg', self.registration.scope).href;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})) /* 1.3.3: χωρίς την HTTP cache, ώστε να μη μπουν παλιά αρχεία στη νέα έκδοση */)).then(() => self.skipWaiting()));
});
/* 1.0.0: μεταφορά από τα παλιά ονόματα (BiteCast/Ψαρόβαρκα): ρυθμίσεις ειδοποιήσεων, πλακίδια χάρτη και πρόγνωση εκτός σύνδεσης */
const OLD = 'psa' + 'ro-';
/* αντιγραφή ένα-ένα (όσα λείπουν), με τη διεύθυνση /Pasrovarka/ → /Alkyon/· το παλιό σβήνεται μόνο αν πέτυχε όλη η αντιγραφή */
async function moveOld(ks) {
  const ok = [];
  for (const n of ['cfg', 'tiles', 'offdata']) {
    if (!ks.includes(OLD + n)) continue;
    try { const a = await caches.open(OLD + n), b = await caches.open('alkyon-' + n);
      for (const rq of await a.keys()) { const u = rq.url.replace(/\/[Pp]asrovarka\//, '/Alkyon/');
        if (await b.match(u, { ignoreVary: true })) continue; const r = await a.match(rq); if (r) await b.put(u, r); }
      ok.push(OLD + n); } catch (e) {}
  }
  return ok;
}
const KEEP = [CFG, 'alkyon-tiles', 'alkyon-offdata'];
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => moveOld(ks).then(moved => Promise.all(ks.filter(k => k !== V && !KEEP.includes(k) && !k.startsWith('alkyon4-') && (!k.startsWith(OLD) || moved.includes(k))).map(k => caches.delete(k))))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'GET' && u.origin !== location.origin && /(^|\.)(arcgisonline\.com|tile\.openstreetmap\.org|openseamap\.org)$/.test(u.hostname)) {
    e.respondWith(caches.open('alkyon-tiles').then(c => c.match(e.request.url, { ignoreVary: true })).then(r => r || fetch(e.request)));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(new Request(e.request, { cache: 'no-cache' }))
      .then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match(new URL(e.request.url).pathname.endsWith('classic.html') ? 'classic.html' : 'index.html')))
  );
});
async function readCfg() {
  try { const r = await (await caches.open(CFG)).match(cfgUrl()); return r ? await r.json() : null; } catch (e) { return null; }
}
async function writeCfg(cfg) {
  try { await (await caches.open(CFG)).put(cfgUrl(), new Response(JSON.stringify(cfg))); } catch (e) {}
}
/* ιστορικό ειδοποιήσεων στη συσκευή (το διαβάζει το inbox.js της σελίδας) */
const inboxUrl = () => new URL('__inbox', self.registration.scope).href;
async function inboxAdd(it) {
  try {
    const c = await caches.open(CFG), r = await c.match(inboxUrl());
    let a = []; try { a = r ? await r.json() : []; } catch (e) { a = []; }
    if (!Array.isArray(a)) a = [];
    if (it.id && a.some(x => x.id === it.id)) return;
    a.unshift(it); a = a.slice(0, 400);
    await c.put(inboxUrl(), new Response(JSON.stringify(a)));
  } catch (e) {}
}
async function showMsg(m, src) {
  const id = m.id || ('n' + Date.now() + Math.random().toString(36).slice(2, 6));
  const it = { id, at: m.at || new Date().toISOString(), kind: m.kind || 'info', title: m.title || 'Alkyon', body: m.body || '', full: m.full || m.body || '', place: m.place || null, t: m.t || null, locs: m.locs || null, src: src || 'push' };
  await inboxAdd(it);
  await self.registration.showNotification(it.title, { body: it.body, tag: m.tag || ('alk-' + id), renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: self.registration.scope + '#inbox=' + encodeURIComponent(id) } });
}
async function runCheck() {
  const cfg = await readCfg();
  if (!cfg || !cfg.on || cfg.server) return;
  /* v31z539: ώρες ησυχίας 23:00–07:00 (ώρα Κύπρου) */
  if (cfg.quiet !== false) { let hh = new Date().getHours(); try { hh = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }) % 24; } catch (e) {} if (hh >= 23 || hh < 7) { if (!(cfg.plans && cfg.plans.length)) return; cfg.onlyPlans = true; } }
  try {
    if ((cfg.places && cfg.places.length) || (cfg.plans && cfg.plans.length)) {
      const r = await PF.checkPlaces(cfg);
      cfg.notified = r.notified; delete cfg.onlyPlans; await writeCfg(cfg);
      if (r.msgs && r.msgs.length) { for (const m of r.msgs) await showMsg({ title: m.title, body: m.body, full: m.full, kind: m.kind, id: m.key, place: m.place, t: m.t }, 'local'); }
      else if (r.items.length) await showMsg({ title: r.title, body: r.body, full: r.body, kind: 'info' }, 'local');
    }
  } catch (e) {}
}
/* v31z394: ειδοποίηση 7 μέρες πριν την επέτειο ψαρέματος (λίστα από τη σελίδα, __anniv) */
async function annivCheck() {
  try {
    const c = await caches.open(CFG), r = await c.match(new URL('__anniv', self.registration.scope).href);
    if (!r) return; const a = await r.json(); if (!a || !a.on || !Array.isArray(a.items)) return;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' });
    const su = new URL('__annivSeen', self.registration.scope).href, sr = await c.match(su);
    let seen = {}; try { seen = sr ? await sr.json() : {}; } catch (x) { seen = {}; }
    let ch = false; const en = a.lang === 'en', G = {};
    for (const it of a.items) { if (!it || seen[it.id] || it.due > today || (it.end || it.ann) < today) continue; (G[it.ann] = G[it.ann] || []).push(it); }
    for (const ann of Object.keys(G).sort()) {
      const its = G[ann].sort((x, y) => (y.id > x.id ? 1 : -1)), n = Math.round((Date.parse(ann) - Date.parse(today)) / 86400000);
      const when = n <= 0 ? (its[0].end ? (en ? 'This week' : 'Αυτή την εβδομάδα') : (en ? 'Today' : 'Σήμερα')) : n === 1 ? (en ? 'Tomorrow' : 'Αύριο') : (en ? 'In ' + n + ' days' : 'Σε ' + n + ' μέρες');
      const title = when + ': ' + its.map(i => i.title).join(en ? ' and ' : ' και ');
      const body = its.map(i => i.body).join('\n');
      its.forEach(i => { seen[i.id] = today; }); ch = true;
      try { await showMsg({ id: 'anniv-' + ann, title, body, full: body, kind: 'info', tag: 'anniv-' + ann, locs: [].concat(...its.map(i => i.locs || [])).slice(0, 6) }, 'local'); } catch (x) {}
    }
    if (ch) { Object.keys(seen).forEach(k => { if (Date.parse(seen[k]) < Date.now() - 400 * 86400000) delete seen[k]; }); await c.put(su, new Response(JSON.stringify(seen))); }
  } catch (e) {}
}
self.addEventListener('message', e => {
  if (e.data && e.data.annivCheck) e.waitUntil(annivCheck());
  /* v31z398: μήνυμα από τη σελίδα (π.χ. «ίδιες συνθήκες με παλιά ψαριά»): στο ιστορικό και ως ειδοποίηση */
  if (e.data && e.data.localMsg) { const m = e.data.localMsg; e.waitUntil(m.notify === false ? inboxAdd({ id: m.id, at: new Date().toISOString(), kind: m.kind || 'info', title: m.title, body: m.body, full: m.full || m.body, place: null, t: null, locs: m.locs || null, src: 'local' }) : showMsg(m, 'local').catch(() => {})); }
});
self.addEventListener('periodicsync', e => { if (e.tag === 'alkyon-forecast') e.waitUntil(Promise.all([runCheck(), annivCheck()])); });
/* v31z550: με την ειδοποίηση του πλάνου («Αύριο βγαίνεις», «Ώρα να ξεκινήσεις»), κατεβαίνουν χάρτης και πρόγνωση της περιοχής,
   για χρήση χωρίς σήμα, ακόμα κι αν η εφαρμογή είναι κλειστή. Ρύθμιση: Ειδοποιήσεις › Πριν την έξοδο (cfg.pf). */
async function planPrefetch(d) {
  try {
    const p = d && d.place; if (!p || p.lat == null || !/^\d{4}-\d{2}-\d{2}$/.test(d.t || '')) return;
    const cfg = await readCfg(); if (!cfg || cfg.pf === 'off') return;
    const pl = (cfg.plans || []).find(x => x.date === d.t && Math.abs(x.lat - p.lat) < 0.05 && Math.abs(x.lon - p.lon) < 0.05); if (!pl) return;
    const c = self.navigator && self.navigator.connection; if (cfg.pf === 'wifi' && c && c.type && !/wifi|ethernet|wimax/.test(c.type)) return;
    const tp = cfg.tiles || { sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sea: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png' };
    const lat = +pl.lat, lon = +pl.lon, r = Math.PI / 180, list = [];
    const tx = (lo, z) => Math.floor((lo + 180) / 360 * 2 ** z), ty = (la, z) => { const s = Math.sin(la * r); return Math.floor((.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z); };
    for (const [z, km] of [[9, 35], [10, 25], [11, 15], [12, 10], [13, 6], [14, 3.5], [15, 2]]) {
      const dLa = km / 111, dLo = km / (111 * Math.cos(lat * r));
      for (let x = tx(lon - dLo, z); x <= tx(lon + dLo, z); x++) for (let y = ty(lat + dLa, z); y <= ty(lat - dLa, z); y++) {
        const f = t => t.replace('{z}', z).replace('{x}', x).replace('{y}', y); list.push(f(tp.sat)); if (z >= 11) list.push(f(tp.sea)); } }
    const tc = await caches.open('alkyon-tiles'); let i = 0;
    const worker = async () => { while (i < list.length) { const u = list[i++]; try { if (await tc.match(u)) continue; const res = await fetch(u, { mode: 'cors', credentials: 'omit' }); if (res.ok) await tc.put(u, res); } catch (x) {} } };
    /* η πρόγνωση: ίδιες διευθύνσεις με την εφαρμογή, στην αποθήκη alkyon-offdata */
    const od = await caches.open('alkyon-offdata');
    const ff = (u, o) => fetch(u, o).then(res => { if (res.ok) od.put(u, res.clone()).catch(() => {}); return res; });
    await Promise.all([worker(), worker(), worker(), worker(), PF.getForecast(lat, lon, ff, { days: 7 }).catch(() => null)]);
  } catch (x) {}
}
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { try { d = { body: e.data.text() }; } catch (e2) {} }
  if (!d.body) d.body = 'Άνοιξε την εφαρμογή για την πρόγνωση.';
  e.waitUntil(showMsg(d, 'push').then(() => planPrefetch(d)).then(async () => {
    /* v31z366: τελεία/αριθμός στο εικονίδιο της εφαρμογής και ανανέωση της ένδειξης «αδιάβαστες» στις ανοιχτές σελίδες */
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch (x) {}
    try { const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); cs.forEach(c => c.postMessage({ inboxNew: 1 })); } catch (x) {}
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  const m = /#inbox=([^&]*)/.exec(url), id = m ? decodeURIComponent(m[1]) : null;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { if (id) c.postMessage({ inbox: id }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
