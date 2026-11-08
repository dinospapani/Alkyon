// Alkyon 1.9.48 · tests του server (quick-processor): τρέχουν το run() του safety-job.mjs (ίδιος κώδικας με την Edge Function)
// με ψεύτικη Supabase, ψεύτικο Open-Meteo, ψεύτικο web-push και σταθερή ώρα. Χωρίς δίκτυο.
// Χρήση: node tests/server.mjs  → τυπώνει «ok/FAIL όνομα» ανά έλεγχο και τελευταία γραμμή JSON {ok,fail}.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RealDate = Date;
let NOW = RealDate.parse('2026-11-09T07:00:00Z');
class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(NOW); }
  static now() { return NOW; }
}
globalThis.Date = FakeDate;

const g = {}; new Function('self', fs.readFileSync(path.join(ROOT, 'forecast.js'), 'utf8'))(g);
const PF = g.PF;
const { run } = await import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href);

/* ---------- ψεύτικο Open-Meteo: ωριαία δεδομένα (τοπική ώρα Κύπρου, +2) ---------- */
function meteo(url, W) {
  const u = new URL(url), lat = +u.searchParams.get('latitude'), marine = u.hostname.startsWith('marine');
  const start = RealDate.parse('2026-11-06T00:00:00Z'), time = [];
  for (let i = 0; i < 24 * 12; i++) time.push(new RealDate(start + i * 3600000).toISOString().slice(0, 16));
  const wf = W(lat), arr = f => time.map(f);
  if (marine) return { utc_offset_seconds: 7200, timezone: 'Asia/Nicosia', hourly: { time, wave_height: arr(t => wf(t).wave), wave_period: arr(() => 4), sea_surface_temperature: arr(() => 22), sea_level_height_msl: arr(() => 0) } };
  return { utc_offset_seconds: 7200, timezone: 'Asia/Nicosia', hourly: { time, pressure_msl: arr(() => 1016), wind_speed_10m: arr(t => wf(t).wind), wind_gusts_10m: arr(t => wf(t).wind + 4), wind_direction_10m: arr(() => 90), cloud_cover: arr(() => 20), temperature_2m: arr(() => 21), precipitation_probability: arr(() => 0), precipitation: arr(() => 0), weather_code: arr(() => 1) } };
}
const calm = () => () => ({ wind: 5, wave: 0.3 });
const windy = () => () => ({ wind: 18, wave: 1.4 });

/* ---------- ψεύτικη Supabase ---------- */
function world({ subs = [], notifLog = 'ok', W = calm, community = {}, meteoFail = false, store = {}, rows = [] } = {}) {
  const log = new Set(rows.map(r => r.id)), sent = [], calls = [], tgSent = [];
  const res = (o, status = 200) => ({ ok: status < 400, status, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)) });
  const fetch = async (url, opt = {}) => {
    url = String(url); calls.push(url);
    if (url.includes('open-meteo.com')) return meteoFail ? res({ error: true }, 500) : res(meteo(url, W));
    if (url.includes('api.telegram.org')) { const mth = url.split('/').pop(); if (mth === 'sendMessage') tgSent.push(JSON.parse(opt.body)); return res({ ok: true, result: mth === 'getUpdates' ? [] : {} }); }
    if (url.includes('/storage/v1/object/')) { const k = url.split('/storage/v1/object/')[1]; if ((opt.method || 'GET') === 'POST') { store[k] = JSON.parse(opt.body); return res({}); } return k in store ? res(store[k]) : res({ error: 'not found' }, 400); }
    const m = url.match(/\/rest\/v1\/(.+)$/); if (!m) return res({ ok: false }, 404);
    const p = decodeURIComponent(m[1]), method = opt.method || 'GET';
    if (p.startsWith('notif_log') && method === 'POST') {
      if (notifLog === 'error') return res({ message: 'boom' }, 500);
      const row = JSON.parse(opt.body); if (log.has(row.id)) return res([]); log.add(row.id); rows.push(row); return res([row]);
    }
    if (p.startsWith('notif_log?kind=eq.comm')) { const gt = (p.match(/at=gt\.([^&]+)/) || [])[1] || ''; return res(rows.filter(r => r.kind === 'comm' && r.at > gt).map(r => ({ user_id: r.user_id, at: r.at }))); }
    if (p === 'push_subs?select=id,user_id,sub,places') return res(subs);
    if (p.startsWith('app_admins?')) return res([{ user_id: 'a1' }]);
    if (p.startsWith('safety_contacts?user_id=in.')) return res([{ self_chat_id: 99 }]);
    if (p.startsWith('community_posts?created_at')) return res(community.posts || []);
    if (p.startsWith('community_likes?')) return res(community.likes || []);
    if (p.startsWith('community_comments?')) return res(community.comments || []);
    if (p.startsWith('community_posts?id=in.')) return res(community.own || []);
    return res(method === 'GET' ? [] : null);
  };
  const webpush = { sendNotification: async (sub, payload) => { sent.push({ sub, ...JSON.parse(payload) }); return {}; } };
  return { fetch, webpush, sent, log, calls, tgSent, store, rows };
}
const go = async (w, tg) => run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k', TELEGRAM_BOT_TOKEN: tg ? 'T' : '' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {} });

