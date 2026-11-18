// P0.6 χρονοπρογραμματιστής (τελευταία επιτυχής εκτέλεση, όχι ακριβές λεπτό) και P0.7 παλμός native GPS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDue, heartbeat } from '../../safety-job.mjs';

const T0 = Date.parse('2026-11-18T10:00:00Z'), MIN = 60e3;

test('isDue: never run → due', () => { assert.equal(isDue(null, T0, 15 * MIN), true); assert.equal(isDue('garbage', T0, 15 * MIN), true); });
test('isDue: ran 5 minutes ago → not due; 14+ minutes → due (60 s slack)', () => {
  assert.equal(isDue(new Date(T0 - 5 * MIN).toISOString(), T0, 15 * MIN), false);
  assert.equal(isDue(new Date(T0 - 14 * MIN).toISOString(), T0, 15 * MIN), true);
});
test('isDue: a delayed or skipped cron still runs the step at the next run (no exact-minute dependency)', () => {
  // cron αργεί: εκτελέσεις στα :03, :11, :27 (χάθηκε το :19) — το βήμα τρέχει στο :03 και ξανά στο :27
  let last = null; const ran = [];
  for (const m of [3, 11, 27, 32, 44]) { const now = T0 + m * MIN; if (isDue(last, now, 15 * MIN)) { ran.push(m); last = new Date(now).toISOString(); } }
  assert.deepEqual(ran, [3, 27, 44]);
  // παλιά λογική (λεπτό % 15 < 5) θα έτρεχε μόνο στο :03 και στο :32 — και θα έχανε τελείως ένα παράθυρο αν ο cron έπεφτε μόνο σε :06–:14
  const old = [6, 11, 22, 27, 37, 41].filter(m => m % 15 < 5); assert.deepEqual(old, []);
  let last2 = null, ran2 = 0; for (const m of [6, 11, 22, 27, 37, 41]) { const now = T0 + m * MIN; if (isDue(last2, now, 15 * MIN)) { ran2++; last2 = new Date(now).toISOString(); } }
  assert.ok(ran2 >= 2, 'with the new logic it still runs');
});
test('isDue: a timestamp far in the future does not block forever', () => { assert.equal(isDue(new Date(T0 + 3600e3).toISOString(), T0, 15 * MIN), true); });

/* ---------- παλμός ---------- */
function fakeDb(rows) {
  const calls = [];
  const F = async (url, opt = {}) => { const m = opt.method || 'GET'; calls.push({ m, url, body: opt.body });
    const u = new URL(url), id = decodeURIComponent((u.searchParams.get('id') || '').replace(/^eq\./, '')), key = (u.searchParams.get('hb_key') || '').replace(/^eq\./, '');
    const row = rows.find(r => r.id === id && r.hb_key === key && (m !== 'GET' || ['active', 'alerted'].includes(r.status)));
    if (m === 'GET') return { ok: true, status: 200, json: async () => row ? [{ id: row.id, hb_at: row.hb_at || null }] : [] };
    if (m === 'PATCH') { if (row) Object.assign(row, JSON.parse(opt.body)); return { ok: true, status: 204, json: async () => ({}) }; }
    return { ok: false, status: 405 }; };
  return { F, calls };
}
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'svc' };
const KEY = 'a'.repeat(48);

test('heartbeat updates position, time and battery of the active trip with the right key', async () => {
  const rows = [{ id: 'trip-1', hb_key: KEY, status: 'active' }]; const d = fakeDb(rows);
  const r = await heartbeat({ env, fetch: d.F, now: T0 }, { id: 'trip-1', key: KEY, lat: 34.6812345, lon: 32.912345, battery: 41 });
  assert.equal(r.status, 200);
  assert.equal(rows[0].last_lat, 34.68123); assert.equal(rows[0].battery, 41); assert.equal(rows[0].hb_src, 'native');
  assert.equal(rows[0].hb_at, new Date(T0).toISOString());
});
test('heartbeat with a wrong key or for an ended trip does nothing', async () => {
  const rows = [{ id: 'trip-1', hb_key: KEY, status: 'active' }, { id: 'trip-2', hb_key: KEY, status: 'done' }]; const d = fakeDb(rows);
  assert.equal((await heartbeat({ env, fetch: d.F, now: T0 }, { id: 'trip-1', key: 'b'.repeat(48), lat: 1, lon: 1 })).status, 404);
  assert.equal((await heartbeat({ env, fetch: d.F, now: T0 }, { id: 'trip-2', key: KEY, lat: 1, lon: 1 })).status, 404);
  assert.equal(rows[0].hb_at, undefined); assert.ok(!d.calls.some(c => c.m === 'PATCH'));
});
test('heartbeat rejects malformed input before touching the database', async () => {
  const d = fakeDb([]);
  for (const b of [{}, { id: 'x', key: KEY }, { id: 'trip-1', key: 'short' }, { id: 'trip 1;drop', key: KEY }, { id: 'trip-1', key: 'Z'.repeat(48) }])
    assert.equal((await heartbeat({ env, fetch: d.F, now: T0 }, b)).status, 400, JSON.stringify(b));
  assert.equal(d.calls.length, 0);
});
test('heartbeat without a GPS fix still records the time (stationary / no fix) and ignores bad coordinates', async () => {
  const rows = [{ id: 'trip-1', hb_key: KEY, status: 'active', last_lat: 34, last_lon: 32 }]; const d = fakeDb(rows);
  await heartbeat({ env, fetch: d.F, now: T0 }, { id: 'trip-1', key: KEY, lat: 0, lon: 0 });
  assert.equal(rows[0].hb_at, new Date(T0).toISOString()); assert.equal(rows[0].last_lat, 34);
});
test('heartbeats closer than 20 s are ignored (no write storm)', async () => {
  const rows = [{ id: 'trip-1', hb_key: KEY, status: 'active', hb_at: new Date(T0 - 5e3).toISOString() }]; const d = fakeDb(rows);
  const r = await heartbeat({ env, fetch: d.F, now: T0 }, { id: 'trip-1', key: KEY, lat: 34, lon: 32 });
  assert.equal(r.body.skipped, 'rate'); assert.ok(!d.calls.some(c => c.m === 'PATCH'));
});
