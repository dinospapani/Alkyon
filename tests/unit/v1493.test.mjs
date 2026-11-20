/* 1.14.93 · ML Data Foundation: παγωμένο στιγμιότυπο της πρόγνωσης (snapshot.js). Μόνο αποθήκευση· κανένα ML, κανένας βαθμός δεν αλλάζει. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';
import { loadNew, plain, fakeMeteo } from './score-load.mjs';

const NOW = '2026-11-09T04:00:00Z', LAT = 34.66, LON = 33.04;
const SNAP_SRC = fs.readFileSync(path.join(ROOT, 'snapshot.js'), 'utf8');
function snapLib() { const ctx = vm.createContext({ self: {} }); vm.runInContext(SNAP_SRC, ctx, { filename: 'snapshot.js' }); return ctx.self.AlkyonSnapshot; }
const SN = snapLib();
async function setup(prof) { const U = loadNew({ now: NOW, storage: { 'alkyon-fprof': prof || 'boat' } }), F = fakeMeteo(321, { holes: true }); const fc = await U.PF.getForecast(LAT, LON, F, { days: 2, ens: true }); return { U, fc }; }
const META = { at: Date.parse(NOW) + 4000, app: '1.14.93', pf: 'android', prof: 'boat', sp: null };

test('snapshot: one row per forecast hour with the exact inputs the score saw, their quality and source', async () => {
  const { U, fc } = await setup(), s = plain(SN.build(fc, LAT, LON, U.PF, META));
  assert.equal(s.v, 1); assert.equal(s.at, META.at); assert.equal(s.app, '1.14.93'); assert.equal(s.pf, 'android'); assert.equal(s.cfg, '2026.11-1'); assert.equal(s.prof, 'boat');
  assert.ok(SN.valid(s)); const hs = fc.days.flatMap((d, di) => d.hours.filter(x => x.score != null).map(x => ({ x, d, di }))); assert.equal(s.h.length, hs.length); assert.ok(s.h.length > 20);
  for (const c of ['wind', 'gust', 'wave', 'pressure', 'pressureTrend', 'sst', 'airTemp', 'rainProb', 'rainMm', 'cloud', 'moonPhase', 'minute', 'month']) assert.ok(s.cols.includes(c), c);
  /* κάθε τιμή είναι ακριβώς το input του βαθμού εκείνης της ώρας */
  hs.forEach(({ x, d, di }, i) => { const sm = U.PF.sunMoon(d.date, LAT, LON, fc.tz), e = U.PF.scoreHour(sm, x, { dayOffset: di, unc: d.unc }), r = SN.row(s, i);
    assert.equal(r.hour, Math.floor((Date.parse(x.t + ':00Z') - fc.tz * 60000) / 3600000));
    for (const c of s.cols) { const inp = e.input[c], want = typeof inp.v === 'number' ? Math.round(inp.v * 100) / 100 : (inp.v == null ? null : inp.v); assert.deepEqual(r[c].v, want, c); assert.equal(r[c].q, { meas: 'm', model: 'o', est: 'e', default: 'd', missing: 'x' }[inp.q], c + ' quality'); } });
  assert.equal(s.src.wind, 'open-meteo'); assert.equal(s.src.moonPhase, 'astro');
  const q = s.h.map(r => r[r.length - 1]).join(''); assert.ok(/o/.test(q) && /m/.test(q), 'model and measured values are told apart'); assert.ok(/[xd]/.test(q), 'missing or default values are recorded as such, not hidden');
});

