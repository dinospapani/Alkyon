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
    if (p.startsWith('community_posts?species=eq.')) return res(community.best || []);
    if (p.startsWith('community_reports?')) return res(community.reports || []);
    if (p.startsWith('community_posts?id=eq.')) return res(community.rpost || []);
    if (community.contact && p.startsWith('safety_contacts?user_id=eq.')) return res([{ self_chat_id: 99 }]);
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

/* ---------- Κοινότητα αμέσως (only.comm, 1.9.61) ---------- */
{
  NOW = RealDate.parse('2026-11-09T10:00:00Z');
  const t = new RealDate(NOW - 20000).toISOString(), store = {};
  const w = world({ store, subs: [SUB([{ lat: 35, lon: 32.4 }], 's1', 'u1')], community: { posts: [{ id: 'p0000077-aaaa', user_id: 'u2', author: 'Νίκος', species: 'Σφυρίδα', kg: 4, created_at: t }] } });
  const r = await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  check('Κοινότητα αμέσως: στέλνει μόνο το βήμα της Κοινότητας', r.ok && w.sent.length === 1 && w.sent[0].kind === 'comm' && !w.calls.some(u => u.includes('open-meteo')) && !store['backups/_system/heartbeat.json'], [w.sent, w.calls.filter(u => u.includes('open-meteo')).length]);
  await go(world({ store, subs: [SUB([{ lat: 35, lon: 32.4 }], 's1', 'u1')], rows: w.rows, community: { posts: [{ id: 'p0000077-aaaa', user_id: 'u2', author: 'Νίκος', species: 'Σφυρίδα', kg: 4, created_at: t }] } }));
}

/* ---------- Κοινότητα: απάντηση σε σχόλιο, πολλά ψάρια (1.9.62) ---------- */
{
  NOW = RealDate.parse('2026-11-09T10:00:00Z');
  const t = new RealDate(NOW - 20000).toISOString();
  const w = world({ subs: [SUB([{ lat: 35, lon: 32.4 }], 's1', 'u1'), SUB([{ lat: 35, lon: 32.4 }], 's3', 'u3'), SUB([{ lat: 35, lon: 32.4 }], 's4', 'u4')], community: {
    posts: [{ id: 'p0000088-bbbb', user_id: 'u1', author: 'Ντίνος', species: 'Συναγρίδα', kg: 3, cond: { more: [{ s: 'Ροφός', kg: 2 }] }, created_at: t }],
    comments: [{ id: 'c1', post_id: 'p1', user_id: 'u3', author: 'Νίκος Π', body: 'Ωραίο', created_at: t }, { id: 'c2', post_id: 'p1', user_id: 'u1', author: 'Ντίνος', body: '@Νίκος Π ευχαριστώ!', created_at: t }],
    own: [{ id: 'p1', user_id: 'u1', species: 'Συναγρίδα' }] } });
  await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  const rep = w.sent.filter(x => String(x.id).startsWith('cr:'));
  check('Κοινότητα: απάντηση «@Όνομα» → ειδοποίηση σε αυτόν που απάντησαν (1.9.62)', rep.length === 1 && rep[0].sub.endpoint.endsWith('/s3') && rep[0].title === 'Ντίνος σου απάντησε' && rep[0].body === 'ευχαριστώ!', w.sent);
  check('Κοινότητα: ο κάτοχος δεν ειδοποιείται για το δικό του σχόλιο', !w.sent.some(x => x.id === 'cc:c2'), w.sent.map(x => x.id));
  const nw = w.sent.find(x => x.kind === 'comm' && x.sub.endpoint.endsWith('/s4'));
  check('Κοινότητα: νέα ανάρτηση με πολλά ψάρια → «+1 ακόμα» (1.9.62)', nw && /Συναγρίδα 3 kg \+1 ακόμα/.test(nw.body), nw);
}

