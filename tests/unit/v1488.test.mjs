// 1.14.88 · διάγνωση και φίλτρο διαδρομής GPS, έξοδος με 0 ψάρια («Έπιασες κάτι;»), προφίλ στις καταγραφές του ρολογιού, συγχρονισμός τρόπου ψαρέματος,
// μπάρα ραντάρ στην αλλαγή πηγής. Δεν αγγίζει βάρη, βαθμό ή μάθηση (το ελέγχει το τελευταίο test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';
import { loadNew, plain } from './score-load.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/* παίρνει μια συνάρτηση από αρχείο της εφαρμογής (που τρέχει μόνο σε browser) όπως ακριβώς είναι γραμμένη */
function fn(src, name) { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, 'function ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(i, k + 1); } } throw new Error('unbalanced ' + name); }
const TRIP = rd('v4/trip.js');
const G = new Function('NT', 'navigator', ['dist', 'simplify', 'dwell', 'pathM', 'need', 'gpsVerdict'].map(n => fn(TRIP, n)).join('\n') + '\nvar STOP_R=25, STOP_MS=120000; return {dist,simplify,dwell,pathM,need,gpsVerdict};')(() => null, { userAgent: '' });
const LAT = 34.7, MLAT = 1 / 111320, MLON = 1 / (111320 * Math.cos(LAT * Math.PI / 180));
const at = (x, y, t) => [LAT + y * MLAT, 33 + x * MLON, t];
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

test('GPS stop filter: a moving track is left exactly as it is', () => {
  const walk = []; for (let i = 0; i < 200; i++) walk.push(at(i * 12, 0, i * 9000));            // περπάτημα 1,3 m/s
  const troll = []; for (let i = 0; i < 200; i++) troll.push(at(i * 12, Math.sin(i / 9) * 40, i * 12000));   // συρτή ~2 κόμβοι
  for (const p of [walk, troll]) { const r = G.dwell(p); assert.equal(r.stops, 0); assert.equal(r.cut, 0); assert.deepEqual(r.pts, p); }
});

test('GPS stop filter: standing still becomes one point, and the false distance disappears', () => {
  const p = []; let t = 0;
  for (let i = 0; i < 30; i++) p.push(at(i * 12, 0, t += 9000));                                // έρχεσαι
  const x0 = 29 * 12; for (let i = 0; i < 45; i++) p.push(at(x0 + (rnd() - .5) * 30, (rnd() - .5) * 30, t += 40000));   // 30 λεπτά στο ίδιο σημείο, τρέμουλο ±15 m
  for (let i = 1; i <= 30; i++) p.push(at(x0 + i * 12, 0, t += 9000));                          // φεύγεις
  const r = G.dwell(p), raw = G.pathM(p), clean = G.pathM(r.pts);
  assert.equal(r.stops, 1, 'one stop'); assert.ok(r.cut >= 40, 'jitter points removed: ' + r.cut);
  assert.ok(raw > 1100, 'the raw track is inflated by the jitter: ' + Math.round(raw)); assert.ok(Math.abs(clean - 708) < 40, 'true distance 708 m, got ' + Math.round(clean));
  assert.ok(Math.min(...r.pts.map(q => G.dist(q, at(x0, 0, 0)))) < 10, 'the stop sits at the centre of the jitter');
});

test('GPS stop filter: a stop interrupted by a GPS jump stays one stop; a slow drift is kept as a line', () => {
  const p = []; let t = 0;
  for (let i = 0; i < 12; i++) p.push(at((rnd() - .5) * 20, (rnd() - .5) * 20, t += 30000));
  p.push(at(55, 20, t += 30000));                                                               // πέταγμα 58 m
  for (let i = 0; i < 12; i++) p.push(at((rnd() - .5) * 20, (rnd() - .5) * 20, t += 30000));
  const r = G.dwell(p); assert.equal(r.stops, 1); assert.equal(r.pts.length, 1, JSON.stringify(r.pts.length));
  const drift = []; for (let i = 0; i <= 40; i++) drift.push(at(i * 13, 0, i * 87000));           // 0,15 m/s για ~1 ώρα (520 m)
  const d = G.dwell(drift); assert.ok(d.pts.length >= 8, 'the drift is still a line: ' + d.pts.length + ' points'); assert.ok(Math.abs(G.pathM(d.pts) - 520) < 80, 'drift length kept: ' + Math.round(G.pathM(d.pts)));
});

test('GPS track: the saved line keeps corners within the 6 m tolerance; spacing follows GPS accuracy up to 25 m', () => {
  const p = []; for (let i = 0; i <= 20; i++) p.push(at(i * 12, 0, i)); for (let i = 1; i <= 20; i++) p.push(at(240, i * 12, 20 + i));
  const s = G.simplify(p.map(q => [q[0], q[1]]), 6); assert.equal(s.length, 3, 'two straight streets → 3 points'); assert.ok(G.dist(s[1], at(240, 0, 0)) < 1, 'the corner point itself is kept');
  assert.equal(G.need([0, 0, 0], [0, 0, 0]), 12); assert.equal(G.need([0, 0, 0, 5], [0, 0, 0, 8]), 12); assert.equal(G.need([0, 0, 0, 18], [0, 0, 0, 9]), 18); assert.equal(G.need([0, 0, 0, 55], [0, 0, 0]), 25);
});

test('GPS diagnostic: the verdict separates sampling, recording, merging and accuracy', () => {
  const H = 3600000, V = (g, d) => G.gpsVerdict(g, d || H).code, n = o => Object.assign({ raw: 700, acc: 10, near: 300, kept: 390, gaps60: 0, gapMax: 9, half: 0, t0: 1e12, t1: 1e12 + H, every: 5 }, o);
  assert.equal(V({ src: 'android', nat: 390, end: 'ok', n: n() }), 'ok');
  assert.equal(V({ src: 'android', nat: 60, end: 'ok', n: n({ raw: 70, kept: 60, gaps60: 40, gapMax: 300 }) }), 'sampling', '70 positions where 720 were expected');
  assert.equal(V({ src: 'android', nat: 100, end: 'ok', n: n({ raw: 200, kept: 100, t1: 1e12 + H / 4 }) }), 'recording', 'the service covered a quarter of the trip');
  assert.equal(V({ src: 'android', nat: 0, end: 'ok' }), 'recording', 'the background service never reported');
  assert.equal(V({ src: 'android', nat: 120, end: 'ok', n: n() }), 'merging', '390 written, 120 reached the track');
  assert.equal(V({ src: 'android', nat: 390, end: 'timeout', n: n() }), 'merging', 'the end of the trip did not wait for the points');
  assert.equal(V({ src: 'ios', nat: 100, end: 'ok', n: n({ raw: 3000, acc: 1500, kept: 100, every: 1 }) }), 'accuracy');
  assert.equal(V({ src: 'ios', nat: 390, end: 'ok', n: n({ raw: 3500, every: 1 }) }), 'ok', 'iOS reports about one position a second');
  assert.equal(V({ src: 'web', nat: 0 }), 'ok', 'in the browser there is no background service'); assert.equal(G.gpsVerdict(null), null);
  assert.equal(V({ src: 'android', nat: 195, end: 'ok', n: n({ half: 1 }) }), 'ok', 'a thinned buffer is not counted as loss');
});

test('GPS diagnostic: every stage counts, on Android, iOS and in the app', () => {
  const sv = rd('android/app/src/main/java/com/alkyonfishing/app/AlkTripService.java'), pl = rd('android/app/src/main/java/com/alkyonfishing/app/AlkTripPlugin.java'), sw = rd('ios/App/App/AlkTripPlugin.swift');
  for (const k of ['raw', 'acc', 'near', 'kept', 'gaps60', 'gapMax', 'half', 't0', 't1']) { assert.ok(sv.includes('d.put("' + k + '"'), 'android ' + k); assert.ok(sw.includes('d["' + k + '"]'), 'ios ' + k); }
  assert.ok(/requestLocationUpdates\(LocationManager\.GPS_PROVIDER, 5000L, 0f/.test(sv), 'positions every 5 s also when not moving, so a gap means the phone gave none');
  assert.ok(/distanceTo\(l\) >= 12 \|\| l\.getTime\(\) - last\.getTime\(\) >= 60000/.test(sv), 'which points are written did not change');
  assert.ok(pl.includes('r.put("diag"') && sw.includes('"diag": d'), 'the counters travel with the points');
  for (const k of ['js', 'jsAcc', 'jsNear', 'nat', 'natAcc', 'mNear', 'mJump', 'mg', 'half', 'end', 'raw', 'stops', 'cut', 'out', 'eps', 'gapMax', 'gaps60', 'kmRaw']) assert.ok(new RegExp('\\b' + k + ':').test(fn(TRIP, 'gpsDiag')), 'trip diagnostic field ' + k);
  assert.ok(TRIP.includes("if(tk.gps) rec.gps=tk.gps"), 'stored with the trip'); assert.ok(/setTimeout\(function\(\)\{ go\('timeout'\); \},5000\)/.test(TRIP), 'the end of the trip waits up to 5 s for the background points');
  assert.ok(fn(TRIP, 'takeTrack').includes('dwell(t.pts)') && fn(TRIP, 'takeTrack').includes('pathM(dw.pts)'), 'stops are removed before the line is saved and before the distance is measured');
  assert.ok(rd('v4/profile-view.js').includes('B.gpsVerdict(g,t.endMs-t.startMs)'), 'shown in Admin with the same rule');
});

const { AS, CFG } = loadNew({ storage: null }), S = t => plain(AS.session(t));
const T0 = 1794586911976, HR = 3600000, live = o => Object.assign({ startMs: T0, endMs: T0 + 4 * HR + 123, lat: 34.9, lon: 32.3, sid: 's1', count: 0 }, o);

test('zero-fish trip: "caught nothing" counts, "caught but not logged" leaves the accuracy check', () => {
  assert.deepEqual(S(live({ fish0: 'none' })), { kind: 'live', valid: true, why: null, k: 'l' });
  assert.deepEqual(S(live({ fish0: 'unlogged' })), { kind: 'unlogged', valid: false, why: 'catch not logged', k: 'u' });
  assert.equal(S(live({ fish0: 'log' })).kind, 'unlogged', 'said "I will log them" and nothing was logged: outcome unknown');
  assert.deepEqual(S(live({ fish0: 'log', count: 2 })), { kind: 'live', valid: true, why: null, k: 'l' }, 'once the catches are logged the trip counts, with fish');
  assert.deepEqual(S(live()), { kind: 'live', valid: true, why: null, k: 'l' }, 'no answer: as before');
  /* ο server βλέπει μόνο το cond.k */
  assert.equal(S({ ms: T0, ms2: T0 + 3 * HR, lat: 35, cnt: 0, cond: { k: 'u' } }).valid, false); assert.equal(S({ ms: T0, ms2: T0 + 3 * HR, lat: 35, cnt: 0, cond: { k: 'l' } }).valid, true);
  assert.equal(CFG.version, '2026.11-1', 'the score config did not change');
});

test('zero-fish trip: the question, its three answers and the catch form tied to the trip', () => {
  const z = fn(TRIP, 'zeroQuestion');
  for (const t of ['Δεν έπιασα τίποτα', 'Έπιασα, θα τα γράψω τώρα', 'Έπιασα, αλλά δεν θα τα γράψω']) assert.ok(z.includes("T('" + t + "'"), t);
  assert.ok(z.includes("set('none',{rate:0})") && z.includes("set('log')") && z.includes("set('unlogged')"));
  assert.ok(z.includes('B.biteForm(null,{trip:sid'), 'the catch form opens tied to the trip that just ended');
  assert.ok(TRIP.includes("var next=(sm.n>0||(sm.pn||0)>0)?rate:function(){ zeroQuestion(id,s.id,pos,rate,sea); };"), 'asked only when the trip ended with no fish');
  assert.ok(rd('v4/bite-form.js').includes("tid=(sf.active&&sf.id)?sf.id:(opt&&opt.trip)||null"), 'a catch logged right after the trip is counted in it');
  const g = {}; new Function('window', 'module', rd('personal.js'))(g, undefined); const ok = live({ fish0: 'none' }), un = live({ fish0: 'unlogged' }), lg = live({ fish0: 'log' }), lg2 = live({ fish0: 'log', count: 1 });
  assert.deepEqual(g.PP.sessionsOf([ok, un, lg, lg2, live()]).map(t => t.fish0 || '-'), ['none', 'log', '-'], 'on-device learning skips trips whose catch was not logged');
});

test('server stats: a trip flagged "caught but not logged" is counted by kind and left out of the check', async () => {
  const RealDate = Date, NOW = RealDate.parse('2026-11-19T10:00:00Z');
  class FD extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } globalThis.Date = FD;
  try {
    const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', rd(f))(g);
    const { run } = await import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href + '?v1488');
    const rows = [], D0 = RealDate.parse('2026-08-01T00:00:00Z'); let id = 1;
    for (let i = 0; i < 30; i++) { const st = D0 + i * 36 * HR + 5 * HR + 1234 + i * 77, dur = 3 * HR + 4321, e = []; for (let t = st; t < st + dur; t += HR) e.push({ t, wind: 6, gust: 9, wave: 0.3, press: 1012, pt: -1.5, rain: 0, cloud: 30, temp: 24, sst: 23, tide: 0.05 });
      const un = i % 3 === 0, fish = !un && i % 2 ? 2 : 0;
      rows.push({ id: id++, user_id: 'u' + (i % 5), kind: 'trip', sp: null, day: new RealDate(st).toISOString().slice(0, 10), ms: st, ms2: st + dur, lat: 34.7, lon: 33, cnt: fish, tech: null, prof: 'boat', cond: { e, k: un ? 'u' : 'l' } });
      for (let k = 0; k < fish; k++) rows.push({ id: id++, user_id: 'u' + (i % 5), kind: 'catch', sp: 'pagrus pagrus', day: new RealDate(st).toISOString().slice(0, 10), ms: st + HR, ms2: null, lat: 34.7, lon: 33, cnt: 1, tech: 'jig', prof: 'boat', cond: { wind: 6, wave: 0.3, pres: 1012, pt: -1.5, hr: 9, sm: { rise: 6, set: 18 } } }); }
    const posts = {}, res = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)), headers: new Map() });
    const F = async (url, opt = {}) => { url = String(url); const m = (opt.method || 'GET').toUpperCase();
      if (url.includes('/rest/v1/catch_obs') && m === 'GET') { const off = +(/offset=(\d+)/.exec(url) || [0, 0])[1]; return res(rows.slice(off, off + 1000)); }
      if (m !== 'GET') { const t = /\/rest\/v1\/(\w+)/.exec(url); if (t && opt.body) { try { (posts[t[1]] = posts[t[1]] || []).push(JSON.parse(opt.body)); } catch (e) { } } return res(m === 'POST' && /rpc\//.test(url) ? true : null); }
      if (url.includes('open-meteo')) return res({ error: true }, 500); return res([]); };
    const logs = []; await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: F, PF: g.PF, webpush: null, sendMail: null, log: x => logs.push(String(x)) });
    const all = (posts.bite_stats || []).flat().find(x => x.key === 'all'); assert.ok(all, 'stats written: ' + logs.slice(-3).join(' | '));
    assert.deepEqual(all.data.ses, { unlogged: 10, live: 20 }); assert.equal(all.data.ready.trips, 20, 'the readiness meter counts only the 20 valid trips'); assert.equal(all.data.acc.trips, 20); assert.equal(all.data.btv.n, 20);
  } finally { globalThis.Date = RealDate; }
});

