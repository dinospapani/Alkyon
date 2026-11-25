/* 21/11/2026 · κενό GPS στο ΤΕΛΟΣ της εξόδου.
   Το σφάλμα διάγνωσης (Galaxy 1.14.94, 21/11): η υπηρεσία πήρε 1 θέση και σταμάτησε· σε 22′ η διάγνωση έγραφε «gaps60 0, gapMax 0»,
   γιατί το κενό μετριέται μόνο όταν έρθει η ΕΠΟΜΕΝΗ θέση (Java και Swift). Επιπλέον, αν στο τελευταίο mergeFixes δεν υπήρχαν νέα σημεία,
   η διάγνωση της υπηρεσίας δεν ανανεωνόταν. Εδώ τρέχουν οι πραγματικές nTail / mergeFixes / gpsDiag του v4/trip.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function fn(src, name) { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, 'function ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(i, k + 1); } } throw new Error('unbalanced ' + name); }
const TRIP = rd('v4/trip.js');
const { nTail, gpsDiag } = new Function('NT', 'navigator', ['nTail', 'gpsDiag', 'dgf'].map(n => fn(TRIP, n)).join('\n') +
  "\nvar DGM={}, NS0='', MGE='', endHow='ok'; return {nTail, gpsDiag};")(() => ({}), { userAgent: 'Android' });

const S = Date.parse('2026-11-21T09:11:00Z'), MIN = 60000;

test('the 21/11 Galaxy 1.14.94 case: 1 fix, then nothing for 22 minutes → one gap at the end, not «0 gaps»', () => {
  const n = { t0: S + 270, t1: S + 414, raw: 1, kept: 1, gaps60: 0, gapMax: 0, every: 5 };
  const o = nTail(n, S + 22.8 * MIN, S);
  assert.equal(o.gaps60, 1); assert.equal(o.gapMax, Math.round((22.8 * MIN - 414) / 1000)); assert.equal(o.tail, o.gapMax);
  assert.equal(n.gaps60, 0, 'the stored service diag is not mutated');
});

test('healthy trips are unchanged: iPhone 4 h (last fix 3″ before the end) and Galaxy 1.14.95 (21″) — only the tail is noted', () => {
  const ios = nTail({ t0: S + 500, t1: S + 4 * 60 * MIN - 3000, raw: 10243, kept: 2228 }, S + 4 * 60 * MIN, S);
  assert.equal(ios.gaps60, undefined, 'iOS omits gaps60 when zero, and a 3″ tail is not a gap'); assert.equal(ios.tail, 3);
  const and = nTail({ t0: S, t1: S + 26 * MIN, raw: 313, gaps60: 0, gapMax: 0 }, S + 26 * MIN + 21000, S);
  assert.equal(and.gaps60, 0); assert.equal(and.gapMax, 0); assert.equal(and.tail, 21);
});

test('no fix at all: the gap is counted from the start of the trip', () => {
  const o = nTail({ raw: 0, t0: 0, t1: 0 }, S + 30 * MIN, S);
  assert.equal(o.gaps60, 1); assert.equal(o.tail, 30 * 60);
});

test('an earlier, longer gap stays the maximum; a trip closed in the past (endAt before the last fix) adds nothing', () => {
  const o = nTail({ t0: S, t1: S + 50 * MIN, gaps60: 2, gapMax: 900 }, S + 52 * MIN, S);
  assert.equal(o.gaps60, 3); assert.equal(o.gapMax, 900); assert.equal(o.tail, 120);
  const past = nTail({ t0: S, t1: S + 50 * MIN }, S + 40 * MIN, S);
  assert.equal(past.tail, undefined); assert.equal(past.gaps60, undefined);
  assert.deepEqual(nTail({ t1: S }, 0, S), { t1: S }, 'no end time: unchanged');
});

test('gpsDiag carries the tail into gps.n when it gets the end time', () => {
  const t = { pts: [], m: 0, d: { n: { t0: S + 270, t1: S + 414, raw: 1, kept: 1, gaps60: 0, gapMax: 0 } } };
  const g = gpsDiag(t, null, null, 0, S + 22.8 * MIN, S);
  assert.equal(g.n.gaps60, 1); assert.ok(g.n.tail > 1300);
  assert.match(TRIP, /tk=takeTrack\(NOW\)/, 'the trip end passes the real end time');
  assert.match(TRIP, /out\.gps=gpsDiag\(t,dw,tr,eps,endMs,s\.start\)/);
});

test('mergeFixes refreshes the service diag even when no new fixes arrived (it used to keep the last one with fixes)', async () => {
  const store = {}, q = { id: 'T1', pts: [], nat: S, d: {} };
  const ls = { get: k => store[k], set: (k, v) => { store[k] = v; } };
  const diag = { t0: S + 270, t1: S + 414, raw: 1, kept: 1 };
  const mergeFixes = new Function('NT', 'load', 'track', 'ls', 'B', 'dist', 'need', 'dgm',
    "var DGM={}, MGE='';\n" + fn(TRIP, 'dgf') + '\n' + fn(TRIP, 'mergeFixes') + '\nreturn mergeFixes;')(
    () => ({ fixes: async () => ({ fixes: [], diag }) }), () => ({ active: true, id: 'T1', start: S }), () => q, ls, { emit() {} }, () => 0, () => 12, () => {});
  assert.equal(await mergeFixes(), 0);
  assert.deepEqual(store['alkyon-track'].d.n, diag);
});