/* ---------- Κοινότητα: ακόλουθοι, ερωτήσεις, ρεκόρ (1.9.63) ---------- */
{
  NOW = RealDate.parse('2026-11-09T10:00:00Z');
  const t = new RealDate(NOW - 20000).toISOString();
  const posts = [{ id: 'p0000099-cccc', user_id: 'u2', author: 'Νίκος', species: 'Συναγρίδα', kg: 5, created_at: t }];
  const w = world({ subs: [SUB([{ lat: 35, lon: 32.4, comm: 'follow', follow: ['u7'] }], 's1', 'u1'), SUB([{ lat: 35, lon: 32.4, comm: 'follow', follow: ['u2'] }], 's3', 'u3'), SUB([{ lat: 35, lon: 32.4 }], 's4', 'u4')], community: { posts, best: [{ kg: 4.2 }] } });
  await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  const to = e => w.sent.filter(x => x.kind === 'comm' && x.sub.endpoint.endsWith('/' + e));
  check('Κοινότητα: «μόνο όσους ακολουθώ» → όχι για άλλον, ναι για αυτόν που ακολουθεί (1.9.63)', to('s1').length === 0 && to('s3').length === 1 && to('s4').length === 1, w.sent.map(x => x.sub.endpoint));
  check('Κοινότητα: νέο ρεκόρ είδους → «🏆 Νέο ρεκόρ Κοινότητας» (1.9.63)', to('s4')[0] && to('s4')[0].title === '🏆 Νέο ρεκόρ Κοινότητας: Συναγρίδα' && /Νίκος έπιασε Συναγρίδα 5 kg/.test(to('s4')[0].body), to('s4')[0]);
  const w2 = world({ subs: [SUB([{ lat: 35, lon: 32.4 }], 's4', 'u4')], community: { posts: [{ id: 'p0000100-dddd', user_id: 'u2', author: 'Νίκος', species: '?', cond: { k: 'id' }, created_at: t }] } });
  await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: w2.fetch, PF, webpush: w2.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  check('Κοινότητα: ερώτηση «Τι ψάρι είναι;» → σωστό κείμενο ειδοποίησης (1.9.63)', w2.sent[0] && w2.sent[0].title === '❓ Νέα ερώτηση στην Κοινότητα' && w2.sent[0].body === 'Νίκος ρωτά: Τι ψάρι είναι;', w2.sent);
}

/* ---------- Κοινότητα: ειδοποίηση για είδος (1.9.64) ---------- */
{
  NOW = RealDate.parse('2026-11-09T10:00:00Z');
  const t = new RealDate(NOW - 20000).toISOString();
  const K = ['loligo vulgaris', 'καλαμάρι', 'squid', 'european squid'];
  const w = world({ subs: [SUB([{ lat: 35, lon: 32.4, comm: 'off', wsp: K }], 's5', 'u5'), SUB([{ lat: 35, lon: 32.4, wsp: K }], 's6', 'u6'), SUB([{ lat: 35, lon: 32.4, wsp: ['dentex dentex'] }], 's7', 'u7')], community: { posts: [{ id: 'p0000101-eeee', user_id: 'u2', author: 'Νίκος', species: 'European squid', latin: 'Loligo vulgaris', kg: 0.8, created_at: t }] } });
  await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  const to = e => w.sent.filter(x => x.sub.endpoint.endsWith('/' + e));
  check('Κοινότητα: είδος που ζήτησες → ειδοποίηση, ακόμα κι αν τα νέα ψάρια είναι κλειστά (1.9.64)', to('s5').length === 1 && to('s5')[0].kind === 'commsp' && to('s5')[0].title === '🐟 European squid στην Κοινότητα' && /Νίκος έπιασε European squid 0,8 kg/.test(to('s5')[0].body), w.sent);
  check('Κοινότητα: είδος + γενική → μία μόνο ειδοποίηση για την ίδια ανάρτηση', to('s6').length === 1 && to('s6')[0].kind === 'commsp', to('s6'));
  check('Κοινότητα: άλλο είδος → μόνο η γενική ειδοποίηση', to('s7').length === 1 && to('s7')[0].kind === 'comm', to('s7'));
}

