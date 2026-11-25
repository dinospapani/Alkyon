/* 25/11/2026 (1.14.98) · Ο παλμός γράφει την ώρα ΤΗΣ ΘΕΣΗΣ, όχι την ώρα του παλμού.
   Αιτία: Galaxy 25/11, μέσα σε κτίριο από τις 14:48· το κινητό ξανάστελνε την τελευταία θέση (έως 15′) και ο server την έγραφε
   με last_at = τώρα, άρα η επαφή / το SOS έβλεπαν θέση των 14:48 ως θέση των 15:01. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';

const { heartbeat } = await import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href + '?hbage');
const T0 = Date.parse('2026-11-25T15:01:25Z'), KEY = 'a'.repeat(48);
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'svc' };
function db(row) {
  const rows = [Object.assign({ id: 'trip-1', hb_key: KEY, status: 'active' }, row || {})];
  const F = async (url, opt = {}) => { const m = (opt.method || 'GET').toUpperCase(), r = rows[0];
    if (m === 'GET') return { ok: true, status: 200, json: async () => [{ id: r.id, hb_at: r.hb_at || null, last_at: r.last_at || null }] };
    if (m === 'PATCH') { Object.assign(r, JSON.parse(opt.body)); return { ok: true, status: 204, json: async () => ({}) }; }
    return { ok: false, status: 405 }; };
  return { rows, F };
}
const iso = ms => new Date(ms).toISOString();
const hb = (d, extra) => heartbeat({ env, fetch: d.F, now: T0 }, Object.assign({ id: 'trip-1', key: KEY, lat: 34.68, lon: 32.91, battery: 50 }, extra));

test('position time = time the fix was taken (now − age), heartbeat time = now', async () => {
  const d = db(); assert.equal((await hb(d, { age: 757 })).status, 200);
  assert.equal(d.rows[0].last_at, iso(T0 - 757000)); assert.equal(d.rows[0].hb_at, iso(T0)); assert.equal(d.rows[0].last_lat, 34.68);
});
test('older apps without age: exactly as before (position time = now)', async () => {
  const d = db(); await hb(d, {});
  assert.equal(d.rows[0].last_at, iso(T0)); assert.equal(d.rows[0].last_lat, 34.68);
});
test('invalid age (negative, text) counts as missing: as before', async () => {
  for (const age of [-5, 'abc', '']) { const d = db(); await hb(d, { age }); assert.equal(d.rows[0].last_at, iso(T0), String(age)); }
});
test('a fix older than 15 minutes is not written as position; the heartbeat still counts', async () => {
  const d = db({ last_lat: 1, last_lon: 2, last_at: iso(T0 - 3600e3) }); await hb(d, { age: 901 });
  assert.equal(d.rows[0].last_lat, 1); assert.equal(d.rows[0].last_at, iso(T0 - 3600e3)); assert.equal(d.rows[0].hb_at, iso(T0)); assert.equal(d.rows[0].battery, 50);
});
test('a newer position (e.g. from the open app) is never replaced by an older fix', async () => {
  const d = db({ last_lat: 1, last_lon: 2, last_at: iso(T0 - 30e3) }); await hb(d, { age: 600 });
  assert.equal(d.rows[0].last_lat, 1); assert.equal(d.rows[0].last_at, iso(T0 - 30e3)); assert.equal(d.rows[0].hb_at, iso(T0));
  const e = db({ last_lat: 1, last_lon: 2, last_at: iso(T0 - 900e3) }); await hb(e, { age: 60 });
  assert.equal(e.rows[0].last_lat, 34.68); assert.equal(e.rows[0].last_at, iso(T0 - 60e3));
});
test('a stored position time in the future (device clock ahead) does not block updates', async () => {
  const d = db({ last_lat: 1, last_lon: 2, last_at: iso(T0 + 3600e3) }); await hb(d, { age: 5 });
  assert.equal(d.rows[0].last_lat, 34.68); assert.equal(d.rows[0].last_at, iso(T0 - 5000));
});
test('Android and iPhone send the age of the fix with the position', () => {
  const j = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/com/alkyonfishing/app/AlkTripService.java'), 'utf8');
  assert.ok(j.includes('SystemClock.elapsedRealtimeNanos() - last.getElapsedRealtimeNanos()') && j.includes('b.put("age"') && j.includes('import android.os.SystemClock;'));
  const s = fs.readFileSync(path.join(ROOT, 'ios/App/App/AlkTripPlugin.swift'), 'utf8');
  assert.ok(/b\["age"\] = max\(0, Int\(Date\(\)\.timeIntervalSince\(l\.timestamp\)\.rounded\(\)\)\)/.test(s));
});
