// @ts-nocheck
// Supabase Edge Function «watch» (v31z552, v31z553): η εφαρμογή Alkyon στο ρολόι Garmin.
//   GET  /functions/v1/watch?lat=34.9&lon=32.4[&code=ABC123]  → σύντομη πρόγνωση (ίδιος βαθμός με την εφαρμογή, από το forecast.js)
//   POST /functions/v1/watch  {code, t, lat, lon, kind:'fish'|'miss'|'pest', n}  → γράφει το ψάρι στο Ημερολόγιο του χρήστη
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
export function compact(PF, fc, en) {
  const now = fc.nowLocal.slice(0, 13) + ':00', today = fc.nowLocal.slice(0, 10);
  const days = fc.days.filter(d => d.date >= today).slice(0, 6).map(d => {
    const dt = new Date(d.date + 'T12:00:00Z');
    return { n: d.date === today ? (en ? 'Today' : 'Σήμερα') : (en ? DAYS_EN : DAYS_EL)[dt.getUTCDay()] + ' ' + dt.getUTCDate(), s: d.safe ? d.best : null,
      w: d.safe && d.win ? String(d.win.s).padStart(2, '0') + '-' + String((d.win.e + 1) % 24).padStart(2, '0') : '', b: bft(d.wx && d.wx.windMax != null ? d.wx.windMax : d.avgWind), v: r1(d.wx && d.wx.waveMax != null ? d.wx.waveMax : d.avgWave), x: d.safe ? 0 : 1 };
  });
  const hrs = []; fc.days.forEach(d => d.hours.forEach(h => { if (h.t >= now && hrs.length < 12) hrs.push({ h: h.hr, s: h.score != null ? Math.round(h.score) : null, b: bft(h.wind), v: r1(h.wave), p: h.pres != null ? Math.round(h.pres) : null }); }));
  let pr = null; try { const ev = PF.pressureEvent(fc); if (ev) pr = { d: r1(ev.d), h: ev.hours, t: ev.t.slice(11, 16), from: Math.round(ev.from), to: Math.round(ev.to) }; } catch (e) {}
  const cur = hrs[0] || {};
  return { ok: 1, now: { s: cur.s, b: cur.b, v: cur.v, p: cur.p }, days, hrs, pr, tn: turns(PF, fc), at: fc.nowLocal.slice(11, 16) };
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

export async function handle(req, F = fetch, now = Date.now()) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url), q = u.searchParams;
  try {
    if (req.method === 'GET') {
      const lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return J({ ok: 0, err: 'pos' }, 400);
      let en = q.get('lang') === 'en', lim = null;
      if (q.get('code')) { const us = await userOf(F, q.get('code'), now).catch(() => null); if (us && us.lang && !q.get('lang')) en = us.lang === 'en'; }   // η γλώσσα του ρολογιού (lang) έχει προτεραιότητα
      const key = lat.toFixed(2) + ',' + lon.toFixed(2) + (en ? 'e' : 'g') + JSON.stringify(lim || '');
      const bg = q.get('bg') === '1';   // από το παρασκήνιο του ρολογιού: μόνο οι καμπές πίεσης (λίγη μνήμη)
      const small = (v) => bg ? { ok: 1, tn: v.tn || [], p: v.now ? v.now.p : null } : v;
      const hit = mem.fc.get(key); if (hit && now - hit.at < 30 * 60e3) return J(small(hit.v), 200, 'public, max-age=600');
      const PF = await loadPF(F, now);
      const fc = await PF.getForecast(lat, lon, F, { days: 6 });
      const v = compact(PF, fc, en); mem.fc.set(key, { at: now, v }); if (mem.fc.size > 300) mem.fc.clear();
      return J(small(v), 200, 'public, max-age=600');
    }
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const us = await userOf(F, b.code, now); if (!us) return J({ ok: 0, err: 'code' }, 403);
      const t0 = Number.isFinite(+b.t) ? +b.t : Number.isFinite(+b.ts) ? +b.ts * 1000 : NaN;   // το ρολόι στέλνει ts σε δευτερόλεπτα
      const t = t0 > 1.5e12 && t0 < now + 600e3 ? t0 : now;
      const kind = b.kind === 'miss' ? 'miss' : b.kind === 'pest' ? 'pest' : 'fish';
      const lp = localParts(t, Number.isFinite(+b.tz) ? +b.tz : tzOf(t)), en = us.lang === 'en';
      const lat = Number.isFinite(+b.lat) && Math.abs(+b.lat) > 0.01 ? Math.round(+b.lat * 1e5) / 1e5 : null, lon = Number.isFinite(+b.lon) && Math.abs(+b.lon) > 0.01 ? Math.round(+b.lon * 1e5) / 1e5 : null;
      const id = rid();
      const data = { id, date: lp.date, time: lp.time, species: kind === 'pest' ? (en ? 'Silver-cheeked toadfish' : 'Λαγοκέφαλος') : '', latin: kind === 'pest' ? 'Lagocephalus sceleratus' : '', bait: '', tech: '', depth: null, kg: null, len: null,
        notes: '', place: '', lat, lon, photo: false, src: 'watch', _u: now, ...(kind === 'miss' ? { miss: true } : {}), ...(kind === 'pest' ? { pest: true } : {}), ...(Math.floor(+b.n) > 1 && Math.floor(+b.n) < 100 ? { cnt: Math.floor(+b.n) } : {}) };
      const r = await sb(F, 'records', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ user_id: us.user_id, kind: 'bites', id, data, deleted: false, updated_at: new Date(now).toISOString() }]) });
      if (!r.ok) return J({ ok: 0, err: 'db ' + r.status, detail: (await r.text()).slice(0, 200) }, 502);
      return J({ ok: 1, id, time: lp.time });
    }
    return J({ ok: 0, err: 'method' }, 405);
  } catch (e) { return J({ ok: 0, err: String(e && e.message || e) }, 502); }
}
if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(req => handle(req));
