// @ts-nocheck
// Supabase Edge Function «watch» (v31z552, v31z553): η εφαρμογή Alkyon στο ρολόι Garmin.
//   GET  /functions/v1/watch?lat=34.9&lon=32.4[&code=ABC123]  → σύντομη πρόγνωση (ίδιος βαθμός με την εφαρμογή, από το forecast.js)
//   POST /functions/v1/watch  {code, t, lat, lon, kind:'fish'|'miss'|'pest', n, trip}  → γράφει το ψάρι στο Ημερολόγιο του χρήστη
//   GET  /functions/v1/watch?grid=1&lat=..&lon=..[&code=..]  → 1.9.72: χάρτης βυθού γύρω από το σημείο (συρτή βυθού στο ρολόι)
//   POST /functions/v1/watch  {code, kind:'undo'|'upd', cid[, miss, sp]}  → 1.9.75: αναίρεση/αλλαγή ψαριού από το ρολόι
//   POST /functions/v1/watch  {code, kind:'trip', ts, te, tz, tid, n, pts:[[lat,lon,ts],…]}  → 1.1.0: έξοδος από το ρολόι
// Το «code» είναι ο κωδικός σύνδεσης ρολογιού (Προφίλ › Ρολόι Garmin στην εφαρμογή, πίνακας watch_links, βλ. watch-link.sql).
// Χρειάζεται: Verify JWT = off. Τα SUPABASE_URL και SUPABASE_SERVICE_ROLE_KEY υπάρχουν ήδη σε κάθε Edge Function.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const J = (o, status = 200, cache = 'no-store') => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache, ...CORS } });
const SRC = 'https://dinospapani.github.io/Alkyon/forecast.js';
const mem = { pf: null, pfAt: 0, fc: new Map(), codes: new Map() };
const env = (k) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : (globalThis.process && process.env[k])) || '';

