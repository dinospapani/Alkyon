// P1.3a · «το ίδιο input δίνει τον ίδιο βαθμό παντού»: ο server (quick-processor) και το ρολόι βαθμολογούν με τις ρυθμίσεις του χρήστη
// (προφίλ ψαρέματος, είδος-στόχος, όρια), όπως η εφαρμογή του. Και: η βροχή σε mm δεν περνά ως πιθανότητα.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';
import { loadNew, plain, fakeMeteo } from './score-load.mjs';

const NOW = '2026-11-09T04:00:00Z', LIM = { wind: 18, wave: 1.4, gust: 30 }, SARGO = { n: 'Σαργός', l: 'Diplodus sargus', sst: [16, 24] }, SQUID = { n: 'Καλαμάρι', l: 'Loligo vulgaris', sst: [14, 24] };
const SPKB = [SARGO, SQUID], PROFS = ['boat', 'shore', 'lake', 'spear'];
/* η εφαρμογή: οι ρυθμίσεις στο localStorage του κινητού. Ο server/ρολόι: χωρίς localStorage, οι ίδιες ρυθμίσεις ρητά. */
const app = (prof, limits, sp) => loadNew({ now: NOW, storage: Object.assign({}, prof ? { 'alkyon-fprof': prof } : {}, limits ? { 'alkyon-limits': JSON.stringify(limits) } : {}, sp ? { 'alkyon-advsp': JSON.stringify(sp.n) } : {}), extra: { SPKB } });
const srv = () => loadNew({ now: NOW, storage: null });
const scores = fc => fc.days.map(d => [d.date, d.best, d.safe, d.win && [d.win.s, d.win.e], d.hours.map(h => [h.score, h.bite, h.safe])]);

test('same input, same score: the server/watch forecast with the user\'s profile, species and limits equals the app\'s forecast, hour by hour', async () => {
  let n = 0, hours = 0;
  for (const prof of PROFS) for (const limits of [null, LIM]) for (const sp of [null, SARGO, SQUID]) for (const seed of [11, 12, 13]) {
    const F = fakeMeteo(seed * 7 + n, { holes: n % 4 === 0 }), a = await app(prof, limits, sp).PF.getForecast(34.66, 33.04, F, { days: 7, sp: sp || undefined }), b = await srv().PF.getForecast(34.66, 33.04, F, { days: 7, prof, limits: limits || undefined, sp: sp || undefined });
    assert.deepEqual(plain(b), plain(a), `${prof} limits=${!!limits} sp=${sp && sp.n} seed=${seed}`); n++; hours += a.days.reduce((x, d) => x + d.hours.length, 0); }
  assert.equal(n, 72); assert.ok(hours > 10000, 'hours compared: ' + hours);
});

test('before the fix: without the user\'s settings the server scored shore, lake and spearfishing users as "boat" (different numbers)', async () => {
  const out = {};
  for (const prof of ['shore', 'lake', 'spear']) { let diff = 0, tot = 0, max = 0, days = 0, dd = 0;
    for (const seed of [21, 22, 23, 24, 25, 26]) { const F = fakeMeteo(seed), a = await app(prof).PF.getForecast(34.66, 33.04, F, { days: 7 }), old = await srv().PF.getForecast(34.66, 33.04, F, { days: 7 });
      a.days.forEach((d, i) => { days++; if (d.best !== old.days[i].best) dd++; d.hours.forEach((h, j) => { tot++; const x = Math.abs(h.score - old.days[i].hours[j].score); if (x > 0) diff++; if (x > max) max = x; }); }); }
    out[prof] = { hoursDiffer: Math.round(diff / tot * 100), max, daysDiffer: Math.round(dd / days * 100) }; assert.ok(diff > 0, prof + ' differs from boat'); }
  /* οι αριθμοί αυτοί μπαίνουν στο report του P1.3a */
  console.log('P1.3a before/after (server scored as boat vs the app): ' + JSON.stringify(out));
  /* «σκάφος» χωρίς ρυθμίσεις: κανένας βαθμός δεν αλλάζει */
  const F = fakeMeteo(31); assert.deepEqual(plain(await srv().PF.getForecast(34.66, 33.04, F, { days: 7, prof: 'boat' })), plain(await srv().PF.getForecast(34.66, 33.04, F, { days: 7 })));
  assert.deepEqual(plain(await srv().PF.getForecast(34.66, 33.04, F, { days: 7, prof: null, sp: null, limits: null })), plain(await srv().PF.getForecast(34.66, 33.04, F, { days: 7 })));
});