test('watch: what the watch records carries the user\'s fishing profile, not always "boat"', async () => {
  process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const tmp = path.join(ROOT, 'tests', 'unit', '.tmp-v1488-watch-' + process.pid + '.mjs'); fs.writeFileSync(tmp, rd('watch-index.ts'));
  let W; try { W = await import(pathToFileURL(tmp).href); } finally { fs.unlinkSync(tmp); }
  const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', rd(f))(g);
  const now = Date.parse('2026-11-19T10:00:00Z'), res = (o, st = 200) => ({ ok: st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o) });
  const mk = (user, wrote) => async (url, opt = {}) => { url = String(url); const u = new URL(url), q = u.searchParams, m = (opt.method || 'GET').toUpperCase();
    if (u.pathname.endsWith('/watch_links')) return res(m === 'GET' ? [{ user_id: 'u1', lang: 'el', last_used_at: new Date(now).toISOString() }] : {});
    if (u.pathname.endsWith('/records') && m === 'POST') { wrote.push(...JSON.parse(opt.body)); return res(null, 201); }
    if (u.pathname.endsWith('/records') && q.get('kind') === 'eq.settings') return res(user.settings ? [{ data: user.settings }] : []);
    if (u.pathname.endsWith('/records') && q.get('kind') === 'in.(trips,bites)') return res(user.last || []);
    return res([]); };
  const post = async (user, body) => { const wrote = []; globalThis.__ALKYON_PF = g.PF; const r = await W.handle(new Request('https://x/functions/v1/watch', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.' + (post.n = (post.n || 0) + 1) }, body: JSON.stringify(Object.assign({ code: 'ABC123' }, body)) }), mk(user, wrote), now); return { st: r.status, wrote }; };
  const ts = Math.floor(now / 1000);
  let r = await post({ last: [{ p: 'boat', s: 'watch' }, { p: 'shore', s: null }] }, { kind: 'trip', ts: ts - 7200, te: ts, n: 0, pts: [] });
  assert.equal(r.st, 200); assert.equal(r.wrote.find(x => x.kind === 'trips').data.prof, 'shore', 'trip from the watch: profile of the last record made in the app');
  r = await post({ settings: { 'alkyon-fprof': 'spear' }, last: [{ p: 'shore' }] }, { kind: 'fish', t: now - 60000, lat: 34.7, lon: 33 });
  assert.equal(r.wrote.find(x => x.kind === 'bites').data.prof, 'spear', 'catch from the watch: profile from the account settings first');
  r = await post({}, { kind: 'fish', t: now - 60000 }); assert.equal(r.wrote.find(x => x.kind === 'bites').data.prof, 'boat', 'nothing known: boat, as before');
  delete globalThis.__ALKYON_PF;
});

test('account settings: the fishing profile (plain text in storage) now syncs both ways', () => {
  const src = rd('v4/store.js'), mem = {}, ls = { raw: k => (k in mem ? mem[k] : null), get: (k, d) => { try { return k in mem ? JSON.parse(mem[k]) : d; } catch (e) { return d; } }, set: (k, v) => { mem[k] = JSON.stringify(v); } };
  const X = new Function('ls', 'localStorage', "var RAWS={'alkyon-fprof':1}, SETS=['alkyon-limits','alkyon-fprof'];\n" + ['setGet', 'setPut', 'setBlob'].map(n => fn(src, n)).join('\n') + '\nreturn {setGet,setPut,setBlob};')(ls, { setItem: (k, v) => { mem[k] = v; } });
  mem['alkyon-fprof'] = 'shore'; mem['alkyon-limits'] = '{"wind":14}';
  assert.equal(ls.get('alkyon-fprof', undefined), undefined, 'the old way could not read it, so it never reached the account');
  assert.deepEqual(X.setBlob(), { 'alkyon-limits': { wind: 14 }, 'alkyon-fprof': 'shore' });
  X.setPut('alkyon-fprof', 'spear'); assert.equal(mem['alkyon-fprof'], 'spear', 'written back as plain text, the way the app reads it'); X.setPut('alkyon-fprof', null); assert.equal(mem['alkyon-fprof'], 'spear');
  mem['alkyon-fprof'] = '"lake"'; assert.equal(X.setGet('alkyon-fprof'), 'lake'); assert.ok(src.includes("SETS.forEach(function(k){ var v=setGet(k);") && src.includes("if(setPut(k,rd[k])) got[k]=1;"));
  assert.ok(rd('android/app/src/main/AndroidManifest.xml').includes('<uses-feature android:name="android.hardware.wifi" android:required="false" />'), 'Wi-Fi is declared optional');
});

test('map: switching radar source keeps the time bar in place (the main menu no longer flashes in between)', () => {
  const m = rd('v4/map-view.js'), mk = fn(m, 'rainBarMake'), st = fn(m, 'rainStop');
  assert.ok(st.includes("if(keep){ rainBar.classList.add('rbwait')") && st.includes('else { rainBar.remove(); rainBar=null; }'));
  assert.ok(mk.includes('drawRain(true)'), 'the switch button keeps the bar'); assert.ok(mk.indexOf('document.body.append(rainBar)') < mk.indexOf('oldBar.remove()') && mk.indexOf('oldBar.remove()') > 0, 'the new bar is added before the old one is removed');
  assert.ok(fn(m, 'drawRain').includes('rainStop(sw===true)') && (m.match(/rainBarDrop\(\)/g) || []).length >= 5, 'if the new source fails, the waiting bar is removed');
  assert.ok(m.includes("onclick:function(){ cfg.rain=false; saveCfg(); rainStop(); }"), 'closing the radar still removes the bar at once');
});

test('1.14.88 does not touch the score: config, weights and golden parity inputs are unchanged', () => {
  assert.equal(CFG.version, '2026.11-1'); assert.deepEqual(plain(CFG.learn), { shrink: 60, min: 0.85, max: 1.15, minN: 15 }); assert.deepEqual(plain(CFG.confidence.adjust), { modelDisagree: -1, noLocal: 0, evidenceStrong: 0 });
});

// ---------- 1.14.89 ----------
test('1.14.89 notifications: "Plan for tomorrow" and "Your week" are written in the user\'s language, not half Greek and half English', () => {
  const s = rd('safety-job.mjs'), GR = /[Ͱ-Ͽ]/, bad = [];
  /* κανένα κείμενο ειδοποίησης με ελληνικά ΚΑΙ αγγλική «ουρά» μετά από « · ». Εξαίρεση: το μήνυμα προς τις επαφές ασφαλείας (δεν ξέρουμε τη γλώσσα του παραλήπτη). */
  s.split('\n').forEach((l, i) => { if (/Not back yet|not confirmed/.test(l)) return; for (const m of l.matchAll(/'((?:[^'\\]|\\.)*)'/g)) { const t = m[1]; if (GR.test(t) && /· [A-Z][a-z]+ [a-z]+/.test(t)) bad.push((i + 1) + ': ' + t.slice(0, 70)); } });
  assert.deepEqual(bad, []);
  const best = s.slice(s.indexOf("const nid = 'best:'"), s.indexOf("stats.best = "));
  assert.ok(best.includes("const en = !!subs.find(r => (r.places || []).find(p => p && p.lang === 'en')), LB = en ? LBL_EN : LBL;"), 'language from what the app sent, like the other notifications');
  assert.ok(best.includes("title: '🎯 Plan for tomorrow: ' + tz + '–' + tz2,") && best.includes("title: '🎯 Το σχέδιο για αύριο: ' + tz + '–' + tz2,"));
  const en = best.slice(best.indexOf('const msg = en ?'), best.indexOf(": { id: nid, kind: 'best'")), el = best.slice(best.indexOf(": { id: nid, kind: 'best'"));
  assert.ok(!GR.test(en.replace(/🎯/g, '')), 'the English version has no Greek'); assert.ok(!/[A-Za-z]{4,} [a-z]{3,} [a-z]{3,}/.test((el.match(/'[^']*'/g) || []).filter(x => GR.test(x)).join(' ')), 'the Greek version has no English sentence');
  /* οι ετικέτες συνθηκών υπάρχουν και στις δύο γλώσσες, με τα ίδια κλειδιά και το ίδιο πλήθος */
  const tab = n => new Function('return ' + s.slice(s.indexOf('const ' + n + ' = {') + ('const ' + n + ' = ').length, s.indexOf('};', s.indexOf('const ' + n + ' = {')) + 1))(), A = tab('LBL'), E = tab('LBL_EN');
  assert.deepEqual(Object.keys(E).sort(), Object.keys(A).sort()); for (const k of Object.keys(A)) { assert.equal(E[k].length, A[k].length, k); assert.ok(E[k].every(x => !GR.test(x)) && A[k].every(x => GR.test(x) || /kn|m$|\d/.test(x)), k); }
  const wk = s.slice(s.indexOf("const nid = 'week:'"), s.indexOf("stats.week = ")); assert.ok(wk.includes("title: '📅 Your week',") && wk.includes("title: '📅 Η εβδομάδα σου',") && wk.includes("(enW ? DNE : DNW)[dix]"));
});

test('1.14.89 notifications list: the same notification from the phone and from the server is shown once', () => {
  const a = rd('v4/alerts-view.js'); assert.ok(a.includes("if(x.id&&seen['#'+x.id]) return; if(tl.some(function(m){ return Math.abs(m-ms)<180000; })) return;"));
  /* ο ίδιος κανόνας, όπως είναι γραμμένος, σε δεδομένα: ίδιος τίτλος 70″ μετά (άλλο λεπτό) = ίδια· ίδιος κωδικός = ίδια· ίδιος τίτλος 2 ώρες μετά = άλλη */
  const body = a.slice(a.indexOf("var ms=Date.parse(x.at)||0, ti=x.title||''"), a.indexOf("all.push(x); });", a.indexOf("var ms=Date.parse(x.at)||0")) + 12);
  const run = list => { const seen = {}, all = []; list.forEach(new Function('seen', 'all', 'return function(x){ if(!x||!x.at) return; ' + body + ' }')(seen, all)); return all.length; };
  const T = Date.parse('2026-11-19T15:00:50Z'), at = d => new Date(T + d * 1000).toISOString();
  assert.equal(run([{ at: at(0), title: 'Plan' }, { at: at(70), title: 'Plan' }]), 1); assert.equal(run([{ at: at(0), title: 'Plan', id: 'a' }, { at: at(900), title: 'Plan (edited)', id: 'a' }]), 1);
  assert.equal(run([{ at: at(0), title: 'Pressure' }, { at: at(7200), title: 'Pressure' }]), 2); assert.equal(run([{ at: at(0), title: 'A' }, { at: at(5), title: 'B' }]), 2);
});

test('1.14.89 satellite clouds: one JPEG image per time step, the visible image is replaced only by a loaded one', () => {
  const m = rd('v4/map-view.js');
  assert.ok(!/L\.tileLayer\.wms\('https:\/\/view\.eumetsat\.int/.test(m), 'no more WMS tiles'); assert.ok(fn(m, 'csatUrl').includes('format=image%2Fjpeg') && fn(m, 'csatUrl').includes('crs=EPSG%3A3857'));
  assert.ok(fn(m, 'csatPut').startsWith('function csatPut(i){ if(!map||!csat.ov||csat.st[i]!==2) return;'), 'a frame is shown only when its image has arrived');
  assert.ok(!/setTimeout\(swap,6000\)/.test(m), 'the 6 s forced swap that blanked the map is gone'); assert.ok(fn(m, 'csatPump').includes('csat.fr.length-7') && fn(m, 'csatPump').includes('busy<3'));
  assert.ok(fn(m, 'csatNext').includes('csat.st[c]!==3'), 'failed frames are skipped in playback'); assert.ok(fn(m, 'csatMoved').includes('csat.box.b.contains(map.getBounds())'), 'small pans do not reload');
});

// ---------- 1.14.90 ----------
test('1.14.90 server stats: when learning is switched off for a group, it is off in every key of that group (region, species); when it is on, in none', async () => {
  const RealDate = Date, NOW = RealDate.parse('2026-11-19T10:00:00Z');
  class FD extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } globalThis.Date = FD;
  try {
    const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', rd(f))(g);
    const { run } = await import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href + '?v1490');
    /* 80 έξοδοι σε δύο περιοχές, δύο είδη· τα ψάρια δεν ακολουθούν τις συνθήκες (τυχαία). Ανάλογα με τον σπόρο, ο έλεγχος βγάζει ότι η μάθηση βοηθά ή όχι. */
    const stats = async seed => { let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; const rows = [], D0 = RealDate.parse('2026-08-01T00:00:00Z'); let id = 1;
      for (let i = 0; i < 80; i++) { const u = 'u' + (i % 6), st = D0 + i * 30 * HR + 5 * HR + 1234 + i * 77, dur = 4 * HR + 4321, good = i % 2 === 0, east = i % 4 < 2, e = [];
        for (let t = st; t < st + dur; t += HR) e.push({ t, wind: good ? 6 : 16, gust: good ? 9 : 22, wave: good ? 0.3 : 1.1, press: good ? 1012 : 1021, pt: good ? -1.5 : 0.5, rain: 0, cloud: 30, temp: 24, sst: 23, tide: 0 });
        const fish = rnd() < 0.5 ? 1 + Math.floor(rnd() * 3) : 0, day = new RealDate(st).toISOString().slice(0, 10), lat = 34.7, lon = east ? 34.2 : 32.4;
        rows.push({ id: id++, user_id: u, kind: 'trip', sp: null, day, ms: st, ms2: st + dur, lat, lon, cnt: fish, tech: null, prof: 'boat', cond: { e, k: 'l' } });
        for (let k = 0; k < fish; k++) rows.push({ id: id++, user_id: u, kind: 'catch', sp: ['pagrus pagrus', 'dentex dentex'][k % 2], day, ms: st + Math.floor(rnd() * dur), ms2: null, lat, lon, cnt: 1, tech: 'jig', prof: 'boat', cond: { wind: good ? 6 : 16, wave: good ? 0.3 : 1.1, pres: good ? 1012 : 1021, pt: good ? -1.5 : 0.5, hr: 9, sm: { rise: 6, set: 18 } } }); }
      const posts = {}, res = (o, stc = 200) => ({ ok: stc < 400, status: stc, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)), headers: new Map() });
      const F = async (url, opt = {}) => { url = String(url); const m = (opt.method || 'GET').toUpperCase();
        if (url.includes('/rest/v1/catch_obs') && m === 'GET') { const off = +(/offset=(\d+)/.exec(url) || [0, 0])[1]; return res(rows.slice(off, off + 1000)); }
        if (m !== 'GET') { const t = /\/rest\/v1\/(\w+)/.exec(url); if (t && opt.body) { try { (posts[t[1]] = posts[t[1]] || []).push(JSON.parse(opt.body)); } catch (e) { } } return res(m === 'POST' && /rpc\//.test(url) ? true : null); }
        if (url.includes('open-meteo')) return res({ error: true }, 500); return res([]); };
      await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: F, PF: g.PF, webpush: null, sendMail: null, log: () => { } });
      return Object.fromEntries((posts.bite_stats || []).flat().filter(x => x && x.key && !/^trend:/.test(x.key)).map(x => [x.key, x])); };
    const cj = rd('v4/contrib.js'), MIN = 20;
    assert.ok(cj.includes("st.n>=MIN&&st.data&&!st.data.learnOff&&st.data.ins&&st.data.ins.length") && cj.includes("st.n>=10&&st.data&&!st.data.learnOff"), 'the app reads the switch on whichever key it picks');
    const used = S => Object.keys(S).filter(k => { const st = S[k]; return !!(st && st.n >= (/(^|\|)sp:/.test(k) ? 10 : MIN) && st.data && !st.data.learnOff && st.data.ins && st.data.ins.length); });
    /* α) ο έλεγχος λέει ότι η μάθηση δεν βοηθά */
    const off = await stats(63352), subOff = Object.keys(off).filter(k => k !== 'all');
    assert.equal(off.all.data.bt.on, false, JSON.stringify(off.all.data.bt)); assert.equal(off.all.data.learnOff, true);
    assert.ok(subOff.some(k => /^r:/.test(k)) && subOff.some(k => /^sp:/.test(k)), 'region and species keys exist: ' + subOff.join(', '));
    assert.deepEqual(subOff.filter(k => off[k].data.learnOff !== true), [], 'every key of the group carries the switch');
    assert.deepEqual(used(off), [], 'the app finds no key to learn from, with or without a known position');
    /* β) ο έλεγχος λέει ότι βοηθά: τίποτα δεν κλείνει */
    const on = await stats(31676); assert.equal(on.all.data.bt.on, true, JSON.stringify(on.all.data.bt));
    assert.deepEqual(Object.keys(on).filter(k => on[k].data.learnOff), [], 'nothing is switched off when the check passes'); assert.ok(used(on).includes('all') && used(on).some(k => /^r:/.test(k)));
  } finally { globalThis.Date = RealDate; }
});

test('1.14.90 server stats: when the check passes, nothing is switched off (the rule itself did not change)', () => {
  const s = rd('safety-job.mjs');
  assert.ok(s.includes("const OFF = !!A0.data.learnOff, putG = (k, a) => { if (OFF) a.data.learnOff = true; put(k, a, g); };"), 'sub-keys follow the group, only when the group is off');
  assert.ok(s.includes("if (bt.fitOn) {") && s.includes("else if (!bt.on) A0.data.learnOff = true;"), 'when learning is switched on or off is decided exactly as before');
  assert.equal((s.match(/putG\(pre \+ /g) || []).length, 3, 'size, species and region keys');
});
