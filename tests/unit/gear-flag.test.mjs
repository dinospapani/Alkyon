/* 21/11/2026 · φάση 1β: ψάρι από ανέβασμα εργαλείου → το «Βοήθησε την πρόγνωση» στέλνει ως τεχνική το είδος του εργαλείου.
   Πριν: αν ο χρήστης είχε ήδη γράψει άλλη τεχνική (π.χ. «Spinning»), το gearTag δεν την άλλαζε (`if(!rec.tech)`), στάλθηκε «Spinning»,
   και ο server (PASSIVE στο safety-job.mjs) μετρούσε την ώρα ανάσυρσης ως ώρα τσιμπήματος.
   Εδώ τρέχουν τα ΠΡΑΓΜΑΤΙΚΑ v4/gear-view.js και v4/contrib.js (σε vm) και το ΠΡΑΓΜΑΤΙΚΟ PASSIVE του server κρίνει τη γραμμή που θα σταλεί. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ο ίδιος έλεγχος με τον server: η λίστα PASSIVE διαβάζεται από το safety-job.mjs, όχι αντιγραμμένη */
const JOB = rd('safety-job.mjs');
const PASSIVE = new Set(eval(JOB.match(/const PASSIVE = new Set\((\[[^\]]+\])\)/)[1]));
const serverPassive = r => !!r.tech && PASSIVE.has(String(r.tech).trim().toLowerCase());

function app({ en = false, gear = [] } = {}) {
  const store = { 'alkyon-gear': { items: gear, seq: {} } };
  const noop = () => {};
  const B = {
    h: () => ({ append: noop, addEventListener: noop }), T: (el, e) => (en ? e : el), EN: en,
    ls: { get: (k, d) => (k in store ? store[k] : d), set: (k, v) => { store[k] = v; } },
    store: { raw: () => [] }, emit: noop, on: noop, toast: noop, sheet: noop, num: x => String(x), pad: x => String(x).padStart(2, '0'),
    dateShort: x => x, country: () => 'cy',
  };
  const ctx = { window: { AK: B }, document: { addEventListener: noop, querySelector: () => null, hidden: true },
    location: { search: '', pathname: '/' }, history: { replaceState: noop, state: null }, setInterval: () => 0, clearInterval: noop,
    setTimeout: () => 0, clearTimeout: noop, navigator: {}, console };
  ctx.window.window = ctx.window; vm.createContext(ctx);
  vm.runInContext(rd('v4/contrib.js'), ctx);       // ίδια σειρά με το v4/index.html
  vm.runInContext(rd('v4/gear-view.js'), ctx);
  return B;
}
const fish = o => Object.assign({ id: 'b1', date: '2026-11-20', time: '06:10', tz: 120, lat: 34.71, lon: 32.42, species: 'Φαγκρί', latin: 'Pagrus pagrus' }, o);

test('gearTag writes the explicit gear type (gt) on a catch logged while hauling, and keeps the tech the user already chose', () => {
  const B = app({ gear: [{ id: 'g1', type: 'net', name: 'Δίχτυ 1', state: 'hauling', set: {}, haul: {} }] });
  const r = B.gearTag({ id: 'b1', tech: 'Spinning' });
  assert.equal(r.gear, 'g1'); assert.equal(r.gt, 'net');
  assert.equal(r.tech, 'Spinning', 'the user\'s own record is not rewritten');
  const r2 = B.gearTag({ id: 'b2' }); assert.equal(r2.tech, 'Δίχτυ', 'empty tech still gets the gear name, as before');
  assert.equal(B.gearTag({ id: 'b3', miss: true }).gear, undefined, 'a lost fish is not tied to the gear');
});

test('the contribution sends the gear type as tech, so the server keeps it out of «when they bite» — in Greek and in English, for all three gear types', () => {
  for (const en of [false, true]) for (const type of ['net', 'll', 'trap']) {
    const B = app({ en });
    const row = B.contrib._rowOf('b', fish({ tech: 'Spinning', gear: 'g9', gt: type }));
    assert.ok(serverPassive(row), `${en ? 'EN' : 'EL'} ${type}: sent tech «${row.tech}» must be passive for the server`);
    assert.equal(row.kind, 'catch'); assert.equal(row.sp, 'pagrus pagrus');
  }
});

test('older catches without gt: the type comes from the gear item itself', () => {
  const B = app({ gear: [{ id: 'g7', type: 'trap', name: 'Ζεμπίλι 1', state: 'done', set: {}, haul: {} }] });
  const row = B.contrib._rowOf('b', fish({ tech: 'Ψάρεμα', gear: 'g7' }));
  assert.equal(row.tech, 'Ζεμπίλι / παγίδα'); assert.ok(serverPassive(row));
});

test('nothing changes for rod catches, or when the gear type cannot be found (the user\'s tech is sent as before)', () => {
  const B = app();
  assert.equal(B.contrib._rowOf('b', fish({ tech: 'Spinning' })).tech, 'Spinning');
  assert.equal(B.contrib._rowOf('b', fish({})).tech, null);
  const lost = B.contrib._rowOf('b', fish({ tech: 'Spinning', gear: 'gone' }));
  assert.equal(lost.tech, 'Spinning', 'unknown gear: no guessing');
  assert.equal(serverPassive(lost), false);
});

test('regression guard: without the fix, the same catch would have been counted as a bite', () => {
  const B = app();
  const before = { ...B.contrib._rowOf('b', fish({ tech: 'Spinning', gear: 'g9', gt: 'net' })), tech: 'Spinning' };   // ό,τι έστελνε το παλιό rowOf
  assert.equal(serverPassive(before), false);
});

test('«Worked» display filter: the same passive techniques as the server — traps included (they were missing)', () => {
  const C = rd('v4/contrib.js'), re = new RegExp(C.match(/var PASSIVE_RE=\/(.+)\/i;/)[1], 'i');
  for (const t of PASSIVE) assert.ok(re.test(t), `«${t}» must be hidden from «Worked»`);
  for (const t of ['Ζεμπίλι / παγίδα', 'Trap / pot', 'Δίχτυ', 'Longline']) assert.ok(re.test(t));
  for (const t of ['Spinning', 'Jigging', 'Ψάρεμα με καλάμι', 'Τρολινγκ']) assert.equal(re.test(t), false, `«${t}» is a rod technique`);
  assert.match(C, /x\.w\.tech\|\|\[\]\)\.filter\(function\(t\)\{ return !PASSIVE_RE\.test/, 'the filter uses PASSIVE_RE');
});