test('notifications: checkPlaces on the server with the user\'s profile and limits gives the same result as on the user\'s phone', async () => {
  const places = [{ id: 'p1', name: 'Λιμάνι', lat: 34.66, lon: 33.04 }];
  for (const prof of PROFS) for (const seed of [41, 42]) { const F = fakeMeteo(seed), cfg = { places, threshold: 70, pressure: true, turn: true, notified: {}, lang: 'el' };
    const a = await app(prof).PF.checkPlaces(Object.assign({}, cfg, { limits: LIM }), F), b = await srv().PF.checkPlaces(Object.assign({}, cfg, { limits: LIM, prof }), F);
    assert.deepEqual(plain(b), plain(a), prof + ' seed ' + seed); assert.ok(a.okN >= 1); }
});

test('userPrefs: one rule for which settings the server and the watch score with', () => {
  const { PF } = srv(), U = o => plain(PF.userPrefs(o));
  assert.deepEqual(U({}), { prof: null, sp: null, limits: null, src: null }); assert.deepEqual(U(null), { prof: null, sp: null, limits: null, src: null });
  /* σειρά πηγών: ό,τι έστειλε η εφαρμογή → ρυθμίσεις λογαριασμού → τελευταία καταγραφή */
  assert.equal(U({ places: [{ prof: 'spear' }], settings: { 'alkyon-fprof': 'shore' }, lastProf: 'lake' }).src, 'app'); assert.equal(U({ places: [{ prof: 'spear' }], lastProf: 'lake' }).prof, 'spear');
  assert.deepEqual([U({ places: [{}], settings: { 'alkyon-fprof': 'shore' }, lastProf: 'lake' }).prof, U({ settings: { 'alkyon-fprof': 'shore' } }).src], ['shore', 'settings']);
  assert.deepEqual([U({ lastProf: 'lake' }).prof, U({ lastProf: 'lake' }).src], ['lake', 'last']);
  assert.equal(U({ settings: { 'alkyon-fprof': '"shore"' } }).prof, 'shore', 'a JSON-quoted value is read too');
  for (const bad of ['yacht', '', null, 5, {}, 'BOAT']) assert.equal(U({ places: [{ prof: bad }], settings: { 'alkyon-fprof': bad }, lastProf: bad }).prof, null, 'unknown profile → as before (boat): ' + JSON.stringify(bad));
  assert.deepEqual(U({ places: [{ lat: 1 }, { sp: SARGO }] }).sp, SARGO); assert.equal(U({ places: [{ sp: 'Σαργός' }, { sp: {} }] }).sp, null);
  assert.deepEqual(U({ settings: { 'alkyon-limits': { wind: 18, wave: 1.4, gust: 30, x: 9 } } }).limits, LIM); assert.deepEqual(U({ settings: { 'alkyon-limits': { wind: 'a', wave: -1, gust: 25 } } }).limits, { gust: 25 });
  assert.equal(U({ settings: { 'alkyon-limits': 'x' } }).limits, null);
});

test('server: reads the user\'s settings once and passes profile and limits to the notification check and the weekly summary', () => {
  const job = fs.readFileSync(path.join(ROOT, 'safety-job.mjs'), 'utf8'), edge = fs.readFileSync(path.join(ROOT, 'quick-processor-index.ts'), 'utf8');
  assert.match(job, /const up = await prefsOf\(r\.user_id, r\.places\);/); assert.match(job, /prof: up\.prof, limits: up\.limits \|\| undefined, places: r\.places \|\| \[\],/);
  assert.match(job, /PF\.getForecast\(\+pl\.lat, \+pl\.lon, F, \{ days: 7, learn: false, prof: up\.prof, sp: up\.sp, limits: up\.limits \}\)/);
  assert.match(job, /return PF\.userPrefs\(\{ places: places \|\| \[\], settings: c && c\.settings, lastProf: c && c\.lastProf \}\)/, 'the rule itself lives in forecast.js');
  assert.ok(edge.includes('function userPrefs(o)') && edge.includes('const prefsOf = async (uid, places)'), 'the Edge Function bundle carries it');
});

