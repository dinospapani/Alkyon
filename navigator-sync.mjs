/* Alkyon: ενημέρωση του navigator-mpa.json από το ProtectedSeas Navigator API (CC BY 4.0).
   Τρέχει μηνιαία από GitHub Actions (navigator-sync.yml). Δεν χρειάζεται κλειδί: το API είναι ανοιχτό για ανάγνωση.
   Διαδικασία (data-synchronization της τεκμηρίωσης):
     1. type=sites_updated&changed_since=<ημερομηνία>&include_inactive=true
     2. active: upsert με βάση το ps_id (μόνο περιοχές που κρατάμε), removed: διαγραφή
     3. σταματά (χωρίς αλλαγή αρχείου) αν η απάντηση φαίνεται κομμένη ή θα έσβηνε πολλές περιοχές
     4. γράφει στο v την ημερομηνία που ΞΕΚΙΝΗΣΕ ο συγχρονισμός, μόνο αν πέτυχε
   Όριο API: 5 αιτήματα ανά 10 δευτερόλεπτα, άρα ≥2.2 s ανάμεσα στα αιτήματα. */
import fs from 'node:fs';

export const BASE = 'https://map.navigatormap.org';
export const KEEP = new Set(['Cyprus', 'Greece', 'Turkey', 'Israel', 'Lebanon', 'Egypt', 'Syria', 'Libya', 'Palestine']);
const UA = 'Alkyon-sync/1.0 (fishing app, contact: dinospapanicolaou@gmail.com)';
const PAGE = 200;
const MAX_REMOVE_FRAC = 0.1;   /* πάνω από 10% διαγραφές: σταμάτα */
const MAX_SHRINK_FRAC = 0.1;

/* ---------- γεωμετρία (ίδια λογική με το reduce.py) ---------- */
function dp(pts, tol) {
  const n = pts.length; if (n <= 4) return pts;
  const keep = new Array(n).fill(false); keep[0] = keep[n - 1] = true;
  const st = [[0, n - 1]], t2 = tol * tol;
  while (st.length) {
    const [a, b] = st.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let d;
      if (L2 === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); const cx = ax + t * dx, cy = ay + t * dy; d = (px - cx) ** 2 + (py - cy) ** 2; }
      if (d > md) { md = d; mi = i; }
    }
    if (md > t2) { keep[mi] = true; st.push([a, mi]); st.push([mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r5 = v => Math.round(v * 1e5) / 1e5;
function ring(r, tol) {
  const p = r.map(c => [c[0], c[1]]);          /* GeoJSON: [lon, lat] */
  let q = dp(p, tol); if (q.length < 4) q = p.length >= 4 ? p.slice(0, 4) : p;
  return q.map(([x, y]) => [r5(y), r5(x)]);     /* αποθηκεύουμε [lat, lon] */
}
export function toRings(geom, country) {
  if (!geom || !geom.type || !geom.coordinates) return null;
  const tol = country === 'Cyprus' ? 0.00003 : 0.0002;
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : geom.type === 'Polygon' ? [geom.coordinates] : null;
  if (!polys) return null;
  const G = polys.map(poly => poly.map(r => ring(r, tol))).filter(poly => poly.length && poly[0].length >= 4);
  return G.length ? G : null;
}
function bboxOf(G) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const poly of G) for (const [la, lo] of poly[0]) { if (la < a) a = la; if (lo < b) b = lo; if (la > c) c = la; if (lo > d) d = lo; }
  return [a, b, c, d];
}
/* Έλεγχος λογικής: η περιοχή μας είναι περίπου lat 28–40, lon 20–40. Αν φαίνεται αντεστραμμένο, σταμάτα. */
export function plausible(G) { const [a, b, c, d] = bboxOf(G); return a > 25 && c < 42 && b > 15 && d < 45; }

function trunc(s, n) {
  if (!s) return '';
  s = String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
  s = s.split(/\s+/).filter(Boolean).join(' ');
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+$/, '') + '…';
}
/* Κρατάμε ό,τι κρατούσε το reduce.py. */
export function wanted(p) {
  return p && KEEP.has(p.country) && p.category_id !== 9 && p.lfp != null && p.lfp !== 0;
}
export function compact(p, G) {
  return {
    i: p.ps_id, n: trunc(p.site_name, 120), c: p.country, d: trunc(p.designation, 60), k: p.category_id, l: p.lfp,
    rf: p.recreational_fishing, hl: p.hook_and_line, tr: p.trolling, sp: p.spear_fishing, an: p.anchoring, en: p.entry, dv: p.diving,
    pu: trunc(p.purpose, 300), re: trunc(p.restrictions, 420), rn: trunc(p.regulation_name, 160), rs: trunc(p.regulation_source, 160),
    ma: trunc(p.managing_authority, 80), se: trunc(p.season, 60), u: p.last_update,
    pm: typeof p.percent_marine_area === 'number' ? Math.round(p.percent_marine_area * 10) / 10 : undefined,   /* 1.11.4: % θάλασσας (οι περιοχές σχεδόν όλες στη στεριά κρύβονται) */
    b: bboxOf(G), g: G
  };
}

