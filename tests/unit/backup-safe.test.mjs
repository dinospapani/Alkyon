/* 21/11/2026 · Επαναφορά αντιγράφου: η τρέχουσα έξοδος δεν πειράζεται.
   Το «alkyon-safe» κρατά μαζί την επαφή ασφαλείας και την έξοδο που τρέχει. Το B.backup.apply (tackle-core.js) το έγραφε ολόκληρο από πάνω:
   χανόταν η ενεργή έξοδος (id, κλειδί παλμού, ώρα επιστροφής) ή ξαναζωντάνευε η έξοδος που έτρεχε τη στιγμή του αντιγράφου.
   Τρέχει το πραγματικό v4/tackle-core.js σε vm. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

function app(initial) {
  const store = Object.assign({}, initial), noop = () => {};
  const B = { h: noop, T: el => el, EN: false, ls: { get: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d), set: (k, v) => { store[k] = v; } },
    store: { raw: () => [], restoreRec: () => 'same', phKeys: () => [], Photos: { put: async () => {} } } };
  const ctx = { window: { AK: B }, console, FileReader: function () {}, fetch: async () => ({ blob: async () => null }) };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'v4/tackle-core.js'), 'utf8'), ctx);
  return { B, store };
}
const OLD_TRIP = { active: true, id: 'trip-old', hbk: 'a'.repeat(48), due: 1, start: 1, route: 'παλιά', name: 'Μαρία', phone: '+357 99 000000', tgCode: 'TGOLD', tgLinked: true };
const NOW_TRIP = { active: true, id: 'trip-now', hbk: 'b'.repeat(48), due: 9e12, start: 5, route: 'τώρα', last: { lat: 34.7, lon: 32.4, t: 5 }, synced: true };

test('restoring a backup while a trip is running keeps that trip exactly as it is, and brings back the safety contact', async () => {
  const { B, store } = app({ 'alkyon-safe': NOW_TRIP });
  await B.backup.apply({ app: 'alkyon', settings: { 'alkyon-safe': OLD_TRIP } });
  const s = store['alkyon-safe'];
  for (const k of ['active', 'id', 'hbk', 'due', 'start', 'route', 'last', 'synced']) assert.deepEqual(s[k], NOW_TRIP[k], `trip field ${k} untouched`);
  assert.equal(s.name, 'Μαρία'); assert.equal(s.phone, '+357 99 000000'); assert.equal(s.tgCode, 'TGOLD'); assert.equal(s.tgLinked, true);
});

test('restoring with no trip running: the contact comes back, the backup\'s old trip does NOT come back to life', async () => {
  const { B, store } = app({});
  await B.backup.apply({ app: 'alkyon', settings: { 'alkyon-safe': OLD_TRIP } });
  const s = store['alkyon-safe'];
  assert.equal(s.active, undefined); assert.equal(s.id, undefined); assert.equal(s.hbk, undefined);
  assert.equal(s.name, 'Μαρία');
});

test('old «psaro-» keys and other settings are restored as before', async () => {
  const { B, store } = app({ 'alkyon-safe': NOW_TRIP });
  await B.backup.apply({ app: 'psarovarka', settings: { 'psaro-safe': OLD_TRIP, 'alkyon-units': { t: 'C' } } });
  assert.equal(store['alkyon-safe'].id, 'trip-now'); assert.equal(store['alkyon-safe'].name, 'Μαρία');
  assert.deepEqual(store['alkyon-units'], { t: 'C' });
});

test('an empty contact in the backup does not erase the contact on the phone', async () => {
  const { B, store } = app({ 'alkyon-safe': { name: 'Νίκος', email: 'x@example.com' } });
  await B.backup.apply({ app: 'alkyon', settings: { 'alkyon-safe': { name: '', email: null, active: true, id: 'trip-ghost' } } });
  assert.equal(store['alkyon-safe'].name, 'Νίκος'); assert.equal(store['alkyon-safe'].email, 'x@example.com'); assert.equal(store['alkyon-safe'].active, undefined);
});

test('the contact fields kept are exactly those the contact screen of trip.js writes', () => {
  const C = fs.readFileSync(path.join(ROOT, 'v4/tackle-core.js'), 'utf8'), TRIP = fs.readFileSync(path.join(ROOT, 'v4/trip.js'), 'utf8');
  const keep = JSON.parse(C.match(/var SAFE_KEEP=(\[[^\]]+\]);/)[1].replace(/'/g, '"'));
  for (const f of ['name', 'phone', 'email', 'tgCode', 'selfCode']) { assert.ok(keep.includes(f)); assert.match(TRIP, new RegExp('x\\.' + f + '=')); }
  for (const f of ['tgLinked', 'tgName', 'selfLinked']) { assert.ok(keep.includes(f)); assert.match(TRIP, new RegExp('d\\.' + f + '=')); }
  for (const f of ['active', 'id', 'hbk', 'due', 'start', 'sosAt', 'synced', 'noAlert']) assert.ok(!keep.includes(f), `${f} is trip state`);
});