test('rain: recorded rain in mm is passed as mm only, never as rain probability', () => {
  const job = fs.readFileSync(path.join(ROOT, 'safety-job.mjs'), 'utf8'), fcHour = job.slice(job.indexOf('const fcHour = '), job.indexOf('const fcHour = ') + 700);
  assert.match(fcHour, /pres: f\.press, mm: f\.rain, clp: f\.cloud/); assert.ok(!/\brain: f\.rain/.test(fcHour), 'mm is not copied into the probability field');
  assert.ok(!/rain, mm: rain/.test(fs.readFileSync(path.join(ROOT, 'tools/score-eval.mjs'), 'utf8')), 'the evaluation tool no longer reproduces the bug');
  /* τι σημαίνει για τον βαθμό: το mm δεν τον αγγίζει ποτέ· μόνο η πιθανότητα (%) έχει όρο */
  const { PF, AS } = srv(), sm = PF.sunMoon('2026-11-09', 34.66, 33.04, 120), w = { wind: 6, gust: 9, wave: 0.3, pres: 1012, ptrend: 'slow', cloud: 'part', clp: 40, temp: 22, sst: 22 };
  for (const prof of PROFS) for (const hr of [6, 12, 18]) for (const mm of [0, 0.1, 5, 45, 80]) assert.equal(PF.hourScore(sm, hr, Object.assign({ prof, mm }, w)), PF.hourScore(sm, hr, Object.assign({ prof }, w)), `mm ${mm} ${prof} ${hr}`);
  /* το παλιό λάθος: 45 mm/ώρα διαβαζόταν ως «45% πιθανότητα» (λίμνη +1) και 80 mm ως «80%» (−2) */
  assert.notEqual(PF.hourScore(sm, 12, Object.assign({ prof: 'boat', rain: 80 }, w)), PF.hourScore(sm, 12, Object.assign({ prof: 'boat' }, w)));
  assert.equal(AS.bins(sm, Object.assign({ hr: 12, mm: 0.5, t: '2026-11-09T12:00' }, w)).rain, 1, 'the learning class "it rained" still comes from mm');
});

test('watch: the forecast on the watch uses the user\'s profile, species and limits and equals the app (and stays as before without a code)', async () => {
  process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const tmp = path.join(ROOT, 'tests', 'unit', '.tmp-p13a-watch-' + process.pid + '.mjs'); fs.writeFileSync(tmp, fs.readFileSync(path.join(ROOT, 'watch-index.ts'), 'utf8'));
  let W; try { W = await import(pathToFileURL(tmp).href); } finally { fs.unlinkSync(tmp); }
  const now = Date.parse(NOW), M = fakeMeteo(51), res = (o, st = 200) => ({ ok: st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o) });
  const mk = (user) => async (url, opt = {}) => { url = String(url); const u = new URL(url), q = u.searchParams;
    if (url.includes('open-meteo')) return M(url);
    if (u.pathname.endsWith('/watch_links')) return res((opt.method || 'GET') === 'GET' ? [{ user_id: 'u1', lang: 'el', last_used_at: new Date(now).toISOString() }] : {});
    if (u.pathname.endsWith('/records') && q.get('kind') === 'eq.settings') return res(user.settings ? [{ data: user.settings }] : []);
    if (u.pathname.endsWith('/records') && q.get('kind') === 'in.(trips,bites)') return res(user.last || []);
    if (u.pathname.endsWith('/push_subs')) return res(user.places ? [{ places: user.places }] : []);
    return res([]); };
  const get = async (user, code, lat) => { globalThis.__ALKYON_PF = srv().PF; const r = await W.handle(new Request('https://x/functions/v1/watch?lat=' + lat + '&lon=33.04' + (code ? '&code=ABC123' : '')), mk(user), now); return r.json(); };
  const sc = v => plain([v.days.map(d => [d.s, d.w, d.x]), (v.hrs || v.h || []).map(h => h.s)]);
  const want = async (prof, limits, sp) => { const fc = await app(prof, limits, sp).PF.getForecast(34.66 + 0, 33.04, M, { days: 6, sp: sp || undefined }); globalThis.__ALKYON_PF = srv().PF; return sc(W.compact(app(prof, limits, sp).PF, fc, false, 34.66, 33.04)); };
  /* διαφορετικό πλάτος σε κάθε περίπτωση, ώστε να μην παίζει ρόλο η προσωρινή μνήμη του ρολογιού */
  const shore = await get({ last: [{ p: 'boat', s: 'watch' }, { p: 'shore', s: null }] }, true, 34.66);
  assert.deepEqual(sc(shore), await want('shore'), 'profile from the last record (watch-made records are skipped)');
  const boat = await get({}, false, 34.66); assert.deepEqual(sc(boat), await want('boat'), 'no code → as before');
  assert.notDeepEqual(sc(shore), sc(boat), 'the shore user no longer gets the boat numbers on the watch');
  const full = await get({ settings: { 'alkyon-limits': LIM }, places: [{ prof: 'spear', sp: SARGO }], last: [{ p: 'lake' }] }, true, 34.66);
  assert.deepEqual(sc(full), await want('spear', LIM, SARGO), 'what the app sent wins; limits from the account settings');
  delete globalThis.__ALKYON_PF;
});

