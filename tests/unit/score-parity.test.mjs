// P1.1 · ΙΣΟΤΙΜΙΑ: ο νέος πυρήνας (score-core.js με το score-config 2026.11-1) δίνει ΑΚΡΙΒΩΣ ό,τι έδινε το forecast.js της 1.14.83.
// Η αναφορά είναι το ίδιο το παλιό αρχείο, αυτούσιο (tests/unit/golden/forecast-1.14.83.js): τρέχουν και τα δύο με τις ίδιες εισόδους
// και συγκρίνεται κάθε αποτέλεσμα. Όταν αλλάξει σκόπιμα ένα βάρος, αλλάζει η έκδοση του config και αυτό το test δείχνει ακριβώς τι άλλαξε.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { ROOT } from './harness.mjs';
import { loadNew, loadOld, rng, pick, plain, fakeMeteo, GOLDEN } from './score-load.mjs';

const SQUID = { n: 'Καλαμάρι', l: 'Loligo vulgaris', sst: [14, 24] }, SWORD = { n: 'Ξιφίας', l: 'Xiphias gladius', sst: [18, 26] }, SARGO = { n: 'Σαργός', l: 'Diplodus sargus', sst: [15, 25] };
const SPECIES = [undefined, '', null, SQUID, SWORD, SARGO, { n: 'Συναγρίδα' }, { l: 'Sepia officinalis', sst: [12, 22] }, { n: 'squid jig', sst: [10, 20] }];
const PROFS = [undefined, 'boat', 'shore', 'lake', 'spear', 'kayak'];
const N = v => v == null ? v : Math.round(v * 100) / 100;
/* τιμές πάνω στα όρια κάθε κανόνα και γύρω τους, μαζί με «ό,τι να 'ναι» τιμές */
const EDGE = { wind: [0, 4.99, 5, 5.01, 7.99, 8, 10, 10.01, 12, 12.01, 14, 14.01, 15, 15.01, 18, 18.01, 20, 20.01, 22, 22.01, 25, 25.01, 27, 27.01, 40],
  wave: [0, 0.3, 0.31, 0.5, 0.51, 0.6, 0.61, 1, 1.01, 1.5, 1.51, 2, 2.01, 4], gust: [null, undefined, 0, 27.9, 28, 34.9, 35, 60],
  sst: [null, undefined, 8, 13.9, 14, 15, 18, 20, 24, 24.1, 26, 26.4, 30], temp: [null, undefined, 7.9, 8, 13.9, 14, 27, 27.1, 32, 32.1], rain: [null, undefined, 0, 39, 40, 69, 70, 74, 75, 100],
  pres: [null, undefined, 1000, 1011.9, 1012, 1018, 1018.1, 1030], code: [null, undefined, 0, 61, 94, 95, 99], ptrend: [undefined, 'slow', 'stable', 'rise', 'fast'], cloud: [undefined, 'clear', 'part', 'over'] };
function randSm(r) { const rise = Math.round(280 + r() * 200), set = Math.round(960 + r() * 260), per = () => Array.from({ length: Math.floor(r() * 3) }, () => Math.round(r() * 1439));
  return { f: pick(r, [0, 0.01, 0.125, 0.25, 0.5, 0.75, 0.99, r()]), illum: r(), rise, set, maj: r() < 0.15 ? null : per(), min: r() < 0.15 ? null : per() }; }
function randW(r) { const v = (k, lo, hi) => r() < 0.55 ? pick(r, EDGE[k]) : N(lo + r() * (hi - lo));
  const w = { wind: r() < 0.02 ? pick(r, [null, undefined]) : v('wind', 0, 45), wave: r() < 0.08 ? pick(r, [null, undefined]) : v('wave', 0, 4), gust: v('gust', 0, 60), ptrend: pick(r, EDGE.ptrend), cloud: pick(r, EDGE.cloud),
    sst: v('sst', 8, 31), temp: v('temp', 0, 38), rain: v('rain', 0, 100), pres: v('pres', 995, 1035), code: pick(r, EDGE.code), bite: r() < 0.4 ? true : pick(r, [false, undefined]) };
  const sp = pick(r, SPECIES); if (sp !== undefined) w.sp = sp; const pf = pick(r, PROFS); if (pf !== undefined) w.prof = pf; return w; }

