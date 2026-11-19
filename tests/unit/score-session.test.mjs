// P1.2 · ΕΓΚΥΡΗ ΕΞΟΔΟΣ ΨΑΡΕΜΑΤΟΣ: ένας κανόνας (AlkyonScore.session), ίδιος στην εφαρμογή και στον server, για το ποιες έξοδοι μετράνε στον έλεγχο του βαθμού.
// Αρχή: μετρά κάθε έξοδος που υπάρχει ανεξάρτητα από το αν πιάστηκαν ψάρια. Η έξοδος χωρίς ψάρια ΔΕΝ αποκλείεται ποτέ επειδή δεν είχε ψάρια.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
import { loadNew, plain } from './score-load.mjs';

const { PF, AS, CFG } = loadNew({ storage: null }), S = t => plain(AS.session(t));
const T0 = 1794586911976, H = 3600000, live = o => Object.assign({ startMs: T0, endMs: T0 + 4 * H + 123, lat: 34.9, lon: 32.3, sid: 's1', count: 0 }, o);

test('rule: live, "fished, caught nothing" and hand-entered trips are valid; "trips from the day\'s catches" are not', () => {
  assert.deepEqual(S(live()), { kind: 'live', valid: true, why: null, k: 'l' });
  assert.deepEqual(S(live({ sid: undefined, manual: true, nothing: true, startMs: 1794236400000, endMs: 1794247200000 })), { kind: 'nofish', valid: true, why: null, k: 'n' });
  assert.deepEqual(S(live({ sid: undefined, manual: true, count: 4, startMs: 1794236400000, endMs: 1794247200000 })), { kind: 'manual', valid: true, why: null, k: 'm' });
  assert.deepEqual(S(live({ sid: undefined, fromCatches: true, count: 3, startMs: 1794236400000, endMs: 1794247200000 })), { kind: 'fromCatches', valid: false, why: null, k: 'c' });
  /* ρολόι, εργαλείο που ποντίστηκε/σηκώθηκε, διαδρομή με ώρες: ζωντανή καταγραφή */
  assert.equal(S(live({ sid: undefined, track: [[34.9, 32.3, T0]] })).kind, 'live'); assert.equal(S(live({ sid: undefined })).kind, 'live', 'millisecond times → recorded live');
  assert.equal(S(live({ sid: undefined, startMs: 1794236400000, endMs: 1794247200000 })).kind, 'manual', 'old hand-entered trip without a flag (whole minutes)');
});

test('rule: the outcome never decides validity — a trip with zero fish is exactly as valid as one with fish', () => {
  for (const base of [live(), live({ sid: undefined, manual: true, startMs: 1794236400000, endMs: 1794247200000 })]) for (const count of [0, 1, 7, 40])
    assert.deepEqual(S(Object.assign({}, base, { count })), S(Object.assign({}, base, { count: 0 })), 'count ' + count);
  for (const cnt of [0, 3]) assert.equal(S({ ms: T0, ms2: T0 + 3 * H, lat: 35, cnt, cond: { k: 'l' } }).valid, true);
  for (const cnt of [0, 3]) assert.equal(S({ ms: T0, ms2: T0 + 3 * H, lat: 35, cnt }).valid, true, 'legacy live row');
});

test('rule: duration and position limits come from the config (20 minutes to 16 hours, with a position)', () => {
  assert.deepEqual(plain(CFG.session), { minMin: 20, maxHours: 16 });
  const d = ms => S(live({ endMs: T0 + ms }));
  assert.deepEqual(d(20 * 60000 - 1), { kind: 'invalid', valid: false, why: 'short', k: 'x' }); assert.equal(d(20 * 60000).valid, true);
  assert.equal(d(16 * H).valid, true); assert.deepEqual(d(16 * H + 1), { kind: 'invalid', valid: false, why: 'long', k: 'x' }, 'a forgotten running trip is not a fishing session');
  assert.equal(d(0).why, 'times'); assert.equal(d(-5).why, 'times'); assert.equal(S({}).why, 'times'); assert.equal(S(null).kind, 'invalid');
  assert.equal(S(live({ lat: null })).why, 'position'); assert.equal(S(live({ lat: null, cond0: { lat: 34.9 } })).valid, true, 'position from the trip start');
  /* τα όρια ισχύουν και για τις «από τα ψάρια» και για τις χειρόγραφες */
  assert.equal(S(live({ manual: true, nothing: true, endMs: T0 + 5 * 60000 })).why, 'short');
});