let ok = 0; const fail = [];
const check = (name, cond, info) => { if (cond) { ok++; console.log('  ok   ' + name); } else { fail.push(name); console.log('  FAIL ' + name + ' ' + JSON.stringify(info).slice(0, 400)); } };
const SUB = (places, id = 's1', user = 'u1') => ({ id, user_id: user, sub: { endpoint: 'https://push/' + id }, places });
const sq = s => s.sent.filter(x => String(x.id || '').startsWith('sq:'));

/* ---------- καλαμάρια (7γ) ---------- */
NOW = RealDate.parse('2026-11-09T07:00:00Z'); // Δευτέρα 09:00 Κύπρου, νέα σελήνη 06:11Z
{
  const w = world({ subs: [SUB([{ lat: 35.04, lon: 32.42, name: 'Λατσί', squid: 'on' }])] });
  await go(w); const s = sq(w);
  if (process.env.SHOW) console.log(s.map(x => x.title + ' / ' + x.body));
  check('καλαμάρια: μία ειδοποίηση στις 9:00 κοντά στη νέα σελήνη', s.length === 1, s);
  check('καλαμάρια: «Καλύτερο: … (βαθμός N)» και το μέρος', s[0] && /^Καλύτερο: \S+ \d\d\/11 \d\d:00–\d\d:00 \(βαθμός \d+\)/.test(s[0].body) && s[0].body.includes('Λατσί') && s[0].body.includes('σκοτάδι'), s[0]);
  check('καλαμάρια: μόνο βράδια έως 3 μέρες από τη νέα σελήνη', s[0] && !/1[3-9]\/11/.test(s[0].body), s[0] && s[0].body);
  await go(w);
  check('καλαμάρια: δεν ξαναστέλνει στην ίδια σελήνη', sq(w).length === 1, sq(w).length);
}
{
  const W = lat => lat > 35 ? (() => ({ wind: 5, wave: 0.3 })) : (() => ({ wind: 16, wave: 1.2 }));
  const w = world({ W, subs: [SUB([{ lat: 34.70, lon: 33.00, name: 'Λεμεσός', squid: 'on' }, { lat: 35.04, lon: 32.42, name: 'Λατσί' }])] });
  await go(w); const s = sq(w);
  check('καλαμάρια: ψάχνει σε όλα τα μέρη και λέει πού', s.length === 1 && / στο Λατσί/.test(s[0].body) && !/Λεμεσός/.test(s[0].body), s[0] && s[0].body);
}
{
  const w = world({ notifLog: 'error', subs: [SUB([{ lat: 35.04, lon: 32.42, name: 'Λατσί', squid: 'on' }])] });
  await go(w);
  check('καλαμάρια: αν δεν γράφεται το notif_log, δεν στέλνει', sq(w).length === 0, sq(w));
}
{
  const w = world({ W: windy, subs: [SUB([{ lat: 35.04, lon: 32.42, name: 'Λατσί', squid: 'on' }])] });
  await go(w);
  check('καλαμάρια: με αέρα και κύμα δεν στέλνει', sq(w).length === 0, sq(w));
}
{
  const w = world({ subs: [SUB([{ lat: 35.04, lon: 32.42, name: 'Λατσί' }])] });
  await go(w);
  check('καλαμάρια: κλειστός διακόπτης, τίποτα', sq(w).length === 0, sq(w));
}
NOW = RealDate.parse('2026-11-09T08:00:00Z'); // 10:00 Κύπρου
{
  const w = world({ subs: [SUB([{ lat: 35.04, lon: 32.42, name: 'Λατσί', squid: 'on' }])] });
  await go(w);
  check('καλαμάρια: μόνο στις 9:00–10:00', sq(w).length === 0, sq(w));
}
NOW = RealDate.parse('2026-11-16T07:00:00Z'); // μία εβδομάδα μετά τη νέα σελήνη
{
  const w = world({ subs: [SUB([{ lat: 35.04, lon: 32.42, name: 'Λατσί', squid: 'on' }])] });
  await go(w);
  check('καλαμάρια: εκτός παραθύρου νέας σελήνης, τίποτα', sq(w).length === 0, sq(w));
}