test('golden master: hourScore is identical to 1.14.83 on 600,000 random and boundary cases (all profiles and species)', () => {
  const A = loadOld(), B = loadNew(), r = rng(20261118); let n = 0; const h = crypto.createHash('sha256'), dist = new Map();
  for (let i = 0; i < 600000; i++) { const sm = randSm(r), hr = Math.floor(r() * 24), w = randW(r);
    const a = A.PF.hourScore(sm, hr, w), b = B.PF.hourScore(sm, hr, w);
    if (!Object.is(a, b)) assert.fail(`case ${i}: old ${a} new ${b} · hr ${hr} · sm ${JSON.stringify(sm)} · w ${JSON.stringify(w)}`);
    n++; h.update(String(a) + ','); dist.set(a, (dist.get(a) || 0) + 1); }
  assert.equal(n, 600000);
  assert.ok(dist.size > 80, 'the grid really covers the score range (distinct scores: ' + dist.size + ')');
  /* αποτύπωμα όλων των βαθμών: αν αλλάξει ο πυρήνας ή το config, αλλάζει και αυτό */
  assert.equal(h.digest('hex'), fs.readFileSync(path.join(ROOT, 'tests/unit/golden/hourscore-2026.11-1.sha256'), 'utf8').trim(), 'fingerprint of the 600,000 scores for config 2026.11-1');
});

test('golden master: exhaustive sweep of every rule boundary for every profile and species kind', () => {
  const A = loadOld(), B = loadNew(), sm = { f: 0.5, illum: 1, rise: 390, set: 1045, maj: [400, 1100], min: [760] }; let n = 0;
  for (const prof of PROFS) for (const sp of [null, SQUID, SWORD, SARGO]) for (const bite of [false, true]) for (const hr of [0, 6, 7, 12, 13, 17, 18, 23])
    for (const wind of EDGE.wind) for (const wave of [null, ...EDGE.wave]) for (const k of ['gust', 'sst', 'temp', 'rain', 'pres', 'code', 'ptrend', 'cloud']) for (const x of EDGE[k]) {
      const w = { wind, wave, gust: 12, ptrend: 'stable', cloud: 'part', sst: 21, temp: 20, rain: 10, pres: 1015, code: 1, bite, sp, prof }; w[k] = x;
      const a = A.PF.hourScore(sm, hr, w), b = B.PF.hourScore(sm, hr, w); n++;
      if (!Object.is(a, b)) assert.fail(`old ${a} new ${b} · hr ${hr} · w ${JSON.stringify(w)}`); }
  assert.ok(n > 1000000, 'cases: ' + n);
});

test('golden master: profile and target species read from the user settings (localStorage + knowledge) give the same score', () => {
  const SPKB = [{ n: 'Καλαμάρι', l: 'Loligo vulgaris', sst: [14, 24] }, { n: 'Σαργός', l: 'Diplodus sargus', sst: [15, 25] }]; const r = rng(7); let n = 0;
  for (const fprof of [null, 'boat', 'shore', 'lake', 'spear']) for (const adv of [null, '"Καλαμάρι"', 'Σαργός', '"Άγνωστο"', '""', 'null']) {
    const storage = {}; if (fprof) storage['alkyon-fprof'] = fprof; if (adv != null) storage['alkyon-advsp'] = adv;
    const A = loadOld({ storage, extra: { SPKB } }), B = loadNew({ storage, extra: { SPKB } });
    for (let i = 0; i < 4000; i++) { const sm = randSm(r), hr = Math.floor(r() * 24), w = randW(r); delete w.sp; if (r() < 0.7) delete w.prof;
      const a = A.PF.hourScore(sm, hr, w), b = B.PF.hourScore(sm, hr, w); n++; if (!Object.is(a, b)) assert.fail(`fprof ${fprof} advsp ${adv}: old ${a} new ${b} · ${JSON.stringify(w)}`); } }
  /* χωρίς localStorage (server, ρολόι, service worker): ίδιο με πριν, δηλαδή «βάρκα» και χωρίς είδος, εκτός αν δοθούν ρητά */
  const A = loadOld({ storage: null }), B = loadNew({ storage: null });
  for (let i = 0; i < 20000; i++) { const sm = randSm(r), hr = Math.floor(r() * 24), w = randW(r); n++; assert.ok(Object.is(A.PF.hourScore(sm, hr, w), B.PF.hourScore(sm, hr, w))); }
  assert.ok(n >= 140000);
});