export async function loadPF(F = fetch, now = Date.now()) {
  if (mem.pf && now - mem.pfAt < 6 * 3600e3) return mem.pf;
  const src = await (await F(SRC + '?v=' + Math.floor(now / 3600e3))).text();
  const g = {}; new Function('self', src)(g); if (!g.PF) throw new Error('forecast.js');
  mem.pf = g.PF; mem.pfAt = now; return mem.pf;
}
async function sb(F, path, opt = {}) {
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('service key');
  const r = await F(url + '/rest/v1/' + path, { ...opt, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  return r;
}
export async function userOf(F, code, now = Date.now()) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length < 6) return null;
  const c = mem.codes.get(code); if (c && now - c.at < 600e3) return c.v;
  const r = await sb(F, 'watch_links?select=user_id,lang&code=eq.' + code + '&limit=1'); if (!r.ok) return null;
  const a = await r.json(); const v = a && a[0] ? a[0] : null; mem.codes.set(code, { at: now, v }); return v;
}
const DAYS_EL = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'], DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const bft = (kn) => kn == null ? null : [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64].findIndex(x => kn < x) === -1 ? 12 : [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64].findIndex(x => kn < x);
const r1 = (x) => x == null ? null : Math.round(x * 10) / 10;
/* σύντομη μορφή για το ρολόι (μικρή μνήμη): ως 6 μέρες + οι επόμενες 12 ώρες + πίεση */
export function compact(PF, fc, en, lat = null, lon = null) {
  const now = fc.nowLocal.slice(0, 13) + ':00', today = fc.nowLocal.slice(0, 10);
  const days = fc.days.filter(d => d.date >= today).slice(0, 6).map(d => {
    const dt = new Date(d.date + 'T12:00:00Z');
    return { n: d.date === today ? (en ? 'Today' : 'Σήμερα') : (en ? DAYS_EN : DAYS_EL)[dt.getUTCDay()] + ' ' + dt.getUTCDate(), s: d.safe ? d.best : null,
      w: d.safe && d.win ? String(d.win.s).padStart(2, '0') + '-' + String((d.win.e + 1) % 24).padStart(2, '0') : '', b: bft(d.wx && d.wx.windMax != null ? d.wx.windMax : d.avgWind), v: r1(d.wx && d.wx.waveMax != null ? d.wx.waveMax : d.avgWave), x: d.safe ? 0 : 1 };
  });
  const hrs = []; fc.days.forEach(d => d.hours.forEach(h => { if (h.t >= now && hrs.length < 12) hrs.push({ h: h.hr, s: h.score != null ? Math.round(h.score) : null, b: bft(h.wind), v: r1(h.wave), p: h.pres != null ? r1(h.pres) : null }); }));   // 1.2.0: με ένα δεκαδικό, για ομαλό γράφημα στο ρολόι
  let pr = null; try { const ev = PF.pressureEvent(fc); if (ev) pr = { d: r1(ev.d), h: ev.hours, t: ev.t.slice(11, 16), from: Math.round(ev.from), to: Math.round(ev.to) }; } catch (e) {}
  const cur = hrs[0] || {};
  /* 1.2.0: σημερινές 24 ώρες για το δαχτυλίδι του ρολογιού: βαθμός ανά ώρα (-1 = όχι ασφαλής), ανατολή/δύση σε λεπτά από τα μεσάνυχτα, καλύτερο παράθυρο */
  let td = null; const d0 = fc.days.find(d => d.date === today);
  if (d0) { const h = new Array(24).fill(-1); d0.hours.forEach(x => { if (x.hr >= 0 && x.hr < 24) h[x.hr] = x.safe && x.score != null ? Math.round(x.score) : -1; });
    td = { h, r: d0.rise != null ? Math.round(d0.rise) : null, st: d0.set != null ? Math.round(d0.set) : null, ws: d0.safe && d0.win ? d0.win.s : null, we: d0.safe && d0.win ? d0.win.e : null };
    /* 1.2.2: ηλιοσεληνιακές περίοδοι σήμερα (κέντρο, λεπτά από τα μεσάνυχτα): ma = κύριες, mi = δευτερεύουσες */
    try { if (lat != null && lon != null && PF.sunMoon) { const sm = PF.sunMoon(today, lat, lon, Number.isFinite(+fc.tz) ? +fc.tz : 120), inDay = (m) => m >= 0 && m < 1440;
      td.ma = (sm.maj || []).filter(inDay).map(Math.round); td.mi = (sm.min || []).filter(inDay).map(Math.round); } } catch (e) {} }
  /* 1.2.2: επόμενο καλό παράθυρο (σήμερα ή αύριο) για την ειδοποίηση «σε 30′» στο ρολόι: ts σε δευτερόλεπτα UTC */
  let bw = null; try { const tz = Number.isFinite(+fc.tz) ? +fc.tz : 120, nowS = Date.now() / 1000;
    for (const d of fc.days.filter(x => x.date >= today).slice(0, 2)) { if (!d.safe || !d.win) continue; const ts = Math.round((Date.parse(d.date + 'T' + String(d.win.s).padStart(2, '0') + ':00:00Z') - tz * 60000) / 1000);
      if (ts > nowS) { bw = { ts, s: Math.round(d.best), w: String(d.win.s).padStart(2, '0') + '-' + String((d.win.e + 1) % 24).padStart(2, '0') }; break; } } } catch (e) {}
  /* 1.9.69: καλαμάρι για τη σελίδα του ρολογιού: il = φωτισμός φεγγαριού %, nd = μέρες ως τη νέα σελήνη, dk = σκοτάδι απόψε [αρχή, τέλος σε λεπτά, 1 = ως το πρωί],
     ev = τα καλύτερα βράδια γύρω από τη νέα σελήνη (έως 3: όνομα μέρας, ώρα, βαθμός) */
  let sq = null; try { const tz = Number.isFinite(+fc.tz) ? +fc.tz : 120, nowMs = Date.now(), nm = PF.nextMoon ? PF.nextMoon(nowMs) : {}, il = PF.moonPhase ? Math.round(PF.moonPhase(nowMs).illum * 100) : null;
    const d0 = fc.days.find(d => d.date === today); let dk = null;
    if (d0 && lat != null && PF.darkWin) { const w = PF.darkWin(today, d0.set, d0.rise, lat, lon, tz); if (w) dk = [Math.round(w.s), Math.round(w.e), w.why === 'dawn' ? 1 : 0]; }
    const dn = (date) => { if (date === today) return en ? 'Today' : 'Σήμερα'; const dt = new Date(date + 'T12:00:00Z'); return (en ? DAYS_EN : DAYS_EL)[dt.getUTCDay()] + ' ' + dt.getUTCDate(); };
    const nwNear = (PF.nextMoon(nowMs - 3.5 * 864e5) || {}).nw;   // 1.9.70: η νέα σελήνη που πέρασε ως 3,5 μέρες πριν (όπως στην εφαρμογή), όχι η επόμενη του μήνα
    const ev = PF.squidEves ? PF.squidEves(fc.days.filter(d => d.date >= today), nwNear, { now: fc.nowLocal.slice(0, 13) + ':00', lat, lon, tz }).slice(0, 3).map(e => ({ n: dn(e.date), h: e.hr, s: Math.round(e.score), ss: e.set != null ? Math.round(e.set) : null })) : [];   // 1.9.70: ss = δύση (λεπτά)
    /* αν η νέα σελήνη πέρασε τις τελευταίες 4 μέρες, nd < 0 («πριν 2 μέρες»): είναι ακόμα καλή περίοδος */
    let nd = nm.nw ? (nm.nw - nowMs) / 864e5 : null; try { const pm = PF.nextMoon(nowMs - 4 * 864e5).nw; if (pm && pm <= nowMs) nd = -(nowMs - pm) / 864e5; } catch (e) {}
    /* 1.9.70: wx = 1 όταν το φεγγάρι μεγαλώνει (αύξουσα), για τη φάση και το σχέδιο στο ρολόι */
    let wx = null; try { if (nd != null) wx = nd < 0 || nd > 14.8 ? 1 : 0; } catch (e) {}
    sq = { il, nd: nd == null ? null : Math.round(nd * 10) / 10, dk, ev, wx }; } catch (e) {}
  return { ok: 1, now: { s: cur.s, b: cur.b, v: cur.v, p: cur.p }, days, hrs, pr, tn: turns(PF, fc), at: fc.nowLocal.slice(11, 16), td, bw, sq };
}
/* v31z553: καμπές πίεσης (ίδιες με την ειδοποίηση της εφαρμογής, PF.pressureTurns): k = 'peak' (κορυφή → μετά πέφτει) ή 'low' (πάτος → μετά ανεβαίνει),
   ts = ώρα σε δευτερόλεπτα UTC, t = τοπική ώρα ΩΩ:ΛΛ, p = hPa. Μόνο από 1 ώρα πριν ως 24 ώρες μετά. */