test('snapshot holds nothing that identifies the user or the place, and no outcome', async () => {
  const { U, fc } = await setup(), s = SN.build(fc, LAT, LON, U.PF, META), txt = JSON.stringify(s);
  assert.deepEqual(Object.keys(s).sort(), ['app', 'at', 'cfg', 'cols', 'h', 'pf', 'prof', 'sp', 'src', 'v']);
  assert.ok(!txt.includes('34.66') && !txt.includes('33.04'), 'no position'); assert.ok(!/user|email|name|uid|lat|lon"/i.test(Object.keys(s).join(',')));
  for (const k of ['count', 'cnt', 'fish', 'catch', 'kg', 'rate', 'score', 'learn']) assert.ok(!s.cols.includes(k), k + ' is not an input');
});

test('building a snapshot changes no score and no forecast', async () => {
  const { U, fc } = await setup(), before = JSON.stringify(fc), rows = JSON.stringify(U.PF.scoreRows(fc, LAT, LON));
  SN.build(fc, LAT, LON, U.PF, META); SN.build(fc, LAT, LON, U.PF, META);
  assert.equal(JSON.stringify(fc), before); assert.equal(JSON.stringify(U.PF.scoreRows(fc, LAT, LON)), rows);
  const a = JSON.stringify(SN.build(fc, LAT, LON, U.PF, META)), b = JSON.stringify(SN.build(fc, LAT, LON, U.PF, META)); assert.equal(a, b, 'same input → same snapshot');
});

test('trim keeps only the hours of the trip; late snapshots are flagged', async () => {
  const { U, fc } = await setup(), s = SN.build(fc, LAT, LON, U.PF, META), h0 = s.h[5][0], start = h0 * 3600000 + 600000, end = (h0 + 3) * 3600000 + 60000;
  const t = SN.trim(s, start, end); assert.deepEqual(plain(t.h.map(r => r[0])), [h0, h0 + 1, h0 + 2, h0 + 3]); assert.equal(t.at, s.at); assert.equal(t.cfg, s.cfg); assert.ok(SN.valid(t)); assert.equal(s.h.length > 4, true, 'the original is not modified');
  assert.equal(SN.trim(s, 1, 2), null); assert.equal(SN.trim(null, start, end), null); assert.equal(SN.trim(s, end, start), null);
  assert.equal(SN.late({ at: start + 4000 }, start), false); assert.equal(SN.late({ at: start + 10 * 60000 }, start), false); assert.equal(SN.late({ at: start + 10 * 60000 + 1 }, start), true, 'more than 10 minutes after the start');
  assert.equal(SN.late({ at: null }, start), true, 'no time → treated as late'); assert.equal(SN.late(null, start), true); assert.equal(SN.LATE_MIN, 10);
});

test('missing data and bad input never throw', async () => {
  const { U, fc } = await setup();
  assert.equal(SN.build(null, LAT, LON, U.PF, META), null); assert.equal(SN.build(fc, LAT, LON, null, META), null); assert.equal(SN.build({ days: [] }, LAT, LON, U.PF, META), null);
  assert.equal(SN.build(fc, LAT, LON, { scoreHour() { throw new Error('x'); }, sunMoon: U.PF.sunMoon }, META), null);
  const noAt = SN.build(fc, LAT, LON, U.PF, {}); assert.equal(noAt.at, null); assert.equal(noAt.app, null);
  assert.equal(SN.valid({ v: 2, cols: ['a'], h: [[1, 2, 'o']] }), false, 'another format version is not accepted as this one');
  assert.equal(SN.valid({ v: 1, cols: ['a', 'b'], h: [[1, 2, 'o']] }), false); assert.equal(SN.valid(null), false);
});

test('each profile freezes its own inputs (lake has no wave)', async () => {
  for (const prof of ['boat', 'shore', 'lake', 'spear']) { const { U, fc } = await setup(prof), s = SN.build(fc, LAT, LON, U.PF, Object.assign({}, META, { prof })); assert.ok(SN.valid(s), prof); assert.equal(s.prof, prof); }
});

test('wiring: stored once at trip end, sent with the contribution, never read by the score', () => {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), te = R('v4/trip-extra.js'), co = R('v4/contrib.js');
  assert.match(te, /AlkyonSnapshot\.build\(fc,\+p\.lat,\+p\.lon,PF,\{at:Date\.now\(\),app:window\.ALKYON_VERSION/);
  assert.match(te, /if\(sc\.snap&&window\.AlkyonSnapshot&&!t\.snap\)/, 'a trip that already has a snapshot keeps it');
  assert.match(te, /patchTrip\(id,\{scoreH:hs,scoreSp:sc\.sp\|\|undefined,scoreCfg:sc\.cfg\|\|undefined\}\)/, 'scoreH / scoreSp / scoreCfg are written exactly as before');
  assert.match(co, /cd\.snap=x\.snap/); assert.match(co, /AS2\.valid\(x\.snap\)/);
  /* ο βαθμός, η πρόγνωση, η προσωπική πρόγνωση, ο server και το ρολόι δεν ξέρουν ότι υπάρχει */
  for (const f of ['score-config.js', 'score-core.js', 'forecast.js', 'personal.js', 'safety-job.mjs', 'watch-index.ts', 'v4/forecast-view.js', 'v4/bestspot.js', 'v4/trip.js']) assert.ok(!/AlkyonSnapshot|\.snap\b/.test(R(f)), f + ' does not read the snapshot');
  assert.match(R('v4/index.html'), /<script src="\.\.\/forecast\.js"><\/script>\n<script src="\.\.\/snapshot\.js"><\/script>/); assert.match(R('v4/sw.js'), /'\.\.\/snapshot\.js'/);
  /* κανένα ML στην εφαρμογή */
  for (const f of ['snapshot.js', 'v4/trip-extra.js', 'v4/contrib.js']) assert.ok(!/ML_ENABLED|mlEnabled|predict\(|tensorflow|onnx/i.test(R(f)), f);
  const src = SNAP_SRC.replace(/\/\*[\s\S]*?\*\//g, ''); assert.ok(!/localStorage|document\.|window\.|fetch\(/.test(src), 'snapshot.js is pure');
});

test('migration file: adds created_at, set by the server, and has a rollback', () => {
  const up = fs.readFileSync(path.join(ROOT, 'sql/2026-11-20-ml-data.sql'), 'utf8'), down = fs.readFileSync(path.join(ROOT, 'sql/2026-11-20-ml-data-rollback.sql'), 'utf8');
  for (const t of ['records', 'catch_obs']) { assert.match(up, new RegExp('alter table public\\.' + t + '\\s+add column if not exists created_at timestamptz')); assert.match(down, new RegExp('alter table public\\.' + t + '\\s+drop column if exists created_at')); }
  assert.match(up, /new\.created_at := now\(\)/); assert.match(up, /new\.created_at := old\.created_at/); assert.match(up, /set search_path = ''/);
  assert.ok(!/\bupdate\s+public\.|delete\s+from|drop\s+table|truncate/i.test(up.replace(/--.*$/gm, '')), 'the migration rewrites and deletes no existing data');
});