function randHour(r) { const hr = Math.floor(r() * 24), mo = 1 + Math.floor(r() * 12), o = { hr, t: '2026-' + String(mo).padStart(2, '0') + '-15T' + String(hr).padStart(2, '0') + ':00' };
  const opt = (k, f) => { if (r() < 0.85) o[k] = f(); };
  opt('ptrend', () => pick(r, ['slow', 'stable', 'rise', 'fast'])); opt('pres', () => pick(r, [1009.9, 1010, 1014.9, 1015, 1019.9, 1020, N(995 + r() * 40)])); opt('wind', () => pick(r, [4.99, 5, 9.99, 10, 14.99, 15, N(r() * 30)]));
  opt('wave', () => pick(r, [0.29, 0.3, 0.59, 0.6, 0.99, 1, N(r() * 3)])); opt('tide', () => pick(r, ['up', 'down', 'slack'])); opt('cloud', () => pick(r, ['clear', 'part', 'over'])); opt('mm', () => pick(r, [0, 0.19, 0.2, N(r() * 3)]));
  opt('mal', () => N(-90 + r() * 180)); opt('clp', () => pick(r, [0, 50, 100, 140, -5, Math.round(r() * 100)])); opt('thd', () => pick(r, [0, 19.9, 20, 49.9, 50, N(r() * 90)])); opt('chl', () => pick(r, [0.039, 0.04, 0.069, 0.07, 0.119, 0.12, N(r() * 0.3)]));
  opt('sst', () => pick(r, [15.9, 16, 18.9, 19, 21.9, 22, 24.9, 25, N(10 + r() * 20)])); if (r() < 0.9) o.score = Math.round(r() * 100); if (r() < 0.9) o.bite = Math.round(r() * 100); return o; }
const FEATS = ['sun', 'pt', 'pl', 'wind', 'wave', 'tide', 'cloud', 'rain', 'aft', 'moon', 'season', 'dark', 'thc', 'chl', 'sstb'];
function randLearn(r) { const ins = Array.from({ length: Math.floor(r() * 7) }, () => ({ f: pick(r, FEATS), b: Math.floor(r() * 6), lift: pick(r, [0, -1, 0.5, 0.7, 1, 1.3, 1.8, 3, N(0.3 + r() * 3)]), n: pick(r, [3, 14, 15, 16, 60, 400]), src: pick(r, ['both', 'cc', 'gam']) }));
  return pick(r, [null, {}, { ins: [] }, { ins }, { ins }, { ins }]); }

test('golden master: condition classes (learnBins) and the learned correction (learnAdj) are identical on 200,000 cases', () => {
  const A = loadOld(), B = loadNew(), r = rng(99); let adj = 0;
  for (let i = 0; i < 200000; i++) { const sm = r() < 0.05 ? pick(r, [null, {}, { f: 0.3 }]) : randSm(r), h = randHour(r), L = randLearn(r);
    assert.deepEqual(plain(B.PF.learnBins(sm, h)), plain(A.PF.learnBins(sm, h)), 'bins ' + JSON.stringify([sm, h]));
    assert.equal(JSON.stringify(B.PF.learnBins(sm, h)), JSON.stringify(A.PF.learnBins(sm, h)), 'same key order');
    const a = A.PF.learnAdj(L, sm, Object.assign({}, h)), b = B.PF.learnAdj(L, sm, Object.assign({}, h)); if (a.learn) adj++;
    assert.equal(JSON.stringify(b), JSON.stringify(a), 'learnAdj ' + JSON.stringify([L, sm, h])); }
  assert.ok(adj > 5000, 'the learned correction really applied in many cases: ' + adj);
});