export function turns(PF, fc) {
  const out = []; let a = []; try { a = PF.pressureTurns(fc) || []; } catch (e) { a = []; }
  const tz = Number.isFinite(+fc.tz) ? +fc.tz : 120, now = Date.now() / 1000;
  for (const e of a) {
    const ts = Math.round((Date.parse(e.t + ':00Z') - tz * 60000) / 1000);
    if (!Number.isFinite(ts) || ts < now - 3600 || ts > now + 24 * 3600) continue;
    out.push({ k: /^peak/.test(e.kind) ? 'peak' : 'low', ts, t: e.t.slice(11, 16), p: Math.round(e.p) });
  }
  return out.slice(0, 4);
}
function rid() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function localParts(ms, tzMin) { const d = new Date(ms + tzMin * 60000); const iso = d.toISOString(); return { date: iso.slice(0, 10), time: iso.slice(11, 16) }; }
/* ώρα Κύπρου (ή της ζώνης που στέλνει το ρολόι) */
function tzOf(ms) { try { const s = new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour12: false }); const m = s.match(/(\d+)\/(\d+)\/(\d+),? (\d+):(\d+)/); const loc = Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] % 24, +m[5]); return Math.round((loc - ms) / 60000); } catch (e) { return 120; } }


/* ---------- 1.9.72: χάρτης βυθού για τη συρτή βυθού στο ρολόι ----------
   GET /functions/v1/watch?grid=1&lat=..&lon=..[&code=..] → πλέγμα EMODnet (~115 m) ±1,3 km γύρω από το σημείο, βάθος σε μέτρα (0 = στεριά/κενό).
   Με code: μπαίνουν και οι διορθώσεις βυθομέτρου του χρήστη (alkyon-dcorr από τις ρυθμίσεις της εφαρμογής), όπως στο κινητό.
   Κελί (i, j): κέντρο lon = x0 + i·dx, lat = y0 − j·dy (πρώτη γραμμή = βόρεια). */