/* ---------- Κοινότητα: αναφορές → διαχειριστής, περίληψη εβδομάδας (1.9.65) ---------- */
{
  NOW = RealDate.parse('2026-11-09T10:00:00Z');
  const t = new RealDate(NOW - 20000).toISOString();
  const w = world({ subs: [SUB([{ lat: 35, lon: 32.4 }], 'sa', 'a1')], community: { contact: true, reports: [{ id: 'r1', post_id: 'p9', created_at: t }], rpost: [{ author: 'Τάκης', species: 'Σαργός' }] } });
  await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k', TELEGRAM_BOT_TOKEN: 'T' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  check('Κοινότητα: αναφορά → ειδοποίηση και Telegram στον διαχειριστή (1.9.65)', w.sent.length === 1 && w.sent[0].kind === 'commadm' && /Τάκης: Σαργός/.test(w.sent[0].body) && w.tgSent.length === 1 && w.tgSent[0].chat_id === 99, [w.sent, w.tgSent]);
  await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k', TELEGRAM_BOT_TOKEN: 'T' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  check('Κοινότητα: η ίδια αναφορά δεν ξαναστέλνεται', w.sent.length === 1 && w.tgSent.length === 1, [w.sent.length, w.tgSent.length]);
  NOW = RealDate.parse('2026-11-08T18:10:00Z'); // Κυριακή 20:10 Κύπρου
  const t2 = new RealDate(NOW - 3 * 864e5).toISOString();
  const w2 = world({ subs: [SUB([{ lat: 35, lon: 32.4 }], 's1', 'u1'), SUB([{ lat: 35, lon: 32.4, comm: 'off' }], 's2', 'u2')], community: { posts: [{ id: 'p1', user_id: 'u5', author: 'Νίκος', species: 'Συναγρίδα', kg: 4.1, created_at: t2 }, { id: 'p2', user_id: 'u6', author: 'Κώστας', species: 'Συναγρίδα', kg: 2, cond: { more: [{ s: 'Καλαμάρι', kg: 0.5 }] }, created_at: t2 }, { id: 'p3', user_id: 'u7', author: 'Τάκης', species: 'Ροφός', kg: 7, day: '2025-02-26', created_at: t2 }] } });
  await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: w2.fetch, PF, webpush: w2.webpush, sendMail: null, log: () => {}, only: { comm: true } });
  const wk = w2.sent.filter(x => x.kind === 'commwk');
  check('Κοινότητα: περίληψη εβδομάδας την Κυριακή το βράδυ (1.9.65)', wk.length === 1 && wk[0].sub.endpoint.endsWith('/s1') && wk[0].body === '3 ψάρια από 2 ψαράδες. Περισσότερα: Συναγρίδα (2), Καλαμάρι (1). Μεγαλύτερο: Συναγρίδα 4,1 kg (Νίκος).', wk);
}

/* ---------- ρολόι: σελίδα «Καλαμάρι» στη function watch (1.9.69) ---------- */
{
  NOW = RealDate.parse('2026-11-09T07:00:00Z');
  const tmp = path.join(ROOT, 'tests', '.watch-tmp.mjs'); fs.writeFileSync(tmp, fs.readFileSync(path.join(ROOT, 'watch-index.ts'), 'utf8'));
  const W = await import(pathToFileURL(tmp).href); fs.unlinkSync(tmp);
  const w = world();
  const fc = await PF.getForecast(34.66, 33.04, w.fetch, { days: 6 });
  const v = W.compact(PF, fc, false, 34.66, 33.04);
  const sq = v.sq || {};
  check('Ρολόι: σελίδα καλαμαριού (φωτισμός, νέα σελήνη, σκοτάδι, βράδια) (1.9.69)', sq && Number.isFinite(sq.il) && sq.il >= 0 && sq.il <= 100 && sq.nd > -4.1 && sq.nd < 30 && Array.isArray(sq.ev) && (sq.dk === null || (Array.isArray(sq.dk) && sq.dk.length === 3)), sq);
  NOW = RealDate.parse('2026-11-11T07:00:00Z');
  const v2 = W.compact(PF, fc, false, 34.66, 33.04);
  check('Ρολόι: 2 μέρες μετά τη νέα σελήνη → «πριν 2 μέρες», όχι «σε 29»', v2.sq && v2.sq.nd < -1.5 && v2.sq.nd > -2.5, v2.sq);
  check('Ρολόι: μετά τη νέα σελήνη συνεχίζει να δείχνει τα καλά βράδια (όχι άδεια λίστα) (1.9.70)', v2.sq && v2.sq.ev.length > 0, v2.sq);
  NOW = RealDate.parse('2026-11-09T07:00:00Z');
  check('Ρολόι: τα βράδια έχουν ώρα δύσης και η φάση (αύξουσα/φθίνουσα) (1.9.70)', (sq.ev || []).every(e => Number.isFinite(e.ss) && e.ss > 900 && e.ss < 1200) && (sq.wx === 0 || sq.wx === 1), sq);
  check('Ρολόι: η σελίδα καλαμαριού είναι μικρή (μνήμη ρολογιού)', JSON.stringify(sq).length < 400, JSON.stringify(sq).length);
}