test('server rows: the flag sent by the app decides; unflagged old rows are classified conservatively', () => {
  const row = o => Object.assign({ ms: 1794236400000, ms2: 1794247200000, lat: 34.7, lon: 32.4, cnt: 2 }, o);
  for (const [k, kind, valid] of [['l', 'live', true], ['n', 'nofish', true], ['m', 'manual', true], ['c', 'fromCatches', false], ['x', 'invalid', false]]) { const r = S(row({ cond: { k } })); assert.equal(r.kind, kind); assert.equal(r.valid, valid); assert.equal(r.k, k, 'the flag round-trips'); }
  /* παλιές γραμμές χωρίς σημάδι */
  assert.equal(S(row({ ms: T0, ms2: T0 + 2 * H + 7 })).kind, 'live', 'millisecond times → live');
  assert.deepEqual(S(row({ cnt: 0 })), { kind: 'nofish', valid: true, why: null, k: 'n' }, 'whole minutes and no fish can only be a hand-entered no-fish trip → valid');
  assert.deepEqual(S(row({ cnt: 3 })), { kind: 'unknown', valid: false, why: 'legacy row', k: null }, 'whole minutes with fish: could be "from the day\'s catches" → left out until re-sent with a flag');
  assert.equal(S(row({ cond: { rt: 2, e: [] } })).kind, 'unknown', 'other cond fields do not count as a flag');
  assert.equal(S(row({ ms2: 1794236400000 + 34 * H, cnt: 0 })).why, 'long');
  /* η εφαρμογή και ο server συμφωνούν για την ίδια έξοδο */
  for (const t of [live(), live({ sid: undefined, manual: true, nothing: true, startMs: 1794236400000, endMs: 1794247200000 }), live({ sid: undefined, fromCatches: true, count: 2, startMs: 1794236400000, endMs: 1794247200000 }), live({ endMs: T0 + 40 * H })]) {
    const a = AS.session(t), b = AS.session({ ms: t.startMs, ms2: t.endMs, lat: t.lat, cnt: t.count, cond: { k: a.k } }); assert.equal(b.kind, a.kind); assert.equal(b.valid, a.valid); }
});

test('one rule everywhere: PF.session is the core rule; the app sends the kind; the server evaluation uses it and the learning does not change', () => {
  assert.deepEqual(plain(PF.session(live())), S(live()));
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), contrib = src('v4/contrib.js'), job = src('safety-job.mjs'), edge = src('quick-processor-index.ts');
  assert.match(contrib, /var se=window\.PF&&PF\.session\?PF\.session\(x\):null; if\(se&&se\.k\)\{ cd=cd\|\|\{\}; cd\.k=se\.k; \}/, 'the app sends cond.k from the one rule');
  assert.ok(!/minMin|maxHours|fromCatches/.test(job.replace(/\/\/.*$/gm, '')), 'the server holds no second copy of the rule');
  assert.match(job, /const sesOf = t => \{ try \{ return PF\.session \? PF\.session\(t\)/);
  assert.match(job, /t\.cond\.e\.length && evalOK\(t\)\); if \(T\.length < 5\) return null;/, '"how right was the forecast" counts valid trips only');
  assert.match(job, /const T = trips\.filter\(t => t\.ms2 > t\.ms\), TV = vo \? T\.filter\(evalOK\) : T; if \(TV\.length < 8\) return null;/);
  assert.equal((job.match(/const test = TV\.filter\(t => fold\(t\.day\) === k\)/g) || []).length, 2, 'tested on valid trips');
  assert.ok((job.match(/T\.filter\(t => fold\(t\.day\) !== k\)/g) || []).length >= 2, 'findings still come from all the other trips');
  assert.match(job, /const bt = backtest\(catches, trips, ex, g\); A0\.data\.trips = trips\.length; A0\.data\.ses = sesCount\(trips\);/, 'the legacy check (which decides whether learning is on) is unchanged');
  assert.match(job, /const A0 = analyse\(catches, trips, 8, ex\)/, 'learning still uses every trip');
  assert.ok(edge.includes('function session(t,cfg)') && edge.includes('const evalOK = t => sesOf(t).valid;'), 'the Edge Function bundle carries the rule');
});