test('golden master: explainHour ("why 72?") is identical', () => {
  const A = loadOld(), B = loadNew(), r = rng(5);
  for (let i = 0; i < 40000; i++) { const sm = randSm(r), w = randW(r), h = Object.assign({ hr: Math.floor(r() * 24) }, w); delete h.bite; if (r() < 0.3) { h.bite = Math.round(r() * 100); h.learn = { k: 1.1, m: [] }; }
    const sp = pick(r, [undefined, SQUID, SARGO]); assert.equal(JSON.stringify(B.PF.explainHour(sm, h, sp)), JSON.stringify(A.PF.explainHour(sm, h, sp)), JSON.stringify([sm, h, sp])); }
});

const LEARN = { by: { sea: { ins: [{ f: 'sun', b: 1, lift: 1.6, n: 80, src: 'both' }, { f: 'wind', b: 1, lift: 1.3, n: 40, src: 'cc' }, { f: 'pt', b: 0, lift: 0.7, n: 25, src: 'both' }] }, spear: { ins: [{ f: 'wave', b: 0, lift: 1.5, n: 30, src: 'both' }] }, ceph: { ins: [{ f: 'aft', b: 1, lift: 2, n: 50, src: 'both' }] } }, sp: { 'diplodus sargus': { ins: [{ f: 'sstb', b: 2, lift: 1.4, n: 20, src: 'both' }] } } };
test('golden master: the whole forecast (getForecast: hours, safe hours, day best, windows, bite, uncertainty) is identical', async () => {
  let n = 0;
  for (const [seed, lat, lon, tz, zone] of [[1, 34.66, 33.04, 7200, 'Asia/Nicosia'], [2, 37.94, 23.64, 7200, 'Europe/Athens'], [3, 43.3, 5.37, 3600, 'Europe/Paris'], [4, -33.9, 151.2, 39600, 'Australia/Sydney'], [5, 60.1, 24.9, 7200, 'Europe/Helsinki']])
    for (const now of ['2026-11-09T04:00:00Z', '2026-11-09T13:20:00Z', '2026-11-12T21:45:00Z'])
      for (const [storage, opt] of [[{ 'alkyon-fprof': 'boat' }, { days: 3 }], [{}, { days: 7, ens: true }], [{ 'alkyon-fprof': 'shore', 'alkyon-limits': JSON.stringify({ wind: 18, wave: 1.4, gust: 30 }) }, { days: 14, learn: LEARN }],
        [{ 'alkyon-fprof': 'spear' }, { days: 5, learn: LEARN, chl: 0.08, thd: 25 }], [{ 'alkyon-fprof': 'lake' }, { days: 4, learn: false }], [null, { days: 6, sp: SQUID, learn: LEARN }], [{ 'alkyon-advsp': 'Σαργός' }, { days: 7, sp: SARGO, learn: LEARN, ens: true }], [null, {}]]) {
        const F = fakeMeteo(seed * 100 + n, { tz, zone, holes: n % 3 === 0 }), A = loadOld({ now, storage }), B = loadNew({ now, storage });
        const a = plain(await A.PF.getForecast(lat, lon, F, opt)), b = plain(await B.PF.getForecast(lat, lon, F, opt));
        assert.ok(a.days.length >= 1 && a.days[0].hours.length >= 20, 'the forecast has days and hours');
        assert.deepEqual(b, a, `seed ${seed} now ${now} opt ${JSON.stringify(opt)}`); n++; }
  assert.equal(n, 120);
});