/* ---------- ρολόι: χάρτης βυθού για τη συρτή βυθού (1.9.72) ---------- */
{
  const tmp = path.join(ROOT, 'tests', '.watch-tmp2.mjs'); fs.writeFileSync(tmp, fs.readFileSync(path.join(ROOT, 'watch-index.ts'), 'utf8'));
  const W = await import(pathToFileURL(tmp).href); fs.unlinkSync(tmp);
  /* μικρό GeoTIFF (float32, χωρίς συμπίεση): υψόμετρο, θάλασσα αρνητική, όπως μπορεί να το δίνει το EMODnet */
  const tiff = (w, h, x0, y0, res, fn) => { const nt = 9, ifd = 8, dataOff = 8 + 2 + nt * 12 + 4, scOff = dataOff + w * h * 4, tpOff = scOff + 24, buf = new ArrayBuffer(tpOff + 48), dv = new DataView(buf);
    dv.setUint16(0, 0x4949); dv.setUint16(2, 42, true); dv.setUint32(4, ifd, true); dv.setUint16(ifd, nt, true); let o = ifd + 2;
    const tag = (t, ty, c, v) => { dv.setUint16(o, t, true); dv.setUint16(o + 2, ty, true); dv.setUint32(o + 4, c, true); if (ty === 3 && c === 1) dv.setUint16(o + 8, v, true); else dv.setUint32(o + 8, v, true); o += 12; };
    tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, 1, 32); tag(259, 3, 1, 1); tag(273, 4, 1, dataOff); tag(278, 4, 1, h); tag(339, 3, 1, 3); tag(33550, 12, 3, scOff); tag(33922, 12, 6, tpOff);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dv.setFloat32(dataOff + (j * w + i) * 4, fn(i, j), true);
    [res, res, 0].forEach((v, k) => dv.setFloat64(scOff + k * 8, v, true)); [0, 0, 0, x0, y0, 0].forEach((v, k) => dv.setFloat64(tpOff + k * 8, v, true)); return buf; };
  const calls = []; let dcorr = null;
  const F = async (url) => { url = String(url); calls.push(url);
    if (url.includes('ows.emodnet-bathymetry.eu/wcs')) { const bb = url.match(/bbox=([^&]+)/)[1].split(',').map(Number), res = 1 / 960, w = Math.round((bb[2] - bb[0]) / res), h = Math.round((bb[3] - bb[1]) / res);
      /* βυθός 40 m που ανεβαίνει προς τα βόρεια (1 m ανά κελί), και μια στήλη στεριάς (υψόμετρο +12) στα δυτικά */
      return { ok: true, status: 200, arrayBuffer: async () => tiff(w, h, bb[0], bb[3], res, (i, j) => i === 0 ? 12 : -(40 - (h - 1 - j) * 1)) }; }
    if (url.includes('/rest/v1/watch_links')) return { ok: true, json: async () => [{ user_id: 'u1', lang: 'el' }] };
    if (url.includes('/rest/v1/records') && url.includes('kind=eq.settings')) return { ok: true, json: async () => dcorr ? [{ data: { 'alkyon-dcorr': dcorr } }] : [] };
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
  process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const r1 = await W.handle(new Request('https://x/functions/v1/watch?grid=1&lat=34.70&lon=32.60'), F, RealDate.now());
  const g = await r1.json();
  check('Ρολόι: χάρτης βυθού γύρω από τη βάρκα (πλέγμα ~115 m, ±1,3 km) (1.9.72)', g.ok === 1 && g.w >= 20 && g.w <= 34 && g.h >= 20 && g.h <= 30 && g.d.length === g.w * g.h && Math.abs(g.dx - 1 / 960) < 1e-6, { w: g.w, h: g.h, n: g.d && g.d.length });
  const mid = g.d[Math.floor(g.h / 2) * g.w + Math.floor(g.w / 2)];
  check('Ρολόι: χάρτης βυθού: θάλασσα = θετικό βάθος σε μέτρα, στεριά = 0', mid > 20 && mid <= 40 && g.d[0] === 0 && g.d[g.w * (g.h - 1) + 3] === 40, { mid, land: g.d[0] });
  check('Ρολόι: χάρτης βυθού: η πρώτη γραμμή είναι η βόρεια (πιο ρηχή εδώ)', g.d[3] < g.d[g.w * (g.h - 1) + 3] && g.y0 > 34.70 && g.x0 < 32.60, { n: g.d[3], s: g.d[g.w * (g.h - 1) + 3] });
  check('Ρολόι: χάρτης βυθού: χωράει στη μνήμη του ρολογιού (< 4 KB)', JSON.stringify(g).length < 4096, JSON.stringify(g).length);
  dcorr = [[34.70, 32.60, 5, 1], [36, 30, 50, 1]];
  const r2 = await W.handle(new Request('https://x/functions/v1/watch?grid=1&lat=34.70&lon=32.60&code=ABC123'), F, RealDate.now());
  const g2 = await r2.json(); const mid2 = g2.d[Math.floor(g2.h / 2) * g2.w + Math.floor(g2.w / 2)];
  check('Ρολόι: χάρτης βυθού: μπαίνουν οι διορθώσεις βυθομέτρου του χρήστη (alkyon-dcorr)', g2.c === 1 && mid2 - mid >= 4 && mid2 - mid <= 5, { mid, mid2 });
  const corner = g2.d[g2.w * (g2.h - 1) + g2.w - 1], corner1 = g.d[g.w * (g.h - 1) + g.w - 1];
  check('Ρολόι: χάρτης βυθού: η διόρθωση σβήνει μακριά από τη μέτρηση', corner - corner1 < 4, { corner, corner1 });
  const st = fs.readFileSync(path.join(ROOT, 'v4', 'store.js'), 'utf8');
  check('Νέα: η έκδοση 1.9.89 υπάρχει στα «Τι νέο»', /\['1\.9\.89',\[T\('Ρολόι Garmin: μικρές διορθώσεις/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.88 (ρολόι, σχέδιο v6) υπάρχει στα «Τι νέο»', /\['1\.9\.88',\[T\('Ρολόι Garmin, νέο σχέδιο v6/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.87 (ρολόι, καθαρά γράμματα) υπάρχει στα «Τι νέο»', /\['1\.9\.87',\[T\('Ρολόι Garmin: καθαρά γράμματα/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.86 (ρολόι, καθαρότερες σελίδες) υπάρχει στα «Τι νέο»', /\['1\.9\.86',\[T\('Ρολόι Garmin: πιο καθαρές οι σελίδες/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.85 (ένας σταυρός στη διαλογή σημείου) υπάρχει στα «Τι νέο»', /\['1\.9\.85',\[T\('Νέα τοποθεσία από τον χάρτη/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.84 (διορθώσεις σχεδίου ρολογιού) υπάρχει στα «Τι νέο»', /\['1\.9\.84',\[T\('Ρολόι Garmin, διορθώσεις στο νέο σχέδιο/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.83 (νέο σχέδιο ρολογιού) υπάρχει στα «Τι νέο»', /\['1\.9\.83',\[T\('Ρολόι Garmin, νέο σχέδιο σε όλες τις σελίδες/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.82 υπάρχει στα «Τι νέο»', /\['1\.9\.82',\[T\('Ρολόι Garmin, συρτή βυθού: διόρθωση/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.81 υπάρχει στα «Τι νέο»', /\['1\.9\.81',\[T\('Ρολόι Garmin, «Ρίχνω»: αντίστροφη μέτρηση/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.80 υπάρχει στα «Τι νέο»', /\['1\.9\.80',\[T\('Ρολόι Garmin, «Ρίχνω»: προτείνει/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.79 (νέο σχέδιο στις άλλες σελίδες) υπάρχει στα «Τι νέο»', /\['1\.9\.79',\[T\('Ρολόι Garmin, νέο σχέδιο και στις άλλες σελίδες/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.78 υπάρχει στα «Τι νέο»', /\['1\.9\.78',\[T\('Ρολόι Garmin: η συρτή βυθού δεν λέει «μάζεψε 1»/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.76 (Ρίχνω κατευθείαν) υπάρχει στα «Τι νέο»', /\['1\.9\.76',\[T\('Ρολόι Garmin, συρτή βυθού: η «Συρτή βυθού» ανοίγει κατευθείαν/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.74 (διόρθωση UP/DOWN) υπάρχει στα «Τι νέο»', /\['1\.9\.74',\[T\('Ρολόι Garmin: διόρθωση, τα UP\/DOWN/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Νέα: η έκδοση 1.9.73 (UP/DOWN = μολύβια στο ρολόι) υπάρχει στα «Τι νέο»', /\['1\.9\.73',\[T\('Ρολόι Garmin, συρτή βυθού: τα κουμπιά UP\/DOWN/.test(fs.readFileSync(path.join(ROOT, 'v4', 'help.js'), 'utf8')));
  check('Εφαρμογή: οι διορθώσεις βυθομέτρου συγχρονίζονται (για να τις βλέπει το ρολόι)', /SETS=\[[^\]]*'alkyon-dcorr'/.test(st));
}

/* ---------- ρολόι: ψάρι με ένα πάτημα στη συρτή, αναίρεση, «Χάθηκε», είδος (1.9.75) ---------- */
{
  const tmp = path.join(ROOT, 'tests', '.watch-tmp3.mjs'); fs.writeFileSync(tmp, fs.readFileSync(path.join(ROOT, 'watch-index.ts'), 'utf8'));
  const W = await import(pathToFileURL(tmp).href); fs.unlinkSync(tmp);
  const db = new Map(), log = [];
  const bitesRows = [{ sp: 'Λουτσος', tech: 'Συρτή βυθού', w: null }, { sp: 'Λουτσος', tech: '', w: { m: 'bottom' } }, { sp: 'Σφυρίδα', tech: 'συρτή', w: null }, { sp: 'Σαργός', tech: 'Καθετή', w: null }, { sp: 'Σαργός', tech: 'Καθετή', w: null }, { sp: 'Σαργός', tech: 'Καθετή', w: null }, { sp: '', tech: 'συρτή', w: null, m: 'true' }];
  const F = async (url, opt = {}) => { url = String(url); const m = opt.method || 'GET'; log.push(m + ' ' + url);
    const res = (o, st = 200) => ({ ok: st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o) });
    if (url.includes('/rest/v1/watch_links')) return res([{ user_id: 'u1', lang: 'el' }]);
    if (url.includes('/rest/v1/records')) {
      const id = (url.match(/[?&]id=eq\.([A-Za-z0-9]+)/) || [])[1];
      if (m === 'POST') { const row = JSON.parse(opt.body)[0]; if (db.has(row.id)) return res({}, 409); db.set(row.id, row); return res({}, 201); }
      if (m === 'PATCH') { const b = JSON.parse(opt.body); if (db.has(id)) db.set(id, { ...db.get(id), ...b }); return res({}, 204); }
      if (url.includes('kind=eq.bites') && url.includes('select=sp:')) return res(bitesRows);
      if (id) return res(db.has(id) ? [{ data: db.get(id).data }] : []);
      return res([]);
    }
    return res({}, 404); };
  process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const post = async (b) => (await W.handle(new Request('https://x/functions/v1/watch', { method: 'POST', body: JSON.stringify(b) }), F, RealDate.now())).json();
  const cid = 'c' + RealDate.now().toString(36);
  const r1 = await post({ code: 'ABC123', kind: 'fish', ts: Math.floor(RealDate.now() / 1000), tz: 120, lat: 35.06, lon: 32.4, cid, tr: { m: 'b', n: 22, bd: 24.5, cl: 1.2 } });
  check('Ρολόι: το ψάρι γράφεται με τον κωδικό του ρολογιού (για αναίρεση) (1.9.75)', r1.ok === 1 && r1.id === cid && db.has(cid), r1);
  const r1b = await post({ code: 'ABC123', kind: 'fish', ts: Math.floor(RealDate.now() / 1000), tz: 120, cid });
  check('Ρολόι: αν το ρολόι ξαναστείλει το ίδιο ψάρι, δεν κολλάει η ουρά (409 = εντάξει)', r1b.ok === 1 && db.size === 1, r1b);
  check('Ρολόι: το ψάρι της συρτής κρατά βυθό και απόσταση από τον βυθό', db.get(cid).data.wtr && db.get(cid).data.wtr.bd === 24.5 && db.get(cid).data.wtr.cl === 1.2, db.get(cid).data.wtr);
  const r2 = await post({ code: 'ABC123', kind: 'upd', cid, sp: 'Λουτσος' });
  check('Ρολόι: είδος από το ρολόι μετά το ψάρι', r2.ok === 1 && db.get(cid).data.species === 'Λουτσος' && db.get(cid).data._u > 0, db.get(cid).data);
  const r3 = await post({ code: 'ABC123', kind: 'upd', cid, miss: 1 });
  check('Ρολόι: «Χάθηκε» μετά το ψάρι → γίνεται τσίμπημα που χάθηκε', r3.ok === 1 && db.get(cid).data.miss === true && db.get(cid).data.species === '', db.get(cid).data);
  const r4 = await post({ code: 'ABC123', kind: 'undo', cid });
  check('Ρολόι: αναίρεση ψαριού → σβήνεται από το Ημερολόγιο', r4.ok === 1 && db.get(cid).deleted === true, db.get(cid));
  const r5 = await post({ code: 'ABC123', kind: 'undo', cid: '' });
  check('Ρολόι: αναίρεση χωρίς κωδικό ψαριού → σφάλμα, όχι σβήσιμο', r5.ok === 0, r5);
  const r6 = await post({ code: 'ZZZ', kind: 'undo', cid });
  check('Ρολόι: αναίρεση χωρίς σωστό κωδικό ρολογιού → όχι', r6.ok === 0, r6);
  const spots = W.trollSpots([{ sp: 'Λουτσος', tech: 'Συρτή βυθού', la: '35.06', lo: '32.40', w: { n: 22, bd: 24 } }, { sp: 'Σαργός', tech: 'Καθετή', la: '35.061', lo: '32.401' }, { sp: '', tech: 'συρτή', m: 'true', la: '35.062', lo: '32.40' }, { sp: 'Σφυρίδα', tech: 'συρτή', la: '36.5', lo: '30.0' }, { sp: 'Λουτσος', tech: 'συρτή', la: '35.07', lo: '32.41' }], 35.06, 32.40);
  check('Ρολόι: σημεία ψαριών της συρτής κοντά στη βάρκα (κοντινότερα πρώτα, χωρίς καθετή, χαμένα και μακρινά) (1.9.77)', spots.length === 2 && spots[0][0] === 35.06 && spots[0][2] === 22 && spots[0][3] === 24 && spots[1][2] === null, spots);
  const ts = W.trollSpecies(bitesRows);
  check('Ρολόι: είδη για την επιλογή: πρώτα της συρτής, μετά τα άλλα, χωρίς τα «Χάθηκε»', JSON.stringify(ts) === JSON.stringify(['Λουτσος', 'Σφυρίδα', 'Σαργός']), ts);
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