/* ---------- Κοινότητα (7β) ---------- */
NOW = RealDate.parse('2026-11-09T10:00:00Z'); // 12:00 Κύπρου
{
  const t = new RealDate(NOW - 60000).toISOString();
  const w = world({ subs: [SUB([{ lat: 35, lon: 32.4, name: 'Λατσί' }], 's1', 'u1'), SUB([{ lat: 35, lon: 32.4 }], 's2', 'u2')],
    community: { posts: [{ id: 'p0000001-aaaa', user_id: 'u2', author: 'Νίκος', species: 'Μαγιάτικο', kg: 4.5, created_at: t }],
      likes: [{ post_id: 'p0000009-bbbb', user_id: 'u2', created_at: t }], own: [{ id: 'p0000009-bbbb', user_id: 'u1', species: 'Λαβράκι' }] } });
  await go(w);
  const c1 = w.sent.filter(x => x.kind === 'comm'), c2 = w.sent.filter(x => x.kind === 'commre');
  check('Κοινότητα: νέο ψάρι άλλου → push, όχι στον ίδιο', c1.length === 1 && c1[0].sub.endpoint.endsWith('/s1') && /Νίκος έπιασε Μαγιάτικο 4,5 kg/.test(c1[0].body), c1);
  check('Κοινότητα: like σε δικό μου ψάρι → push και ανοίγει την Κοινότητα', c2.length === 1 && c2[0].url === '#community' && c2[0].body === 'Λαβράκι', c2);
}
NOW = RealDate.parse('2026-11-09T22:30:00Z'); // 00:30 Κύπρου: ώρες ησυχίας
{
  const t = new RealDate(NOW - 60000).toISOString();
  const w = world({ subs: [SUB([{ lat: 35, lon: 32.4 }], 's1', 'u1')], community: { posts: [{ id: 'p0000002-aaaa', user_id: 'u2', author: 'Νίκος', species: 'Σαργός', created_at: t }] } });
  await go(w);
  check('Κοινότητα: τίποτα στις ώρες ησυχίας', w.sent.filter(x => x.kind === 'comm').length === 0, w.sent);
}