const WCS = 'https://ows.emodnet-bathymetry.eu/wcs', CELL = 1 / 960;
export function parseTiff(buf) {
  const dv = new DataView(buf), le = dv.getUint16(0) === 0x4949; if (!le && dv.getUint16(0) !== 0x4d4d) throw new Error('tiff');
  if (dv.getUint16(2, le) !== 42) throw new Error('tiff magic');
  const ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le), tg = {}, SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12, tag = dv.getUint16(o, le), typ = dv.getUint16(o + 2, le), cnt = dv.getUint32(o + 4, le), size = (SZ[typ] || 1) * cnt, p = size <= 4 ? o + 8 : dv.getUint32(o + 8, le); let vals = [];
    if (typ === 3) for (let k = 0; k < cnt; k++) vals.push(dv.getUint16(p + k * 2, le));
    else if (typ === 4) for (let k = 0; k < cnt; k++) vals.push(dv.getUint32(p + k * 4, le));
    else if (typ === 12) for (let k = 0; k < cnt; k++) vals.push(dv.getFloat64(p + k * 8, le));
    else if (typ === 2) { let s = ''; for (let k = 0; k < cnt; k++) { const ch = dv.getUint8(p + k); if (ch) s += String.fromCharCode(ch); } vals = [s]; }
    else if (typ === 16) for (let k = 0; k < cnt; k++) vals.push(Number(dv.getBigUint64(p + k * 8, le)));
    tg[tag] = vals;
  }
  const w = tg[256][0], h = tg[257][0], bits = (tg[258] || [32])[0], comp = (tg[259] || [1])[0], fmt = (tg[339] || [3])[0];
  if (comp !== 1 || bits !== 32 || fmt !== 3) throw new Error('tiff format');
  const data = new Float32Array(w * h);
  if (tg[324]) { const tw = tg[322][0], th = tg[323][0], tx = Math.ceil(w / tw), offs = tg[324];
    for (let t = 0; t < offs.length; t++) { const ox = (t % tx) * tw, oy = Math.floor(t / tx) * th; for (let y = 0; y < th && oy + y < h; y++) for (let x = 0; x < tw && ox + x < w; x++) data[(oy + y) * w + ox + x] = dv.getFloat32(offs[t] + (y * tw + x) * 4, le); } }
  else { const rps = (tg[278] || [h])[0], so = tg[273]; let row = 0; for (let si = 0; si < so.length; si++) for (let r = 0; r < rps && row < h; r++, row++) for (let x = 0; x < w; x++) data[row * w + x] = dv.getFloat32(so[si] + (r * w + x) * 4, le); }
  let x0, y0, dx, dy; const M = tg[34264], S = tg[33550], P = tg[33922];
  if (M && M.length >= 8) { dx = M[0]; x0 = M[3]; dy = M[5]; y0 = M[7]; } else if (S && P) { dx = S[0]; dy = -S[1]; x0 = P[3]; y0 = P[4]; } else throw new Error('georef');
  return { w, h, data, x0, y0, dx, dy };
}
const wcsUrl = (b, interp = 'bilinear') => WCS + '?service=wcs&version=1.0.0&request=getcoverage&coverage=emodnet:mean&crs=EPSG:4326&bbox=' + [b.w, b.s, b.e, b.n].join(',') + '&format=image/tiff&interpolation=' + interp + '&resx=' + CELL + '&resy=' + CELL;
const tmo = (ms) => { try { return AbortSignal.timeout(ms); } catch (e) { return undefined; } };
/* το WCS μπορεί να δίνει υψόμετρο (θάλασσα < 0) ή βάθος (θάλασσα > 0): ένα σημείο βαθιάς θάλασσας νότια της Κύπρου το ξεκαθαρίζει (όπως η εφαρμογή) */
async function dSign(F) {
  if (mem.dsign) return mem.dsign;
  const r = await F(wcsUrl({ w: 33.19, s: 34.19, e: 33.21, n: 34.21 }, 'nearest'), { signal: tmo(12000) }); if (!r.ok) throw new Error('wcs ' + r.status);
  const g = parseTiff(await r.arrayBuffer()); let sum = 0; for (const v of g.data) sum += v; mem.dsign = sum < 0 ? -1 : 1; return mem.dsign;
}
function distM(a1, o1, a2, o2) { const R = 6371000, dl = (a2 - a1) * Math.PI / 180, dn = (o2 - o1) * Math.PI / 180, x = Math.sin(dl / 2) ** 2 + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
/* ίδιος τύπος με το corrAt της εφαρμογής (v4/troll.js): σταθμισμένος μέσος των διορθώσεων ως 2 km, που σβήνει μακριά από τις μετρήσεις */
export function corrAt(cs, lat, lon) { let sw = 0, sv = 0; for (const c of cs) { const d = distM(lat, lon, c[0], c[1]); if (d > 2000) continue; const w = 1 / Math.max(d, 60) ** 2; sw += w; sv += w * c[2]; }
  if (!sw) return 0; return sv / sw * Math.min(1, sw * 300 ** 2); }
export async function depthGrid(F, lat, lon, cs = [], rad = 1300) {
  const dla = rad / 111320, dlo = rad / (111320 * Math.cos(lat * Math.PI / 180));
  const b = { w: +(lon - dlo).toFixed(4), e: +(lon + dlo).toFixed(4), s: +(lat - dla).toFixed(4), n: +(lat + dla).toFixed(4) };
  const sg = await dSign(F);
  const r = await F(wcsUrl(b), { signal: tmo(12000) }); if (!r.ok) throw new Error('wcs ' + r.status);
  const g = parseTiff(await r.arrayBuffer());
  const x0 = g.x0 + g.dx / 2, y0 = g.y0 + g.dy / 2, ddy = -g.dy, d = new Array(g.w * g.h);
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { let v = g.data[j * g.w + i] * sg;
    if (!(v > 0) || v > 6000) { d[j * g.w + i] = 0; continue; }
    if (cs.length) v = Math.max(1, v + corrAt(cs, y0 - j * ddy, x0 + i * g.dx));
    d[j * g.w + i] = Math.round(v); }
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  return { ok: 1, x0: r6(x0), y0: r6(y0), dx: r6(g.dx), dy: r6(ddy), w: g.w, h: g.h, d, c: cs.length ? 1 : 0 };
}

/* 1.9.75: τα 4 είδη που πιάνεις πιο συχνά στη συρτή, συμπληρωμένα με τα γενικά: rows = [{sp, tech, w, m}] */
export function trollSpecies(rows) {
  const top = (rr) => { const c = new Map(); rr.forEach(x => { const n = String(x.sp || '').trim(); if (n && x.m !== 'true') c.set(n, (c.get(n) || 0) + 1); }); return [...c.entries()].sort((p, q) => q[1] - p[1]).map(e => e[0].slice(0, 18)); };
  const tr = top(rows.filter(x => x.w || /συρτ|troll/i.test(String(x.tech || '')))), al = top(rows);
  return [...tr, ...al.filter(n => !tr.includes(n))].slice(0, 4);
}
/* 1.9.77: τα σημεία όπου έπιασες ψάρι με συρτή, ως 20 km από τη βάρκα (τα 40 κοντινότερα): [lat, lon, μολύβια|null, βυθός οργ.|null] */
export function trollSpots(rows, lat, lon) {
  return rows.filter(x => x.m !== 'true' && (x.w || /συρτ|troll/i.test(String(x.tech || ''))) && Number.isFinite(+x.la) && Number.isFinite(+x.lo) && (Math.abs(+x.la) > 0.01 || Math.abs(+x.lo) > 0.01))
    .map(x => ({ la: +x.la, lo: +x.lo, w: x.w && typeof x.w === 'object' ? x.w : {}, d: distM(lat, lon, +x.la, +x.lo) })).filter(x => x.d < 20000)
    .sort((p, q) => p.d - q.d).slice(0, 40)
    .map(x => [Math.round(x.la * 1e5) / 1e5, Math.round(x.lo * 1e5) / 1e5, Number.isFinite(+x.w.n) && +x.w.n > 0 ? Math.round(+x.w.n) : null, Number.isFinite(+x.w.bd) && +x.w.bd > 0 ? Math.round(+x.w.bd) : null]);
}
export async function handle(req, F = fetch, now = Date.now()) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url), q = u.searchParams;
  try {
    if (req.method === 'GET') {
      const lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return J({ ok: 0, err: 'pos' }, 400);
      if (q.get('grid') === '1') {   // 1.9.72: χάρτης βυθού για το ρολόι
        let cs = [];
        if (q.get('code')) { const us = await userOf(F, q.get('code'), now).catch(() => null);
          if (us) try { const r = await sb(F, 'records?user_id=eq.' + us.user_id + '&kind=eq.settings&id=eq.main&select=data&limit=1'); const a = r.ok ? await r.json() : [];
            const dc = a && a[0] && a[0].data ? a[0].data['alkyon-dcorr'] : null; if (Array.isArray(dc)) cs = dc.filter(c => Array.isArray(c) && Number.isFinite(+c[0]) && Number.isFinite(+c[1]) && Number.isFinite(+c[2]) && Math.abs(+c[2]) <= 60 && distM(lat, lon, +c[0], +c[1]) < 4000).map(c => [+c[0], +c[1], +c[2]]); } catch (e) {} }
        const gk = 'g' + lat.toFixed(3) + ',' + lon.toFixed(3) + ':' + JSON.stringify(cs).length + ':' + cs.length;
        const gh = mem.fc.get(gk); if (gh && now - gh.at < 6 * 3600e3) return J(gh.v, 200, 'private, max-age=3600');
        const v = await depthGrid(F, lat, lon, cs); mem.fc.set(gk, { at: now, v });
        return J(v, 200, 'private, max-age=3600');
      }
      let en = q.get('lang') === 'en', lim = null, us = null;
      if (q.get('code')) { us = await userOf(F, q.get('code'), now).catch(() => null); if (us && us.lang && !q.get('lang')) en = us.lang === 'en'; }   // η γλώσσα του ρολογιού (lang) έχει προτεραιότητα
      const key = lat.toFixed(2) + ',' + lon.toFixed(2) + (en ? 'e' : 'g') + JSON.stringify(lim || '');
      const bg = q.get('bg') === '1';   // από το παρασκήνιο του ρολογιού: μόνο οι καμπές πίεσης (λίγη μνήμη)
      const small = (v) => bg ? { ok: 1, tn: v.tn || [], p: v.now ? v.now.p : null, s: v.days && v.days[0] ? v.days[0].s : null, w: v.days && v.days[0] ? v.days[0].w : '', bw: v.bw || null } : v;
      /* 1.2.0: ώρα επιστροφής από το πλάνο εξόδου του κινητού (αν υπάρχει ενεργό), για το δαχτυλίδι της εξόδου στο ρολόι */
      const withDue = async (v) => { if (bg || !us) return v; let o = v;
        try { const r = await sb(F, 'safety_trips?user_id=eq.' + us.user_id + '&status=eq.active&select=due_at&order=due_at.desc&limit=1'); const a = r.ok ? await r.json() : [];
          const ms = a && a[0] ? Date.parse(a[0].due_at) : NaN; if (Number.isFinite(ms) && ms > now - 12 * 3600e3) o = { ...o, due: Math.round(ms / 1000) }; } catch (e) {}
        /* 1.2.2: τα 12 κοντινότερα αποθηκευμένα σημεία του χρήστη, για τη σελίδα «Σημείο» του ρολογιού: [όνομα, lat, lon] */
        try { const r = await sb(F, 'records?user_id=eq.' + us.user_id + '&kind=eq.spots&deleted=eq.false&select=data&limit=500'); const a = r.ok ? await r.json() : [];
          const d2 = (x) => (x.lat - lat) ** 2 + ((x.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2;
          const sp = (a || []).map(x => x && x.data).filter(x => x && Number.isFinite(+x.lat) && Number.isFinite(+x.lon) && !x.deleted).map(x => ({ n: String(x.name || '').slice(0, 20), lat: +x.lat, lon: +x.lon }))
            .sort((p, q) => d2(p) - d2(q)).slice(0, 12).map(x => [x.n, Math.round(x.lat * 1e5) / 1e5, Math.round(x.lon * 1e5) / 1e5]);
          if (sp.length) o = { ...o, sp }; } catch (e) {}
        /* 1.9.75: τα 4 είδη που πιάνεις πιο συχνά στη συρτή (αλλιώς γενικά), για την επιλογή είδους στο ρολόι */
        try { const r = await sb(F, 'records?user_id=eq.' + us.user_id + '&kind=eq.bites&deleted=eq.false&select=sp:data->>species,tech:data->>tech,w:data->wtr,m:data->>miss,la:data->>lat,lo:data->>lon&order=updated_at.desc&limit=1500'); const a = r.ok ? await r.json() : [];
          const tsp = trollSpecies(a || []); if (tsp.length) o = { ...o, tsp };
          const tc = trollSpots(a || [], lat, lon); if (tc.length) o = { ...o, tc }; } catch (e) {}
        return o; };
      const hit = mem.fc.get(key); if (hit && now - hit.at < 30 * 60e3) return J(small(await withDue(hit.v)), 200, 'private, max-age=300');
      const PF = await loadPF(F, now);
      const fc = await PF.getForecast(lat, lon, F, { days: 6 });
      const v = compact(PF, fc, en, lat, lon); mem.fc.set(key, { at: now, v }); if (mem.fc.size > 300) mem.fc.clear();
      return J(small(await withDue(v)), 200, 'private, max-age=300');
    }
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const us = await userOf(F, b.code, now); if (!us) return J({ ok: 0, err: 'code' }, 403);
      const t0 = Number.isFinite(+b.t) ? +b.t : Number.isFinite(+b.ts) ? +b.ts * 1000 : NaN;   // το ρολόι στέλνει ts σε δευτερόλεπτα
      const t = t0 > 1.5e12 && t0 < now + 600e3 ? t0 : now;
      const tripId = (v) => String(v || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
      /* 1.1.0: έξοδος από το ρολόι (δραστηριότητα «Ψάρεμα»): αρχή/τέλος, διαδρομή, πόσα ψάρια → μία έξοδος στο Ημερολόγιο */
      if (b.kind === 'trip') {
        const tz = Number.isFinite(+b.tz) ? +b.tz : null;
        const s0 = Number.isFinite(+b.ts) ? +b.ts * 1000 : NaN, e0 = Number.isFinite(+b.te) ? +b.te * 1000 : now;
        if (!(s0 > 1.5e12) || e0 < s0 || e0 - s0 > 36 * 3600e3) return J({ ok: 0, err: 'time' }, 400);
        const pts = (Array.isArray(b.pts) ? b.pts : []).filter(p => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) && Math.abs(+p[0]) <= 90 && Math.abs(+p[1]) <= 180 && (Math.abs(+p[0]) > 0.01 || Math.abs(+p[1]) > 0.01))
          .slice(0, 1000).map(p => [Math.round(+p[0] * 1e5) / 1e5, Math.round(+p[1] * 1e5) / 1e5, Number.isFinite(+p[2]) ? +p[2] * 1000 : null]);
        let km = 0; for (let i = 1; i < pts.length; i++) { const [a, c] = [pts[i - 1], pts[i]], R = 6371, dl = (c[0] - a[0]) * Math.PI / 180, dn = (c[1] - a[1]) * Math.PI / 180, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(c[0] * Math.PI / 180) * Math.sin(dn / 2) ** 2; km += 2 * R * Math.asin(Math.sqrt(x)); }
        const lp = localParts(s0, tz != null ? tz : tzOf(s0)), en = us.lang === 'en', tid = tripId(b.tid) || rid(), mid = pts.length ? pts[Math.floor(pts.length / 2)] : null;
        const n = Math.max(0, Math.min(999, Math.floor(+b.n) || 0));
        const data = { id: tid, sid: tid, date: lp.date, spot: '', tech: '', species: '', count: n, kg: 0, startMs: s0, endMs: e0, km: Math.round(km * 10) / 10, track: pts, lat: mid ? mid[0] : null, lon: mid ? mid[1] : null,
          notes: en ? 'Recorded on the Garmin watch' : 'Καταγράφηκε στο ρολόι Garmin', src: 'watch', _u: now };
        const r = await sb(F, 'records', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ user_id: us.user_id, kind: 'trips', id: tid, data, deleted: false, updated_at: new Date(now).toISOString() }]) });
        if (!r.ok && r.status !== 409) return J({ ok: 0, err: 'db ' + r.status, detail: (await r.text()).slice(0, 200) }, 502);
        return J({ ok: 1, id: tid });   // 409 = υπάρχει ήδη (το ρολόι το ξανάστειλε)
      }
      /* 1.9.75: αναίρεση ή αλλαγή ψαριού από το ρολόι (οθόνη 6″ μετά το START στη συρτή): cid = ο κωδικός που έδωσε το ρολόι στο ψάρι */
      if (b.kind === 'undo' || b.kind === 'upd') {
        const cid = tripId(b.cid); if (!cid) return J({ ok: 0, err: 'cid' }, 400);
        const q = 'records?user_id=eq.' + us.user_id + '&kind=eq.bites&id=eq.' + cid;
        if (b.kind === 'undo') {
          const r = await sb(F, q, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deleted: true, updated_at: new Date(now).toISOString() }) });
          if (!r.ok) return J({ ok: 0, err: 'db ' + r.status }, 502);
          return J({ ok: 1, id: cid });
        }
        const r0 = await sb(F, q + '&select=data&limit=1'); const a0 = r0.ok ? await r0.json() : [];
        if (!a0 || !a0[0] || !a0[0].data) return J({ ok: 1, id: cid, skip: 1 });   // δεν υπάρχει (π.χ. σβήστηκε): τίποτα
        const d = { ...a0[0].data, _u: now };
        if (b.miss) { d.miss = true; d.species = ''; d.latin = ''; delete d.cnt; }
        if (typeof b.sp === 'string' && b.sp.trim()) { d.species = b.sp.trim().slice(0, 40); delete d.miss; }
        const r = await sb(F, q, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data: d, updated_at: new Date(now).toISOString() }) });
        if (!r.ok) return J({ ok: 0, err: 'db ' + r.status }, 502);
        return J({ ok: 1, id: cid });
      }
      const kind = b.kind === 'miss' ? 'miss' : b.kind === 'pest' ? 'pest' : 'fish';
      const lp = localParts(t, Number.isFinite(+b.tz) ? +b.tz : tzOf(t)), en = us.lang === 'en';
      const lat = Number.isFinite(+b.lat) && Math.abs(+b.lat) > 0.01 ? Math.round(+b.lat * 1e5) / 1e5 : null, lon = Number.isFinite(+b.lon) && Math.abs(+b.lon) > 0.01 ? Math.round(+b.lon * 1e5) / 1e5 : null;
      const id = tripId(b.cid) || rid();   // 1.9.75: ο κωδικός του ρολογιού, για αναίρεση/αλλαγή αργότερα
      const data = { id, date: lp.date, time: lp.time, species: kind === 'pest' ? (en ? 'Silver-cheeked toadfish' : 'Λαγοκέφαλος') : '', latin: kind === 'pest' ? 'Lagocephalus sceleratus' : '', bait: '', tech: '', depth: null, kg: null, len: null,
        notes: '', place: '', lat, lon, photo: false, src: 'watch', _u: now, ...(kind === 'miss' ? { miss: true } : {}), ...(kind === 'pest' ? { pest: true } : {}), ...(Math.floor(+b.n) > 1 && Math.floor(+b.n) < 100 ? { cnt: Math.floor(+b.n) } : {}), ...(tripId(b.trip) ? { trip: tripId(b.trip) } : {}), ...(kind === 'fish' && b.tr && typeof b.tr === 'object' ? { wtr: { m: b.tr.m === 'b' ? 'bottom' : 'surface', kn: Number.isFinite(+b.tr.kn) ? Math.round(+b.tr.kn * 10) / 10 : null, hd: Number.isFinite(+b.tr.hd) ? Math.round(+b.tr.hd) : null, n: Number.isFinite(+b.tr.n) && +b.tr.n > 0 && +b.tr.n < 100 ? Math.round(+b.tr.n) : null, ln: Number.isFinite(+b.tr.ln) && +b.tr.ln > 0 && +b.tr.ln < 400 ? Math.round(+b.tr.ln) : null, bd: Number.isFinite(+b.tr.bd) && +b.tr.bd > 0 && +b.tr.bd < 500 ? Math.round(+b.tr.bd * 10) / 10 : null, cl: Number.isFinite(+b.tr.cl) && Math.abs(+b.tr.cl) < 100 ? Math.round(+b.tr.cl * 10) / 10 : null } } : {}) }; /* 1.6.4: συρτή από το ρολόι */
      const r = await sb(F, 'records', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ user_id: us.user_id, kind: 'bites', id, data, deleted: false, updated_at: new Date(now).toISOString() }]) });
      if (!r.ok && r.status !== 409) return J({ ok: 0, err: 'db ' + r.status, detail: (await r.text()).slice(0, 200) }, 502);   // 409 = το ρολόι το ξανάστειλε
      return J({ ok: 1, id, time: lp.time });
    }
    return J({ ok: 0, err: 'method' }, 405);
  } catch (e) { return J({ ok: 0, err: String(e && e.message || e) }, 502); }
}
if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(req => handle(req));