test('golden master: alerts (checkPlaces, findIdeal, goodDays) produce the same items and texts', async () => {
  let n = 0;
  for (const now of ['2026-11-09T04:00:00Z', '2026-11-10T17:30:00Z']) for (const lang of ['el', 'en']) for (const sp of [null, SQUID]) for (const limits of [null, { wind: 20, wave: 1.5, gust: 32 }]) {
    const cfg = () => ({ places: [{ name: 'Λεμεσός', lat: 34.66, lon: 33.04 }, { name: 'Πάφος', lat: 34.75, lon: 32.4 }], threshold: 60, notified: {}, pressure: true, turn: true, wind: true, lang, sp, limits,
      plans: [{ date: '2026-11-11', name: 'Λεμεσός', lat: 34.66, lon: 33.04 }], area: { name: 'Κύπρος', lat: 34.9, lon: 33.2 } });
    const A = loadOld({ now, storage: null }), B = loadNew({ now, storage: null }), F = fakeMeteo(40 + n);
    const a = plain(await A.PF.checkPlaces(cfg(), F)), b = plain(await B.PF.checkPlaces(cfg(), F));
    assert.deepEqual(b, a, `now ${now} lang ${lang}`);
    const fa = await A.PF.getForecast(34.66, 33.04, F, { days: 7 }), fb = await B.PF.getForecast(34.66, 33.04, F, { days: 7 });
    for (const thr of [40, 55, 70, 85]) { assert.deepEqual(plain(B.PF.findIdeal(fb, thr)), plain(A.PF.findIdeal(fa, thr))); assert.deepEqual(plain(B.PF.goodDays(fb, thr)), plain(A.PF.goodDays(fa, thr))); }
    n++; }
  assert.equal(n, 16);
});

test('golden master: every other function of forecast.js is unchanged (sun, moon, solunar, pressure events)', () => {
  const A = loadOld({ now: '2026-11-09T04:00:00Z' }), B = loadNew({ now: '2026-11-09T04:00:00Z' });
  assert.deepEqual(Object.keys(A.PF).filter(k => !(k in B.PF)), [], 'nothing was removed from PF');
  assert.deepEqual(Object.keys(B.PF).filter(k => !(k in A.PF)).sort(), ['scoreConfig', 'scoreHour', 'scoreRows', 'session'], 'only the new score entries were added (1.14.86: + session, the valid-trip rule; it scores nothing)');
  for (const [lat, lon, tz] of [[34.66, 33.04, 120], [37.94, 23.64, 120], [-33.9, 151.2, 660], [69.6, 18.9, 60]]) for (const d of ['2026-01-10', '2026-06-21', '2026-11-18', '2026-12-25']) {
    assert.equal(JSON.stringify(B.PF.sunMoon(d, lat, lon, tz)), JSON.stringify(A.PF.sunMoon(d, lat, lon, tz)));
    const ms = Date.parse(d + 'T00:00:00Z'); assert.equal(JSON.stringify(B.PF.solunarPeriods(ms, ms + 864e5, lat, lon)), JSON.stringify(A.PF.solunarPeriods(ms, ms + 864e5, lat, lon)));
    assert.equal(JSON.stringify(B.PF.moonPhase(ms)), JSON.stringify(A.PF.moonPhase(ms))); }
  for (const sp of [undefined, null, SQUID, SWORD, SARGO, { n: 'Παλαμίδα' }, { n: 'Συναγρίδα' }]) assert.equal(JSON.stringify(B.PF.moonInfo(sp)), JSON.stringify(A.PF.moonInfo(sp)));
  for (const w of [0, 3, 11, 22, 40, 70]) assert.equal(B.PF.bft(w), A.PF.bft(w));
  assert.equal(JSON.stringify(B.PF.lims()), JSON.stringify(A.PF.lims()));
});

test('the golden reference file is the untouched forecast.js of 1.14.83', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, GOLDEN))).digest('hex');
  assert.equal(sha, fs.readFileSync(path.join(ROOT, 'tests/unit/golden/forecast-1.14.83.sha256'), 'utf8').trim(), 'the reference must never be edited');
});