/* ---------- Κοινότητα: όριο 30′ χωρίς να χάνονται ψάρια, ιστορικό χωρίς συνδρομή (1.9.56) ---------- */
NOW = RealDate.parse('2026-11-09T10:00:00Z');
{
  const rows = [{ id: 'u1|comm:old', user_id: 'u1', kind: 'comm', at: new RealDate(NOW - 10 * 60000).toISOString() }];
  const subs = [SUB([{ lat: 35, lon: 32.4 }], 's1', 'u1')];
  const post = { id: 'p0000003-aaaa', user_id: 'u2', author: 'Νίκος', species: 'Φαγκρί', kg: 2, created_at: new RealDate(NOW - 60000).toISOString() };
  const w1 = world({ subs, rows, community: { posts: [post] } }); await go(w1);
  check('Κοινότητα: μέσα στο όριο 30′ δεν στέλνει αμέσως', w1.sent.filter(x => x.kind === 'comm').length === 0, w1.sent);
  NOW += 25 * 60000; // 35′ μετά την προηγούμενη ειδοποίηση· το ψάρι ανέβηκε πριν από 26′ (εκτός του παραθύρου των 6′)
  const w2 = world({ subs, rows, community: { posts: [post] } }); await go(w2);
  const c = w2.sent.filter(x => x.kind === 'comm');
  check('Κοινότητα: το ψάρι που περίμενε έρχεται μετά το όριο (δεν χάνεται)', c.length === 1 && /Φαγκρί/.test(c[0].body), c);
}
{
  const t = new RealDate(NOW - 60000).toISOString();
  const w = world({ subs: [SUB([{ lat: 35, lon: 32.4 }], 's2', 'u2')], community: { likes: [{ post_id: 'p0000010-cccc', user_id: 'u2', created_at: t }], own: [{ id: 'p0000010-cccc', user_id: 'u9', species: 'Σφυρίδα' }] } });
  await go(w);
  check('Κοινότητα: like σε χρήστη χωρίς συνδρομή → γράφεται στο ιστορικό του', w.rows.some(r => r.user_id === 'u9' && r.kind === 'commre') && w.sent.length === 0, [w.rows, w.sent]);
}

/* ---------- αλλαγή ανέμου: μία ειδοποίηση για όλα τα σημεία, το πολύ ανά 4 ώρες (1.9.58) ---------- */
{
  NOW = RealDate.parse('2026-11-09T10:00:00Z');
  const W = () => t => { const dh = (RealDate.parse(t + 'Z') - 7200000 - NOW) / 3600000; return dh < 2 ? { wind: 4, wave: 0.3, dir: 45 } : { wind: 16, wave: 0.3, dir: 135 }; };
  const w = world({ W });
  const F2 = async (url, o) => { const r = await w.fetch(url, o); const j = await r.json(); if (!url.includes('marine')) j.hourly.wind_direction_10m = j.hourly.time.map(t => W()(t).dir); return { ok: true, json: async () => j }; };
  const cfg = { places: [{ id: 'a', name: 'A', lat: 35.0, lon: 32.4 }, { id: 'b', name: 'B', lat: 34.8, lon: 32.5 }, { id: 'c', name: 'C', lat: 34.7, lon: 33.0 }], wind: { deg: 60, kn: 6, hours: 6 }, lang: 'en', threshold: 99, notified: {} };
  const r1 = await PF.checkPlaces(cfg, F2), w1 = r1.msgs.filter(m => m.kind === 'wind');
  const keep = {}; for (const k of Object.keys(r1.notified)) if (k.startsWith('_wind')) keep[k] = r1.notified[k];
  NOW += 3600000; const r2 = await PF.checkPlaces(Object.assign({}, cfg, { notified: keep }), F2), w2 = r2.msgs.filter(m => m.kind === 'wind');
  check('άνεμος: μία ειδοποίηση για όλα τα σημεία (+2)', w1.length === 1 && /\+2$/.test(w1[0].title) && w1[0].full.split('\n').length === 3, w1);
  check('άνεμος: όχι ξανά μέσα σε 4 ώρες, ακόμα κι αν άλλαξε η πρόγνωση', w2.length === 0, w2);
}

