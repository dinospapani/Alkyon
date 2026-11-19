// P1.2 · αξιολόγηση του βαθμού: τα εργαλεία στατιστικής (tools/score-eval-lib.mjs) και το στιγμιότυπο πρόγνωσης που κρατά κάθε έξοδος (PF.scoreRows).
// Με τεχνητά δεδομένα όπου η αλήθεια είναι γνωστή: τα εργαλεία πρέπει να βρίσκουν μια πραγματική βελτίωση και να ΜΗΝ «βρίσκουν» κάτι μέσα στον θόρυβο.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auc, spearman, bootstrap, compare, bands, power, decide, GATE, rng } from '../../tools/score-eval-lib.mjs';
import { loadNew, loadOld, fakeMeteo, plain } from './score-load.mjs';

const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
/* έξοδοι με γνωστή σχέση: «good» προβλέπει το αποτέλεσμα, «noise» όχι, «better» = good με λιγότερο θόρυβο */
function world(n, seed, users = 12) { const r = rng(seed), rows = []; for (let i = 0; i < n; i++) { const q = gauss(r), fish = Math.max(0, Math.round(1.5 + 1.5 * q + gauss(r))), h = 3 + Math.floor(r() * 4);
  rows.push({ u: i % users, h, fish, y: fish / h, good: 60 + 8 * q + 8 * gauss(r), better: 60 + 8 * q + 3 * gauss(r), noise: 60 + 8 * gauss(r), same: 60 + 8 * q + 8 * gauss(r) }); } return rows; }

test('AUC: exact on small cases, 0.5 for a useless score, 1 for a perfect one, null when every trip had the same outcome', () => {
  const R = [{ y: 0, s: 10 }, { y: 1, s: 20 }, { y: 2, s: 30 }];
  assert.deepEqual(auc(R), { a: 1, p: 3 });
  assert.deepEqual(auc(R.map(x => ({ y: x.y, s: -x.s }))), { a: 0, p: 3 });
  assert.deepEqual(auc([{ y: 0, s: 5 }, { y: 1, s: 5 }]), { a: 0.5, p: 1 }, 'tie counts half');
  assert.equal(auc([{ y: 1, s: 5 }, { y: 1, s: 9 }]), null);
  assert.deepEqual(auc([{ y: 0, s: 1 }, { y: 0, s: 2 }, { y: 3, s: 3 }, { y: 3, s: 0 }]), { a: 0.5, p: 4 });
  const W = world(3000, 1); assert.ok(Math.abs(auc(W, 'noise').a - 0.5) < 0.03); assert.ok(auc(W, 'good').a > 0.6); assert.ok(auc(W, 'better').a > auc(W, 'good').a + 0.03);
});

test('Spearman and score bands', () => {
  assert.equal(spearman([{ y: 1, s: 1 }, { y: 2, s: 5 }, { y: 3, s: 9 }]), 1); assert.equal(spearman([{ y: 1, s: 9 }, { y: 2, s: 5 }, { y: 3, s: 1 }]), -1);
  assert.equal(spearman([{ y: 1, s: 1 }, { y: 2, s: 2 }]), null); assert.equal(spearman([{ y: 1, s: 3 }, { y: 1, s: 4 }, { y: 1, s: 5 }]), null, 'no variation → no correlation');
  const b = bands([{ s: 45, h: 2, fish: 0 }, { s: 55, h: 4, fish: 2 }, { s: 60, h: 2, fish: 4 }, { s: 75, h: 0.5, fish: 3 }], [50, 60, 70], 's');
  assert.deepEqual(b.n, [1, 1, 1, 1]); assert.deepEqual(b.perHour, [0, 0.5, 2, null], 'a band with under one hour of fishing shows no rate'); assert.deepEqual(b.hit, [0, 1, 1, 1]);
});

test('bootstrap: the 95% interval is repeatable, covers the truth for a real effect and stays around 0.5 for noise', () => {
  const W = world(400, 2), st = k => rs => { const a = auc(rs, k); return a ? a.a : null; };
  const g = bootstrap(W, st('good'), { B: 800, seed: 3 }), n = bootstrap(W, st('noise'), { B: 800, seed: 3 });
  assert.deepEqual(bootstrap(W, st('good'), { B: 800, seed: 3 }), g, 'same seed → same interval');
  assert.ok(g.lo > 0.5 && g.lo < g.est && g.est < g.hi, JSON.stringify(g)); assert.ok(n.lo < 0.5 && n.hi > 0.5, JSON.stringify(n));
  /* οι έξοδοι του ίδιου χρήστη δεν είναι ανεξάρτητες: με ξαναδειγματοληψία ολόκληρων χρηστών το διάστημα δεν στενεύει */
  const c = bootstrap(W, st('good'), { B: 800, seed: 3, cluster: 'u' }); assert.ok(c.lo != null && c.hi - c.lo > 0.02);
  /* εννέα έξοδοι (όσες έχουμε σήμερα με καταγραφή): το διάστημα είναι κατά μέσο όρο τόσο πλατύ που δεν λέει τίποτα */
  let wsum = 0, wn = 0; for (let sd = 0; sd < 40; sd++) { const f = bootstrap(world(9, 500 + sd), st('good'), { B: 300, seed: sd }); if (f.lo != null) { wsum += f.hi - f.lo; wn++; } }
  assert.ok(wn > 30 && wsum / wn > 0.4, 'mean width of the 95% interval with nine trips: ' + (wsum / wn).toFixed(2));
});

