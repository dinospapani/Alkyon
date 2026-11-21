/* 21/11/2026 · server: ο παλμός απαντά 404 «no active trip» ΜΟΝΟ όταν η βάση απάντησε ότι η έξοδος δεν υπάρχει.
   Σφάλμα ανάγνωσης (5xx, timeout, χαλασμένη απάντηση) → 5xx. Τρέχει το πραγματικό heartbeat() του safety-job.mjs
   και ο πραγματικός κανόνας των κινητών (AlkHbRule.java, μεταφρασμένος μηχανικά όπως στο v1495). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
import { heartbeat } from '../../safety-job.mjs';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'svc' }, KEY = 'b'.repeat(48), T0 = Date.parse('2026-11-21T18:00:00Z');
const call = get => heartbeat({ env, now: T0, fetch: async (u, o = {}) => (o.method === 'PATCH' ? { ok: true, status: 204 } : get()) }, { id: 'trip-9', key: KEY, lat: 34.7, lon: 32.4 });

test('database read errors → 5xx, never 404', async () => {
  for (const st of [500, 502, 503, 504, 401]) {
    const r = await call(() => ({ ok: false, status: st, json: async () => ({}) }));
    assert.equal(r.status, 503, `read ${st}`); assert.equal(r.body.error, 'read ' + st);
  }
  const bad = await call(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }));
  assert.equal(bad.status, 502);
  const shape = await call(() => ({ ok: true, status: 200, json: async () => ({ message: 'odd' }) }));
  assert.equal(shape.status, 502);
});

test('the database says the trip does not exist → still 404 «no active trip» (closed trip, never registered)', async () => {
  const r = await call(() => ({ ok: true, status: 200, json: async () => [] }));
  assert.equal(r.status, 404); assert.equal(r.body.error, 'no active trip');
});

test('a running trip still gets 200', async () => {
  const r = await call(() => ({ ok: true, status: 200, json: async () => [{ id: 'trip-9', hb_at: null }] }));
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
});

test('with the phones\' own rule, a burst of database errors never stops a recording the server already knows', async () => {
  /* ο κανόνας του Android, εκτελέσιμος: ίδιο σώμα με το AlkHbRule.next */
  const J = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/com/alkyonfishing/app/AlkHbRule.java'), 'utf8');
  assert.match(J, /if \(ours404\(code, body\)\)/); assert.match(J, /return new Step\(acked, n404, false\);/);
  const ours404 = (c, b) => c === 404 && b.includes('no active trip');
  const next = (acked, n, c, b) => (c >= 200 && c < 300) ? [true, 0, false] : ours404(c, b) ? (!acked ? [false, 0, false] : [true, n + 1, n + 1 >= 3]) : [acked, n, false];
  let st = [true, 0, false];
  for (let i = 0; i < 50; i++) { const r = await call(() => ({ ok: false, status: 503, json: async () => ({}) })); st = next(st[0], st[1], r.status, JSON.stringify(r.body)); assert.equal(st[2], false); }
  assert.equal(st[1], 0, '5xx is not counted as «no active trip»');
});
