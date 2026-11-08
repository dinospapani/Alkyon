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
function world({ subs = [], notifLog = 'ok', W = calm, community = {} } = {}) {
  const log = new Set(), sent = [], calls = [];
  const res = (o, status = 200) => ({ ok: status < 400, status, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)) });
  const fetch = async (url, opt = {}) => {
    url = String(url); calls.push(url);
    if (url.includes('open-meteo.com')) return res(meteo(url, W));
    const m = url.match(/\/rest\/v1\/(.+)$/); if (!m) return res({ ok: false }, 404);
    const p = decodeURIComponent(m[1]), method = opt.method || 'GET';
    if (p.startsWith('notif_log') && method === 'POST') {
      if (notifLog === 'error') return res({ message: 'boom' }, 500);
      const row = JSON.parse(opt.body); if (log.has(row.id)) return res([]); log.add(row.id); return res([row]);
    }
    if (p === 'push_subs?select=id,user_id,sub,places') return res(subs);
    if (p.startsWith('community_posts?created_at')) return res(community.posts || []);
    if (p.startsWith('community_likes?')) return res(community.likes || []);
    if (p.startsWith('community_comments?')) return res(community.comments || []);
    if (p.startsWith('community_posts?id=in.')) return res(community.own || []);
    return res(method === 'GET' ? [] : null);
  };
  const webpush = { sendNotification: async (sub, payload) => { sent.push({ sub, ...JSON.parse(payload) }); return {}; } };
  return { fetch, webpush, sent, log, calls };
}
const go = async (w) => run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: w.fetch, PF, webpush: w.webpush, sendMail: null, log: () => {} });

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
  check('καλαμάρια: «Καλύτερο: … (βαθμός N)» και το μέρος', s[0] && /^Καλύτερο: \S+ \d\d\/11 \d\d:00–\d\d:00 \(βαθμός \d+\)/.test(s[0].body) && s[0].body.includes('Λατσί'), s[0]);
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