test('comparing two scores: a real improvement is detected, an equally good one and pure noise are not', () => {
  const W = world(600, 9);
  const up = compare(W, 'good', 'better', { B: 800, seed: 4 }); assert.ok(up.est > 0.03 && up.lo > 0, JSON.stringify(up));
  const eq = compare(W, 'good', 'same', { B: 800, seed: 4 }); assert.ok(eq.lo < 0 && eq.hi > 0, JSON.stringify(eq));
  const dn = compare(W, 'good', 'noise', { B: 800, seed: 4 }); assert.ok(dn.hi < 0, 'a worse score shows a negative difference');
  /* με λίγες εξόδους ακόμα και η πραγματική βελτίωση δεν αποδεικνύεται → δεν πρέπει να ενεργοποιείται τίποτα */
  let proven = 0; for (let s = 0; s < 40; s++) { const d = compare(world(24, 100 + s), 'good', 'better', { B: 300, seed: s }); if (d.lo > 0) proven++; } assert.ok(proven < 20, 'with 24 trips a real improvement is proven only sometimes: ' + proven + '/40');
});

test('decision rule: fixed thresholds; GO only with enough trips, users and both outcomes, a useful difference and an interval above zero', () => {
  assert.deepEqual(GATE, { minTrips: 150, minUsers: 10, minPos: 30, minDelta: 0.03 });
  const ok = { trips: 200, users: 15, pos: 90, neg: 110, delta: { est: 0.05, lo: 0.01, hi: 0.09 } };
  assert.deepEqual(decide(ok), { go: true, why: [] });
  for (const [ch, re] of [[{ trips: 149 }, /trips 149 < 150/], [{ users: 9 }, /users 9 < 10/], [{ pos: 29 }, /with fish 29 < 30/], [{ neg: 5 }, /without fish 5 < 30/], [{ delta: { est: 0.02, lo: 0.01, hi: 0.03 } }, /ΔAUC 0\.020 < 0\.03/], [{ delta: { est: 0.06, lo: -0.01, hi: 0.13 } }, /includes 0/], [{ delta: { est: 0.06, lo: 0, hi: 0.13 } }, /includes 0/], [{ delta: null }, /no measurable/], [{ delta: { est: null, lo: null, hi: null } }, /no measurable/]]) {
    const d = decide(Object.assign({}, ok, ch)); assert.equal(d.go, false); assert.match(d.why.join('; '), re); }
  /* η σημερινή κατάσταση της παραγωγής (24 έξοδοι, 4 χρήστες): ΟΧΙ, για κάθε λόγο ξεχωριστά */
  assert.equal(decide({ trips: 24, users: 4, pos: 17, neg: 7, delta: { est: 0.02, lo: -0.07, hi: 0.12 } }).why.length, 6);
});

test('power: more trips and a stronger score are easier to prove; a useless score is "proven" only by chance', () => {
  const o = { sims: 120, B: 200 }, p40 = power(40, 0.65, o), p300 = power(300, 0.65, o);
  assert.ok(p300 > 0.9 && p40 < 0.6 && p300 > p40, `${p40} ${p300}`); assert.ok(power(150, 0.7, o) > power(150, 0.6, o)); assert.ok(power(150, 0.5, o) < 0.1, 'false alarms stay rare');
});

test('trip snapshot (PF.scoreRows): the first two columns are exactly what scoreH kept before; the rest record core score, confidence, local wave correction and learned findings', async () => {
  const now = '2026-11-09T04:00:00Z', LEARN = { by: { sea: { ins: [{ f: 'sun', b: 1, lift: 1.6, n: 80, src: 'both' }, { f: 'wind', b: 1, lift: 1.4, n: 60, src: 'both' }] } } };
  const U = loadNew({ now, storage: { 'alkyon-fprof': 'boat' } }), O = loadOld({ now, storage: { 'alkyon-fprof': 'boat' } }), F = fakeMeteo(321, { holes: true });
  const fc = await U.PF.getForecast(34.66, 33.04, F, { days: 2, learn: LEARN, ens: true }), fo = await O.PF.getForecast(34.66, 33.04, F, { days: 2, learn: LEARN, ens: true });
  const R = U.PF.scoreRows(fc, 34.66, 33.04, { learn: LEARN }); assert.equal(R.cfg, '2026.11-1');
  /* ό,τι έγραφε το trip-extra.js της 1.14.84 */
  const old = []; fo.days.forEach(d => d.hours.forEach(x => { if (x.score == null) return; old.push([Math.floor((Date.parse(x.t + ':00Z') - fo.tz * 60000) / 3600000), x.score]); }));
  assert.ok(old.length > 20); assert.deepEqual(plain(R.h.map(r => r.slice(0, 2))), old, 'hour index and displayed score unchanged');
  let learned = 0, local = 0; const hs = fc.days.flatMap(d => d.hours).filter(x => x.score != null);
  R.h.forEach((r, i) => { assert.equal(r.length, 6); const [, score, core, conf, loc, ev] = r, h = hs[i];
    assert.ok(Number.isInteger(core) && core >= 5 && core <= 98); assert.ok([0, 1, 2].includes(conf)); assert.ok(loc === 0 || loc === 1); assert.ok(ev === 0 || ev === 1);
    assert.equal(ev, h.learn ? 1 : 0); assert.equal(loc, h.waveOff != null ? 1 : 0); if (!ev) assert.equal(core, score, 'without findings the displayed score is the core score'); learned += ev; local += loc; });
  assert.ok(learned > 0, 'some hours had learned findings');
  assert.deepEqual(plain(U.PF.scoreRows(null, 1, 2)), { cfg: '2026.11-1', h: [] }, 'no forecast → empty, no error');
  /* η αποθήκευση δεν αλλάζει την πρόγνωση */
  assert.deepEqual(plain(await U.PF.getForecast(34.66, 33.04, F, { days: 2, learn: LEARN, ens: true })), plain(fc));
});