/* ---------- σκοτάδι για καλαμάρι ---------- */
{
  const dw = d => { const s = PF.sunMoon(d, 35.04, 32.42, 120); return PF.darkWin(d, s.set, s.rise, 35.04, 32.42, 120); };
  const nw = dw('2026-11-09'), fq = dw('2026-11-16'), fm = dw('2026-11-24');
  check('σκοτάδι: νέα σελήνη → από το σούρουπο ως το πρωί', nw && nw.why === 'dawn' && nw.s < 18 * 60, nw);
  check('σκοτάδι: πρώτο τέταρτο → αρχίζει όταν δύσει η σελήνη (αργά το βράδυ)', fq && fq.s > 21 * 60, fq);
  check('σκοτάδι: πανσέληνος → καθόλου', fm === null, fm);
  check('σκοτάδι: κείμενο', PF.darkTxt({ s: 1040, e: 1800, why: 'dawn' }) === 'σκοτάδι 17:20 ως το πρωί' && PF.darkTxt({ s: 1360, e: 1530, why: 'moon' }) === 'σκοτάδι 22:40–01:30 (βγαίνει το φεγγάρι)', 0);
}

/* ---------- υγεία του server (βήμα 9) ---------- */
NOW = RealDate.parse('2026-11-09T07:00:00Z');
{
  const store = {}, subs = [SUB([{ lat: 35.04, lon: 32.42, name: 'Λατσί', squid: 'on' }])];
  const w1 = world({ subs, meteoFail: true, store }); await go(w1, true);
  const hb = store['backups/_system/heartbeat.json'];
  check('υγεία: γράφει heartbeat σε κάθε εκτέλεση', hb && hb.at === new RealDate(NOW).toISOString(), hb);
  check('υγεία: ένα σφάλμα μόνο του δεν στέλνει Telegram', w1.tgSent.length === 0, w1.tgSent);
  NOW += 5 * 60000; const w2 = world({ subs, meteoFail: true, store }); await go(w2, true);
  check('υγεία: 2 συνεχόμενα σφάλματα → Telegram στους διαχειριστές', w2.tgSent.length === 1 && w2.tgSent[0].chat_id === 99 && /squid fc/.test(w2.tgSent[0].text), w2.tgSent);
  NOW += 5 * 60000; const w3 = world({ subs, meteoFail: true, store }); await go(w3, true);
  check('υγεία: όχι ξανά μέσα σε 6 ώρες', w3.tgSent.length === 0, w3.tgSent);
  NOW += 5 * 60000; const w4 = world({ subs, store }); await go(w4, true);
  check('υγεία: όταν περάσει το σφάλμα, μηδενίζεται ο μετρητής', !(store['backups/_system/heartbeat.json'].fails || {})['squid fc'], store['backups/_system/heartbeat.json']);
}

/* ---------- ο server τρέχει τον ίδιο υπολογισμό με την εφαρμογή ---------- */
{
  const ts = fs.readFileSync(path.join(ROOT, 'quick-processor-index.ts'), 'utf8');
  const fc = fs.readFileSync(path.join(ROOT, 'forecast.js'), 'utf8').trimEnd();
  const sj = fs.readFileSync(path.join(ROOT, 'safety-job.mjs'), 'utf8');
  const runSrc = sj.slice(sj.indexOf('export async function run('), sj.indexOf('if (import.meta.url === pathToFileURL('));
  check('server: περιέχει ολόκληρο το forecast.js της εφαρμογής', ts.includes(fc), ts.length);
  check('server: περιέχει ολόκληρο το safety-job.mjs (build_edge.py)', ts.includes(runSrc.trimEnd()), runSrc.length);
}

globalThis.Date = RealDate;
console.log(JSON.stringify({ ok, fail }));
process.exit(fail.length ? 1 : 0);