test('readiness meter: counts against the thresholds of the config; information only', async () => {
  const { PF, AS, CFG } = srv(), R = c => plain(PF.readiness(c)), lib = await import(pathToFileURL(path.join(ROOT, 'tools', 'score-eval-lib.mjs')).href);
  assert.deepEqual(plain(CFG.evalGate), { minTrips: 150, minUsers: 10, minPos: 30, minDelta: 0.03 }); assert.deepEqual(plain(CFG.evalGate), lib.GATE, 'the same thresholds the P1.2 evaluation tool uses');
  assert.deepEqual(R({ trips: 9, users: 4, pos: 3 }), { trips: 9, users: 4, pos: 3, need: { trips: 150, users: 10, pos: 30 }, missing: { trips: 141, users: 6, pos: 27 }, pct: 6, open: false });
  assert.equal(R({ trips: 150, users: 10, pos: 30 }).open, true); assert.equal(R({ trips: 400, users: 10, pos: 29 }).open, false, 'every threshold must be met'); assert.equal(R({ trips: 400, users: 9, pos: 90 }).open, false);
  assert.deepEqual(R({}), R({ trips: -3, users: 'x', pos: null })); assert.equal(R(null).pct, 0); assert.equal(R({ trips: 900, users: 90, pos: 900 }).pct, 100);
  /* μόνο πληροφορία: τίποτα στον βαθμό, στη μάθηση ή στον server δεν διαβάζει το αποτέλεσμα */
  const srcs = ['score-core.js', 'forecast.js', 'safety-job.mjs', 'watch-index.ts'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  assert.equal((srcs.match(/\.ready\b/g) || []).length, 1, 'data.ready is written once and read by nothing on the scoring side'); assert.ok(!/READY\.open|ready\.open|\.open\s*\)\s*\{[^}]*learn/.test(srcs));
  assert.equal((srcs.match(/\.evalGate/g) || []).length, 1, 'the gate is read only by the meter');
  assert.equal(AS.config.learn.minN, 15); assert.deepEqual(plain(AS.config.confidence.adjust), { modelDisagree: -1, noLocal: 0, evidenceStrong: 0 }, 'learning thresholds and locality/evidence weights are untouched');
});

test('app: sends its fishing profile with the notification places and to the service worker', () => {
  const av = fs.readFileSync(path.join(ROOT, 'v4/alerts-view.js'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(av, /sp:spCfg\(\),prof:B\.prof\(\),lang:B\.LANG/); assert.match(av, /p\.prof=B\.prof\(\);/); assert.match(sw, /await PF\.checkPlaces\(cfg\)/);
});
