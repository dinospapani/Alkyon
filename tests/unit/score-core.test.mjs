// P1.1 · ο ενιαίος πυρήνας του βαθμού (score-core.js + score-config.js): ιδιότητες που πρέπει να ισχύουν πάντα.
// Η ισοτιμία με την 1.14.83 ελέγχεται στο score-parity.test.mjs· εδώ: όρια, μονοτονία, λόγοι, παράθυρο, κλάσεις, μάθηση, data contract, βεβαιότητα.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';
import { loadNew, rng, pick, plain, fakeMeteo, SCORE_FILES } from './score-load.mjs';

const { PF, AS, CFG } = loadNew({ now: '2026-11-09T04:00:00Z', storage: null });
const SM = { f: 0.25, illum: 0.5, rise: 360, set: 1080, maj: null, min: null };
const SQUID = { n: 'Καλαμάρι', l: 'Loligo vulgaris', sst: [14, 24] }, SARGO = { n: 'Σαργός', l: 'Diplodus sargus', sst: [15, 25] };
const W = o => Object.assign({ wind: 6, wave: 0.3, gust: 10, ptrend: 'stable', cloud: 'part' }, o);
const PROFS = ['boat', 'shore', 'lake', 'spear'];

test('config: version 2026.11-1, data only, and cannot be changed while the app runs', () => {
  assert.equal(CFG.version, '2026.11-1'); assert.equal(AS.VERSION, CFG.version); assert.equal(PF.scoreConfig, CFG.version);
  assert.match(CFG.version, /^\d{4}\.\d{2}-\d+$/);
  assert.throws(() => { 'use strict'; CFG.profiles.boat.wind[0].d = 99; }, TypeError);
  assert.throws(() => { 'use strict'; CFG.base = 60; }, TypeError);
  const src = fs.readFileSync(path.join(ROOT, 'score-config.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const body = src.slice(src.indexOf('g.AlkyonScoreConfig={'), src.indexOf('};\n') + 2);
  assert.ok(!/function|=>|\bif\b|\bfor\b|localStorage|Date|Math\./.test(body), 'score-config holds data only');
  /* κάθε κανόνας βημάτων τελειώνει με «αλλιώς», ώστε να μη μένει τιμή χωρίς βαθμό */
  const steps = []; (function walk(o, k) { if (Array.isArray(o) && o.length && o.every(x => x && typeof x === 'object' && 'd' in x)) steps.push([k, o]); else if (o && typeof o === 'object') for (const x of Object.keys(o)) walk(o[x], k + '.' + x); })(CFG, 'cfg');
  assert.ok(steps.length >= 12, 'step tables found: ' + steps.length);
  for (const [k, a] of steps) { const last = a[a.length - 1]; assert.deepEqual(Object.keys(last), ['d'], k + ' ends with an "otherwise" rule'); for (const r of a) assert.equal(typeof r.d, 'number', k); }
});

test('core is pure: no storage, DOM, network, clock or randomness; forecast.js holds no score weights any more', () => {
  const core = fs.readFileSync(path.join(ROOT, 'score-core.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const bad of [/localStorage/, /\bdocument\b/, /(^|[^.\w])window\./, /\bfetch\(/, /Date\.now/, /new Date/, /Math\.random/, /\bnavigator\b/, /XMLHttpRequest/, /setTimeout|setInterval/]) assert.ok(!bad.test(core), 'score-core.js must not use ' + bad);
  const fc = fs.readFileSync(path.join(ROOT, 'forecast.js'), 'utf8');
  assert.ok(!/base\+=|base-=/.test(fc), 'no score arithmetic left in forecast.js');
  assert.ok(/function hourScore\(sm,hr,w\)\{ return AS\.hour\(sm,hr,w,scoreCtx\(w\)\); \}/.test(fc), 'hourScore is a thin wrapper');
  for (const [k, re] of [['learnBins', /function learnBins\(sm,h\)\{ return AS\.bins\(sm,h\); \}/], ['learnAdj', /function learnAdj\(L,sm,h\)\{ return AS\.learn\(L,sm,h\); \}/]]) assert.ok(re.test(fc), k + ' is a thin wrapper');
  assert.equal((fc.match(/AS\.window\(/g) || []).length, 2, 'both day windows (score and bite) use the one algorithm');
});

test('score: always an integer within the configured bounds', () => {
  const r = rng(11);
  for (let i = 0; i < 50000; i++) { const w = W({ wind: r() * 80, wave: r() * 8, gust: r() * 120, sst: r() * 35, temp: r() * 45 - 5, rain: r() * 100, pres: 980 + r() * 60, code: pick(r, [null, 0, 95, 99]), ptrend: pick(r, ['slow', 'stable', 'rise', 'fast']), cloud: pick(r, ['clear', 'part', 'over']), bite: r() < 0.3 });
    const v = AS.hour({ f: r(), rise: 300 + r() * 200, set: 1000 + r() * 200, maj: [r() * 1440], min: [r() * 1440] }, Math.floor(r() * 24), w, { sp: pick(r, [null, SQUID, SARGO]), prof: pick(r, PROFS) });
    assert.ok(Number.isInteger(v) && v >= CFG.clamp[0] && v <= CFG.clamp[1], String(v)); }
});

test('score: beyond the calm range, more wind or more wave never raises it (every profile, with and without a species)', () => {
  for (const prof of PROFS) for (const sp of [null, SARGO]) for (const hr of [7, 12, 19]) {
    let prev = Infinity; for (let wind = 5; wind <= 60; wind += 0.25) { const v = AS.hour(SM, hr, W({ wind, gust: null }), { sp, prof }); assert.ok(v <= prev, `${prof} wind ${wind}: ${v} > ${prev}`); prev = v; }
    prev = Infinity; for (let wave = 0; wave <= 6; wave += 0.05) { const v = AS.hour(SM, hr, W({ wave }), { sp, prof }); assert.ok(v <= prev, `${prof} wave ${wave}: ${v} > ${prev}`); prev = v; }
    prev = Infinity; for (let gust = 0; gust <= 80; gust += 1) { const v = AS.hour(SM, hr, W({ gust }), { sp, prof }); assert.ok(v <= prev, `${prof} gust ${gust}`); prev = v; } }
});

test('score: profile and species given explicitly behave exactly like the same choice read from the user settings', () => {
  const SPKB = [SQUID, SARGO], r = rng(3);
  for (const prof of PROFS) for (const sp of [null, SQUID, SARGO]) {
    const storage = { 'alkyon-fprof': prof }; if (sp) storage['alkyon-advsp'] = JSON.stringify(sp.n);
    const U = loadNew({ storage, extra: { SPKB } });
    for (let i = 0; i < 2000; i++) { const sm = { f: r(), rise: 380, set: 1040, maj: [r() * 1440], min: [r() * 1440] }, hr = Math.floor(r() * 24), w = W({ wind: r() * 30, wave: r() * 3, sst: 10 + r() * 20, temp: r() * 35, rain: r() * 100, pres: 1000 + r() * 30 });
      assert.equal(PF.hourScore(sm, hr, Object.assign({}, w, { prof, sp: sp || '' })), U.PF.hourScore(sm, hr, w), `${prof} ${sp && sp.n}`);
      assert.equal(AS.hour(sm, hr, w, { prof, sp }), U.PF.hourScore(sm, hr, w)); } }
});

test('reasons: every term is a real input, the terms add up to the score, and missing data never produces a reason', () => {
  const r = rng(21); const seen = new Set();
  for (let i = 0; i < 60000; i++) { const sm = { f: r(), rise: 300 + r() * 200, set: 1000 + r() * 200, maj: r() < 0.2 ? null : [r() * 1440], min: r() < 0.2 ? null : [r() * 1440] }, hr = Math.floor(r() * 24);
    const w = W({ wind: r() * 40, wave: r() < 0.1 ? null : r() * 4, gust: r() < 0.3 ? null : r() * 60, sst: r() < 0.3 ? null : 8 + r() * 24, temp: r() < 0.3 ? null : r() * 38, rain: r() < 0.3 ? null : r() * 100, pres: r() < 0.3 ? null : 995 + r() * 40, code: pick(r, [null, 1, 95]), ptrend: pick(r, ['slow', 'stable', 'rise', 'fast']), cloud: pick(r, ['clear', 'part', 'over']), bite: r() < 0.25 });
    const ctx = { sp: pick(r, [null, SQUID, SARGO, { n: 'Ξιφίας', l: 'Xiphias gladius' }]), prof: pick(r, PROFS) }, e = AS.explain(sm, hr, w, ctx);
    assert.equal(e.score, AS.hour(sm, hr, w, ctx), 'explain gives the same score as hour');
    assert.equal(e.cfg, '2026.11-1'); assert.equal(e.base, CFG.base);
    const sum = e.reasons.reduce((a, x) => a + x.d, 0);
    assert.ok(Math.abs(e.base + sum - e.raw) < 1e-9, 'base + Σd = raw');
    assert.equal(e.score, Math.max(CFG.clamp[0], Math.min(CFG.clamp[1], Math.round(e.raw))), 'score = rounded raw within bounds');
    for (const x of e.reasons) { seen.add(x.k); assert.ok(Number.isFinite(x.d) && x.d !== 0, x.k + ' has a real effect'); assert.ok(x.unit, x.k + ' has a unit'); assert.ok(x.v !== undefined && x.v !== null, x.k + ' has the value that caused it'); }
    const K = new Set(e.reasons.map(x => x.k));
    if (w.gust == null || w.bite) assert.ok(!K.has('gust'), 'no gust reason without gust');
    if (w.sst == null || !ctx.sp || !ctx.sp.sst) assert.ok(!K.has('sst') && !K.has('sstCold'), 'no sea-temperature reason without sst and a species range');
    if (ctx.prof !== 'lake') assert.ok(!K.has('airTemp') && !K.has('lightRain')); else assert.ok(!K.has('wave'), 'lake: waves do not count');
    if (w.temp == null) assert.ok(!K.has('airTemp')); if (w.rain == null) assert.ok(!K.has('rain') && !K.has('lightRain')); if (w.pres == null) assert.ok(!K.has('speciesPressure')); if (w.code == null) assert.ok(!K.has('storm'));
    if (sm.maj == null) assert.ok(!K.has('solunarMajor')); if (sm.min == null) assert.ok(!K.has('solunarMinor'));
    if (!AS.kindOf(ctx.sp)) for (const k of ['moon', 'speciesWind', 'speciesPressure', 'speciesDusk', 'sstCold']) assert.ok(!K.has(k), k + ' only for a species with a study'); }
  for (const k of ['pressure', 'wind', 'wave', 'cloud', 'gust', 'sst', 'sstCold', 'storm', 'rain', 'twilight', 'solunarMajor', 'solunarMinor', 'midday', 'moon', 'speciesWind', 'speciesPressure', 'speciesDusk', 'airTemp', 'lightRain']) assert.ok(seen.has(k), 'reason exercised: ' + k);
});

test('day window: one algorithm; it returns the longest run within 6 points of the best, first on ties, only among the allowed hours', () => {
  const H = s => s.map((score, hr) => ({ hr, score, bite: score }));
  let hs = H([10, 20, 70, 72, 71, 40, 73, 75, 74, 30]);
  assert.deepEqual(plain(AS.window(hs, hs, 'score')), { best: 75, win: { s: 2, e: 4 } }, 'two runs of equal length → the first');
  hs = H([10, 20, 70, 72, 40, 73, 75, 74, 30]); assert.deepEqual(plain(AS.window(hs, hs, 'score')), { best: 75, win: { s: 5, e: 7 } }, 'the longest run wins');
  hs = H([70, 71, 10, 72, 73, 10, 74, 75]); assert.deepEqual(plain(AS.window(hs, hs, 'score')), { best: 75, win: { s: 0, e: 1 } }, 'tie → the first run of the day');
  assert.deepEqual(plain(AS.window(hs, hs.filter(h => h.hr >= 3), 'score')), { best: 75, win: { s: 3, e: 4 } }, 'only allowed hours');
  assert.deepEqual(plain(AS.window(hs, [], 'score')), { best: null, win: null });
  assert.deepEqual(plain(AS.window(hs, hs, 'score', 0)), { best: 75, win: { s: 7, e: 7 } }, 'custom tolerance');
  const r = rng(8);
  for (let i = 0; i < 20000; i++) { const all = Array.from({ length: 24 }, (_, hr) => ({ hr, score: Math.round(r() * 100) })), cand = all.filter(() => r() < 0.6), w = AS.window(all, cand, 'score');
    if (!cand.length) { assert.equal(w.win, null); continue; }
    assert.equal(w.best, Math.max(...cand.map(h => h.score)));
    for (let hr = w.win.s; hr <= w.win.e; hr++) { assert.ok(cand.includes(all[hr]), 'inside the allowed hours'); assert.ok(all[hr].score >= w.best - CFG.window.within); } }
});

test('day window: same result as the third existing implementation (personal.js day), which is not switched yet', () => {
  const ctx = { console, Math, JSON, Date }; ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'personal.js'), 'utf8'), ctx, { filename: 'personal.js' });
  const PP = ctx.PP, r = rng(31), m = () => ({ m: 0.4 + r() * 1.6 });
  for (let i = 0; i < 3000; i++) { const model = { ready: true, factors: { block: Array.from({ length: 6 }, m), moon: Array.from({ length: 4 }, m), ptrend: Array.from({ length: 4 }, m), wind: Array.from({ length: 3 }, m) } };
    const d = { f: r(), rise: 330 + r() * 120, set: 1000 + r() * 150, hours: Array.from({ length: 24 }, (_, hr) => ({ t: '2026-11-10T' + String(hr).padStart(2, '0') + ':00', hr, safe: r() < 0.7, ptrend: pick(r, ['slow', 'stable', 'rise', 'fast']), wind: r() * 25 })) };
    const now = r() < 0.5 ? null : '2026-11-10T' + String(Math.floor(r() * 24)).padStart(2, '0') + ':00', p = PP.day(model, d, now);
    const cand = p.hours.filter(h => h.safe && AS.daylight(d, h.hr) && (!now || h.t >= now)), w = AS.window(p.hours, cand, 'score');
    if (!cand.length) { assert.equal(p.win, null); assert.equal(w.win, null); continue; }
    assert.equal(w.best, p.best); assert.deepEqual(plain(w.win), plain(p.win)); }
});

test('classes: thresholds come from the config and every class stays in its range', () => {
  const r = rng(4), max = { sun: 5, pt: 2, pl: 3, wind: 3, wave: 3, tide: 2, cloud: 2, rain: 1, aft: 5, moon: 7, season: 3, dark: 3, thc: 3, chl: 3, sstb: 4 };
  for (let i = 0; i < 30000; i++) { const b = AS.bins({ f: r(), illum: r(), rise: 300 + r() * 200, set: 1000 + r() * 200 }, { hr: Math.floor(r() * 24), t: '2026-' + String(1 + Math.floor(r() * 12)).padStart(2, '0') + '-10T00:00', ptrend: pick(r, ['slow', 'stable', 'rise', 'fast']), pres: 990 + r() * 50, wind: r() * 40, wave: r() * 4, tide: pick(r, ['up', 'down', 'slack']), cloud: pick(r, ['clear', 'part', 'over']), mm: r() * 2, mal: r() * 180 - 90, clp: r() * 100, thd: pick(r, [0, r() * 80]), chl: r() * 0.3, sst: 10 + r() * 20 });
    for (const k of Object.keys(max)) assert.ok(Number.isInteger(b[k]) && b[k] >= 0 && b[k] <= max[k], k + '=' + b[k]); }
  const B = CFG.bins, at = (k, v) => AS.bins(SM, { hr: 12, [k]: v });
  B.wind.forEach((c, i) => { assert.equal(at('wind', c - 0.001).wind, i); assert.equal(at('wind', c).wind, i + 1); });
  B.wave.forEach((c, i) => { assert.equal(at('wave', c - 0.001).wave, i); assert.equal(at('wave', c).wave, i + 1); });
  B.presLevel.forEach((c, i) => { assert.equal(at('pres', c - 0.001).pl, i); assert.equal(at('pres', c).pl, i + 1); });
  B.sst.forEach((c, i) => { assert.equal(at('sst', c - 0.001).sstb, i); assert.equal(at('sst', c).sstb, i + 1); });
  assert.deepEqual(plain(AS.bins(SM, { hr: 12 })), { sun: 3, aft: 0, moon: 2 }, 'missing data produce no class at all');
});

test('learned layer: weak findings are ignored, strong ones are shrunk, and the multiplier is capped', () => {
  const L = CFG.learn, h0 = () => ({ hr: 12, wind: 7, score: 60, bite: 70 }), one = (x) => AS.learn({ ins: [Object.assign({ f: 'wind', b: 1, lift: 1.5, n: 100, src: 'both' }, x)] }, SM, h0());
  assert.equal(one({ n: L.minN - 1, src: 'cc' }).learn, undefined, 'under the minimum sample and one method only → ignored');
  assert.ok(one({ n: L.minN, src: 'cc' }).learn, 'enough fish → counts');
  assert.ok(one({ n: 3, src: 'both' }).learn, 'both methods agree → counts');
  assert.equal(one({ b: 2 }).learn, undefined, 'a finding for another class does not apply');
  for (const lift of [0, -2, NaN]) assert.equal(one({ lift }).learn, undefined, 'invalid lift ignored');
  for (const n of [15, 60, 600]) { const k = one({ n }).learn.k; assert.equal(k, Math.round(Math.min(L.max, Math.exp(n / (n + L.shrink) * Math.log(1.5))) * 100) / 100, 'shrinkage n/(n+' + L.shrink + ')'); }
  assert.ok(one({ n: 15 }).learn.k < one({ n: 600 }).learn.k, 'less data → smaller correction');
  assert.equal(one({ lift: 50, n: 5000 }).learn.k, L.max); assert.equal(one({ lift: 0.01, n: 5000 }).learn.k, L.min);
  const a = one({ lift: 50, n: 5000 }); assert.equal(a.score, Math.round(60 * L.max)); assert.equal(a.bite, Math.round(70 * L.max));
  const same = h0(); assert.equal(AS.learn(null, SM, same), same); assert.equal(AS.learn({ ins: [] }, SM, same).learn, undefined);
});

test('data contract: a forecast hour maps to {v, unit, src, q} with fixed units, nothing silent, and it validates', async () => {
  const fc = await PF.getForecast(34.66, 33.04, fakeMeteo(77, { holes: true }), { days: 7, learn: false }); let n = 0, def = 0, miss = 0;
  for (const d of fc.days) { const sm = PF.sunMoon(d.date, 34.66, 33.04, 120); for (const h of d.hours) { const c = AS.contract(h, { sm });
    assert.deepEqual(plain(AS.validate(c)), [], JSON.stringify(c));
    for (const k of Object.keys(c)) { assert.equal(c[k].unit, CFG.units[k], k); assert.ok(CFG.quality.includes(c[k].q)); }
    assert.equal(c.wind.unit, 'kn'); assert.equal(c.wave.unit, 'm'); assert.equal(c.rainProb.unit, '%'); assert.equal(c.rainMm.unit, 'mm/h');
    if (h.wave == null) { def++; assert.deepEqual(plain(c.wave), { v: CFG.waveDefault, unit: 'm', src: 'config', q: 'default' }, 'a missing wave is declared as a default, not hidden'); }
    if (h.sst == null) { miss++; assert.equal(c.sst.q, 'missing'); assert.equal(c.sst.v, null); }
    for (const k of ['current', 'depth', 'slope', 'clarity', 'frontChl', 'frontSst']) assert.equal(c[k].q, 'missing', k + ' is not available per hour yet and says so');
    n++; } }
  assert.ok(n > 150 && def > 0 && miss > 0, `hours ${n}, default wave ${def}, missing sst ${miss}`);
  const c = AS.contract({ hr: 9, wind: 8, wave: 0.4, waveOff: 0.9, t: '2026-11-10T09:00' }, { sm: SM, extra: { current: { v: 0.4, src: 'open-meteo-marine', q: 'model' }, depth: 35 } });
  assert.equal(c.wave.q, 'est'); assert.match(c.wave.src, /exposure/); assert.equal(c.current.v, 0.4); assert.equal(c.depth.v, 35); assert.deepEqual(plain(AS.validate(c)), []);
});

test('data contract: wrong units, values without a source, unknown variables and bad numbers are rejected', () => {
  const ok = () => AS.contract({ hr: 9, wind: 8, wave: 0.4, t: '2026-11-10T09:00' }, { sm: SM });
  let c = ok(); c.wind.unit = 'km/h'; assert.match(AS.validate(c).join('; '), /wind: unit km\/h \(expected kn\)/);
  c = ok(); c.wave.unit = 'ft'; assert.match(AS.validate(c).join('; '), /wave: unit ft/);
  c = ok(); c.wind.src = null; assert.match(AS.validate(c).join('; '), /wind: no source/);
  c = ok(); c.wind.v = null; assert.match(AS.validate(c).join('; '), /wind: no value/);
  c = ok(); c.sst.v = 21; assert.match(AS.validate(c).join('; '), /sst: missing but has a value/);
  c = ok(); c.wind.q = 'guess'; assert.match(AS.validate(c).join('; '), /wind: quality guess/);
  c = ok(); c.wind.v = Infinity; assert.match(AS.validate(c).join('; '), /wind: not a finite number/);
  c = ok(); c.windSpeedMph = { v: 5, unit: 'mph', src: 'x', q: 'model' }; assert.match(AS.validate(c).join('; '), /windSpeedMph: unknown variable/);
});

test('confidence: comes from data quality and horizon, never from the score', () => {
  const inp = o => AS.contract(Object.assign({ hr: 9, wind: 8, wave: 0.4, sst: 21, t: '2026-11-10T09:00' }, o), { sm: SM }), lv = (o, m) => AS.confidence(inp(o), Object.assign({ dayOffset: 0 }, m)).level;
  assert.equal(lv({}), 'high');
  assert.equal(lv({ wave: null }), 'medium', 'one important input missing → at most medium'); assert.equal(lv({ sst: null }), 'medium');
  assert.equal(lv({ wave: null, sst: null }), 'low'); assert.equal(lv({ wind: null }), 'low', 'no wind → low');
  assert.equal(lv({ wave: null, sst: null }, { prof: 'lake' }), 'high', 'lake: sea waves and sea temperature are not needed');
  const H = CFG.confidence.horizon; for (let d = 0; d <= 13; d++) assert.equal(lv({}, { dayOffset: d }), d <= H.highTo ? 'high' : d <= H.mediumTo ? 'medium' : 'low', 'day +' + d);
  assert.equal(lv({}, { unc: { bad: true } }), 'medium', 'weather models disagree → one step down'); assert.equal(lv({}, { unc: { bad: false } }), 'high');
  assert.equal(lv({ wave: null }, { unc: { bad: true } }), 'low'); assert.equal(lv({}, { dayOffset: 9, unc: { bad: true } }), 'low', 'never below low');
  for (const ev of ['strong', 'some', 'none']) for (const local of [true, false]) { assert.equal(lv({ wave: null }, { evidence: ev, local }), 'medium', 'evidence/locality never lift it above what the data allow'); assert.equal(lv({}, { dayOffset: 8, evidence: ev, local }), 'low'); }
  const c = AS.confidence(inp({ wave: null }), { dayOffset: 4, unc: { bad: true } }); assert.deepEqual(plain(c.why), ['wave missing', 'day +4', 'weather models disagree']); assert.deepEqual(Object.keys(c.pillars).sort(), ['completeness', 'evidence', 'horizon', 'local', 'models']);
  /* ίδια ποιότητα δεδομένων, πολύ διαφορετικός βαθμός → ίδια βεβαιότητα· ίδιος βαθμός, άλλη ποιότητα → άλλη βεβαιότητα */
  const calm = AS.evaluate(SM, { hr: 7, wind: 6, wave: 0.3, sst: 21, t: '2026-11-10T07:00' }, { dayOffset: 0 }), rough = AS.evaluate(SM, { hr: 13, wind: 30, wave: 2.5, gust: 40, sst: 21, code: 95, t: '2026-11-10T13:00' }, { dayOffset: 0 });
  assert.ok(calm.score - rough.score > 40); assert.equal(calm.confidence.level, rough.confidence.level);
  const a = AS.evaluate(SM, { hr: 7, wind: 6, wave: 0.5, sst: 21, t: '2026-11-10T07:00' }, { dayOffset: 0 }), b = AS.evaluate(SM, { hr: 7, wind: 6, wave: null, sst: 21, t: '2026-11-10T07:00' }, { dayOffset: 0 });
  assert.equal(a.score, b.score, 'same score…'); assert.equal(a.confidence.level, 'high'); assert.equal(b.confidence.level, 'medium', '…different confidence');
});

test('one result per forecast hour: scoreHour reproduces the score and bite of the forecast, with reasons, contract, confidence and config version', async () => {
  const LEARN = { by: { sea: { ins: [{ f: 'sun', b: 1, lift: 1.6, n: 80, src: 'both' }, { f: 'wind', b: 1, lift: 1.4, n: 60, src: 'both' }, { f: 'pt', b: 0, lift: 0.6, n: 40, src: 'both' }] } } }; let n = 0, learned = 0;
  for (const [prof, sp] of [['boat', null], ['shore', SARGO], ['spear', null], ['lake', null], ['boat', SQUID]]) {
    const U = loadNew({ now: '2026-11-09T04:00:00Z', storage: { 'alkyon-fprof': prof } }), fc = await U.PF.getForecast(34.66, 33.04, fakeMeteo(500 + n, { holes: true }), { days: 8, learn: LEARN, sp, ens: true });
    fc.days.forEach((d, di) => { const sm = U.PF.sunMoon(d.date, 34.66, 33.04, 120); for (const h of d.hours) { const e = U.PF.scoreHour(sm, h, { dayOffset: di, unc: d.unc, sp, learn: LEARN });
      assert.equal(e.score, h.score, `${prof} ${d.date} ${h.hr}`); assert.equal(e.bite, h.bite); assert.equal(e.cfg, '2026.11-1'); assert.deepEqual(plain(U.AS.validate(e.input)), []);
      assert.ok(['low', 'medium', 'high'].includes(e.confidence.level)); if (h.learn) { learned++; assert.deepEqual(plain(e.learn), plain(h.learn)); assert.equal(e.core === e.score, !e.reasons.some(x => x.k === 'learn')); assert.equal(e.confidence.pillars.evidence, 1); } else assert.equal(e.learn, null);
      if (di > CFG.confidence.horizon.mediumTo) assert.equal(e.confidence.level, 'low'); n++; } }); }
  assert.ok(n > 800 && learned > 50, `hours ${n}, learned ${learned}`);
});

test('server and watch bundles carry the same config and core as the app, in the right order, before forecast.js', () => {
  const src = SCORE_FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8').trimEnd());
  for (const f of ['quick-processor-index.ts', 'watch-edge-index.ts']) { const ts = fs.readFileSync(path.join(ROOT, f), 'utf8'), at = src.map(s => ts.indexOf(s));
    at.forEach((i, k) => assert.ok(i >= 0, f + ' contains ' + SCORE_FILES[k])); assert.ok(at[0] < at[1] && at[1] < at[2], f + ': config → core → forecast'); }
});
