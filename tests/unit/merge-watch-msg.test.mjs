/* 21/11/2026 · δύο μικρές διορθώσεις (έγκριση Dinos 20:24):
   1) trip.js: τα mergeFixes τρέχουν ένα-ένα (mergeQ). Galaxy 1.14.95, 21/11: άνοιγμα της εφαρμογής + «Τέλος» → δύο ταυτόχρονες αναγνώσεις, nat 612 = 2 × 306.
   2) garmin.js: «Στείλε στο ρολόι» δεν γράφει «Στάλθηκε» όταν δεν υπάρχει ρολόι (στο Android το link() απαντά ok όταν ο κωδικός γραφτεί στο κινητό). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function fn(src, name) { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, 'function ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(i, k + 1); } } throw new Error('unbalanced ' + name); }
const TRIP = rd('v4/trip.js'), GAR = rd('v4/garmin.js');

/* ---------- 1) mergeQ ---------- */
function harness(fixes) {
  const store = {}, q = { id: 'T1', pts: [], nat: 0, d: {} }, calls = [];
  store['alkyon-track'] = q;
  const ls = { get: k => store[k], set: (k, v) => { store[k] = v; } };
  const NT = () => ({ fixes: async ({ since }) => { calls.push(since); await new Promise(r => setTimeout(r, 20)); return { fixes: fixes.filter(f => f[2] > since), diag: { raw: fixes.length, kept: fixes.length } }; } });
  const track = () => store['alkyon-track'];
  const src = "var DGM={}, MGE='';\n" + ['dgf', 'mergeFixes'].map(n => fn(TRIP, n)).join('\n') + '\n' +
    TRIP.slice(TRIP.indexOf('var mfQ=Promise.resolve();'), TRIP.indexOf('function mergeFixes(')) + '\nreturn {mergeQ, mergeFixes};';
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 111320;
  const M = new Function('NT', 'load', 'track', 'ls', 'B', 'dist', 'need', 'dgm', src)(NT, () => ({ active: true, id: 'T1', start: 0 }), track, ls, { emit() {} }, dist, () => 12, () => {});
  return { M, store, calls };
}
const fixes = Array.from({ length: 30 }, (_, i) => [34.7 + i * 0.001, 32.4, 1000 + i * 5000, 5]);

test('two merges at once (app opened, then «End») read the service once each, in turn — no double counting', async () => {
  const { M, store, calls } = harness(fixes);
  await Promise.all([M.mergeQ(), M.mergeQ()]);
  const d = store['alkyon-track'].d;
  assert.equal(d.nat, 30, 'each native fix counted once'); assert.equal(calls.length, 2);
  assert.equal(calls[0], 0); assert.equal(calls[1], fixes[29][2], 'the second read starts where the first ended');
  assert.equal(store['alkyon-track'].pts.length, 30);
});

test('regression guard: the same two calls without the queue double the counters (the 21/11 Galaxy diagnostic)', async () => {
  const { M, store } = harness(fixes);
  await Promise.all([M.mergeFixes(), M.mergeFixes()]);
  assert.equal(store['alkyon-track'].d.nat, 60);
});

test('all callers of the merge go through the queue', () => {
  assert.match(TRIP, /mergeQ\(\)\.then\(function\(\)\{ go\('ok'\); \}/, 'trip end');
  assert.match(TRIP, /if\(load\(\)\.active\)\{ mergeQ\(\); trackPos\(\); \}/, 'app opened');
  assert.match(TRIP, /setTimeout\(function\(\)\{ mergeQ\(\); trackPos\(\)/, 'app start');
  const calls = (TRIP.match(/[^.\w]mergeFixes\(\)/g) || []).length - (TRIP.match(/function mergeFixes\(\)/g) || []).length;
  assert.equal(calls, 2, 'mergeFixes() is called only inside mergeQ (twice: after success and after failure)');
});

/* ---------- 2) «Στείλε στο ρολόι» ---------- */
const T = (el) => el;
const sendMsg = new Function('T', fn(GAR, 'sendMsg') + '\nreturn sendMsg;')(T);

test('«Send to watch»: «Sent» only when a watch with Alkyon is there and the send succeeded', () => {
  assert.equal(sendMsg({ watches: 1, app: 1 }, true), 'Στάλθηκε στο ρολόι.');
  assert.match(sendMsg({ watches: 1, app: 1 }, false), /δεν στάλθηκε/);
  assert.match(sendMsg({ watches: 1, app: 1 }, null), /δεν στάλθηκε/);
});

test('«Send to watch» with no watch: never «Sent» — even though Android\'s link() answers ok (the 21/11 finding C)', () => {
  const m = sendMsg({ watches: 0, app: 0 }, true);
  assert.doesNotMatch(m, /^Στάλθηκε/); assert.match(m, /Δεν βρέθηκε ρολόι με το Alkyon/);
  assert.match(sendMsg({ watches: 1, app: 0 }, true), /χωρίς το Alkyon/);
});

test('status unavailable: the send result decides, and a failure tells the user to type the code', () => {
  assert.equal(sendMsg(null, true), 'Στάλθηκε στο ρολόι.');
  assert.match(sendMsg(null, null), /Γράψε τον κωδικό στο ρολόι/);
});

test('the button uses sendNow (status first, then send); the old one-line toast is gone', () => {
  assert.match(GAR, /text:T\('Στείλε στο ρολόι','Send to watch'\),onclick:function\(\)\{ sendNow\(st\.code\); \}/);
  assert.doesNotMatch(GAR, /push\(st\.code\)\.then\(function\(ok\)\{ B\.toast\(ok\?T\('Στάλθηκε στο ρολόι/);
  assert.match(fn(GAR, 'sendNow'), /wstat\(\)\.then\(function\(r\)\{ return push\(code\)/);
});