/* ---------- δίκτυο ---------- */
export function makeClient(fetchFn, sleep) {
  let last = 0;
  return async function get(path) {
    const wait = 2200 - (Date.now() - last); if (wait > 0) await sleep(wait);
    last = Date.now();
    const r = await fetchFn(BASE + path, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + path);
    try { return await r.json(); } catch (e) { throw new Error('Μη έγκυρο JSON ' + path); }
  };
}

const iso = ms => new Date(ms).toISOString().slice(0, 10);

export async function sync({ file, fetchFn = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), now = Date.now(), log = console.log, since }) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const local = doc.f || []; const byId = new Map(local.map(f => [f.i, f]));
  if (local.length < 50) throw new Error('Το τοπικό αρχείο φαίνεται ελλιπές (' + local.length + ')');
  const startDate = iso(now);
  const from = since || iso(Date.parse(doc.v + 'T00:00:00Z') - 7 * 86400000);
  const get = makeClient(fetchFn, sleep);

  /* 1. λίστα αλλαγών */
  const changes = [];
  for (let page = 1; page <= 200; page++) {
    const j = await get('/api/search/?type=sites_updated&changed_since=' + from + '&include_inactive=true&lang=en_EN&limit=' + PAGE + '&page=' + page);
    const arr = j && j.sites;
    if (!Array.isArray(arr)) throw new Error('Η απάντηση δεν έχει πίνακα sites (σελίδα ' + page + ')');
    changes.push(...arr);
    if (arr.length < PAGE) break;
    if (page === 200) throw new Error('Πάρα πολλές σελίδες, σταματώ');
  }
  log('Αλλαγές από ' + from + ': ' + changes.length);

  /* 2. διαχωρισμός */
  const removed = new Set(), active = new Map();
  for (const s of changes) {
    if (!s || !s.ps_id) continue;
    if (s.status === 'removed') removed.add(s.ps_id);
    else {
      const prev = active.get(s.ps_id);
      const ver = (s.site_major_version || 0) * 1e6 + (s.site_minor_version || 0);
      if (!prev || ver >= prev.ver) active.set(s.ps_id, { s, ver });
    }
  }
  for (const id of active.keys()) removed.delete(id);   /* ενεργή νεότερη έκδοση υπερισχύει */

  /* 3. έλεγχοι ασφαλείας πριν γίνει οτιδήποτε */
  const toRemove = [...removed].filter(id => byId.has(id));
  if (toRemove.length > Math.max(5, local.length * MAX_REMOVE_FRAC)) throw new Error('Θα διαγράφονταν ' + toRemove.length + ' περιοχές. Σταματώ χωρίς αλλαγή.');

  /* 4. upsert */
  const next = new Map(byId);
  let upd = 0, add = 0, skip = 0, noGeo = 0, light = 0;
  const cy = [];   /* 1.11.4: αλλαγές σε περιοχές της Κύπρου → ειδοποίηση για έλεγχο του zones.js (Τμήμα Αλιείας) */
  const noteCy = (f, what) => { if (f && f.c === 'Cyprus') cy.push(what + ': ' + f.n + ' (' + f.i + ')'); };
  for (const { s } of active.values()) {
    const had = byId.get(s.ps_id);
    if (s.country && !wanted(s)) { if (had) { next.delete(s.ps_id); upd++; noteCy(had, 'αφαιρέθηκε'); } skip++; continue; }  /* δεν μας αφορά (πια) */
    /* Ανά μέρος ημερομηνίες (Alex, 14/11/2026): όριο ξανά μόνο αν last_boundary_update ≥ from, Site Details μόνο αν last_details_update ≥ from.
       Αν δεν ισχύει κανένα, η εγγραφή του sites_updated αρκεί (κρατάμε όριο και κείμενα που δεν έχει). Νέα περιοχή ή χωρίς τα πεδία: όλα όπως πριν. */
    const dB = s.last_boundary_update, dD = s.last_details_update;
    const known = !!had && typeof dB === 'string' && typeof dD === 'string';
    const needB = !known || dB.slice(0, 10) >= from, needD = !known || dD.slice(0, 10) >= from;
    let d = null;
    if (needB || needD) d = await get('/api/detail/?ps_id=' + encodeURIComponent(s.ps_id) + '&lang=en_EN' + (needB ? '&export_boundaries=true' : ''));
    else light++;
    const p = Object.assign({}, s, d && typeof d === 'object' ? d : {});
    if (!needD && had) { for (const [k, hk] of [['purpose', 'pu'], ['restrictions', 're'], ['regulation_name', 'rn'], ['regulation_source', 'rs'], ['managing_authority', 'ma'], ['season', 'se'], ['designation', 'd'], ['site_name', 'n']]) if (p[k] == null && had[hk]) p[k] = had[hk]; }
    if (!wanted(p)) { if (had) { next.delete(s.ps_id); upd++; noteCy(had, 'αφαιρέθηκε'); } skip++; continue; }
    let G = needB ? toRings(p.site_boundary || (d && d.boundary) || null, p.country) : null;
    if (!G) { if (had) G = had.g; else { noGeo++; continue; } }   /* χωρίς όρια δεν σχεδιάζεται */
    if (!plausible(G)) { log('Εκτός περιοχής ή ύποπτες συντεταγμένες, παραλείπεται: ' + s.ps_id); if (had) next.delete(s.ps_id); skip++; continue; }   /* π.χ. τουρκικές περιοχές στη Μαύρη Θάλασσα */
    const nf = compact(p, G); next.set(s.ps_id, nf);
    if (!had || JSON.stringify([had.l, had.rf, had.hl, had.tr, had.sp, had.an, had.se, had.re, had.g]) !== JSON.stringify([nf.l, nf.rf, nf.hl, nf.tr, nf.sp, nf.an, nf.se, nf.re, nf.g])) noteCy(nf, had ? 'άλλαξε' : 'νέα');
    had ? upd++ : add++;
  }
  for (const id of toRemove) { noteCy(byId.get(id), 'διαγράφηκε'); next.delete(id); }

  /* 5. τελικός έλεγχος */
  if (next.size < local.length * (1 - MAX_SHRINK_FRAC)) throw new Error('Το αρχείο θα μίκραινε από ' + local.length + ' σε ' + next.size + '. Σταματώ.');
  const out = [...next.values()].sort((a, b) => (a.c !== 'Cyprus') - (b.c !== 'Cyprus') || a.c.localeCompare(b.c) || a.n.localeCompare(b.n));
  const changed = add + upd + toRemove.length > 0;
  log('Προσθήκες ' + add + ', ενημερώσεις ' + upd + ' (' + light + ' μόνο από την εγγραφή συγχρονισμού), διαγραφές ' + toRemove.length + ', παραλείφθηκαν ' + skip + ', χωρίς όρια ' + noGeo + '. Σύνολο ' + out.length);
  if (changed) fs.writeFileSync(file, JSON.stringify({ v: startDate, f: out }));
  else if (doc.v !== startDate) fs.writeFileSync(file, JSON.stringify({ v: startDate, f: local }));
  return { changed, add, upd, light, removed: toRemove.length, total: out.length, from, v: startDate, cy };
}

if (process.argv[1] && process.argv[1].endsWith('navigator-sync.mjs')) {
  sync({ file: process.env.NAV_FILE || 'navigator-mpa.json', since: process.env.NAV_SINCE || undefined })
    .then(r => { console.log(JSON.stringify(r)); if (process.env.NAV_CY_OUT && r.cy && r.cy.length) fs.writeFileSync(process.env.NAV_CY_OUT, r.cy.join('\n') + '\n'); })
    .catch(e => { console.error('ΣΦΑΛΜΑ: ' + e.message); process.exit(1); });
}
