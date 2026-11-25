/* 21/11/2026 · pushTrip: η έξοδος δεν στέλνεται ΠΟΤΕ χωρίς το κλειδί του παλμού λόγω σφάλματος δικτύου.
   Πριν: αν το πρώτο POST (με hb_key) αποτύγχανε για οποιονδήποτε λόγο, ξαναστελνόταν ΧΩΡΙΣ hb_key· ο server απέρριπτε μετά τον παλμό
   της υπηρεσίας του κινητού (hb_key δεν ταιριάζει) → πιθανή ψεύτικη ειδοποίηση σιωπής στην επαφή. Με κλειδωμένη οθόνη η JS δεν ξανάστελνε.
   Επιπλέον ένα δεύτερο σφάλμα δικτύου έκλεινε (extOK=false) για όλη τη συνεδρία μπαταρία / hb_at / silence_min.
   Τρέχει η πραγματική pushTrip του v4/trip.js με ψεύτικο server. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

const TRIP = fs.readFileSync(path.join(ROOT, 'v4/trip.js'), 'utf8');
function fn(src, name) { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(i, k + 1); } } }

/* server: answers in order from `plan` — 'ok', 'net' (fetch fails), 'col:<name>' (PGRST204 for that column), '500' */
function make(plan) {
  const sent = [], state = { active: true, id: 'trip-1', hbk: 'k'.repeat(48), due: Date.now() + 36e5, last: { lat: 34.7, lon: 32.4, t: Date.now() }, sil: 60 };
  const ls = { s: state }, load = () => ls.s, save = s => { ls.s = s; };
  const cl = { session: () => ({ name: 'D' }), rest: async (p, o) => { const body = JSON.parse(o.body); sent.push(body); const a = plan.shift() || 'ok';
    if (a === 'net') throw new TypeError('Failed to fetch');
    if (a.startsWith('col:')) throw new Error(`HTTP 400 {"code":"PGRST204","message":"Could not find the '${a.slice(4)}' column of 'safety_trips' in the schema cache"}`);
    if (a === '500') throw new Error('HTTP 500 boom'); return { ok: true }; } };
  const src = 'var extOK=true, srv=\'\'; var hbkOK=true;\n' + fn(TRIP, 'pushTrip') + '\nreturn {pushTrip, st:()=>({extOK, hbkOK})};';
  const M = new Function('load', 'save', 'Cl', 'T', 'battPct', 'fn', 'nativeSync', src)(load, save, () => cl, x => x, () => 80, async () => {}, () => {});
  return { M, sent, load };
}

test('a network error on the first send does NOT resend the trip without the heartbeat key; the trip stays «not synced» for a full retry', async () => {
  const { M, sent, load } = make(['net']);
  await M.pushTrip();
  assert.equal(sent.length, 1, 'no second POST without hb_key');
  assert.equal(sent[0].hb_key, 'k'.repeat(48));
  assert.equal(load().synced, false);
  assert.deepEqual(M.st(), { extOK: true, hbkOK: true }, 'nothing switched off for the session');
});

test('the retry after the network comes back sends the full row — key, battery, heartbeat time, silence', async () => {
  const { M, sent, load } = make(['net', 'ok']);
  await M.pushTrip(); await M.pushTrip();
  const last = sent.at(-1);
  assert.equal(last.hb_key, 'k'.repeat(48)); assert.equal(last.battery, 80); assert.ok(last.hb_at); assert.equal(last.silence_min, 60);
  assert.equal(load().synced, true);
});

test('a server error (5xx) behaves like a network error: no downgrade', async () => {
  const { M, sent } = make(['500']);
  await M.pushTrip();
  assert.equal(sent.length, 1); assert.deepEqual(M.st(), { extOK: true, hbkOK: true });
});

test('unchanged: an old server without the hb_key column → the row is sent without the key (and the key is skipped from then on)', async () => {
  const { M, sent, load } = make(['col:hb_key', 'ok', 'ok']);
  await M.pushTrip();
  assert.equal(sent.length, 2); assert.equal(sent[1].hb_key, undefined); assert.equal(sent[1].battery, 80);
  assert.equal(load().synced, true); assert.equal(M.st().hbkOK, false);
  await M.pushTrip(); assert.equal(sent.at(-1).hb_key, undefined);
});

test('unchanged: a server without battery/hb_at/silence_min columns → the basic row', async () => {
  const { M, sent, load } = make(['col:silence_min', 'col:silence_min', 'ok']);
  await M.pushTrip();
  assert.equal(sent.length, 3); assert.equal(sent[2].battery, undefined); assert.equal(sent[2].id, 'trip-1');
  assert.equal(load().synced, true); assert.equal(M.st().extOK, false);
});

test('regression guard: the old chain resent without the key after a network error', async () => {
  const old = TRIP.includes("hbkOK=false; /* μόνο αν λείπει η στήλη· όχι σε σφάλμα δικτύου */ return extOK?post(ext)");
  assert.equal(old, false, 'the old one-line fallback is gone');
  assert.match(fn(TRIP, 'pushTrip'), /if\(!schema\(e\)\) throw e;/);
});
