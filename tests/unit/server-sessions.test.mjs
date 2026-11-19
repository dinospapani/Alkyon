// P1.2 · ο server μετρά τον έλεγχο της πρόγνωσης ΜΟΝΟ στις έγκυρες εξόδους (AlkyonScore.session), χωρίς να αλλάξει ο παλιός έλεγχος που ανοίγει/κλείνει τη μάθηση.
// Τρέχει ολόκληρο το run() του safety-job.mjs με ψεύτικη βάση: 60 έξοδοι, 20 ζωντανές (με και χωρίς ψάρια) και 40 παλιές με στρογγυλές ώρες και πάντα ψάρια (όπως οι «έξοδοι από τα ψάρια της ημέρας»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';
const dir = ROOT, RealDate = Date, NOW = RealDate.parse('2026-11-19T10:00:00Z');
class FD extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } globalThis.Date = FD;
const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', fs.readFileSync(path.join(dir, f), 'utf8'))(g);
const { run } = await import(pathToFileURL(path.join(dir, 'safety-job.mjs')).href);
let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const rows = [], HR = 3600000, D0 = RealDate.parse('2026-08-01T00:00:00Z'); let id = 1;
for (let i = 0; i < 60; i++) { const u = 'u' + (i % 6), legacy = i % 3 !== 0, st = D0 + i * 36 * HR + (legacy ? 5 * HR : 5 * HR + 1234 + i * 77), dur = (2 + Math.floor(rnd() * 4)) * HR + (legacy ? 0 : 4321), good = rnd() < 0.5;
  const fish = legacy ? 1 + Math.floor(rnd() * 5) : (rnd() < (good ? 0.6 : 0.25) ? 1 + Math.floor(rnd() * 4) : 0), e = [];
  for (let t = st; t < st + dur; t += HR) e.push({ t, wind: good ? 6 : 16, gust: good ? 9 : 22, wave: good ? 0.3 : 1.1, press: good ? 1012 : 1021, pt: good ? -1.5 : 0.5, rain: 0, cloud: 30, temp: 24, sst: 23, tide: good ? 0.05 : 0 });
  const day = new RealDate(st).toISOString().slice(0, 10), lat = 34.6 + rnd() * 0.3, lon = 32.9 + rnd() * 0.4;
  rows.push({ id: id++, user_id: u, kind: 'trip', sp: null, day, ms: st, ms2: st + dur, lat, lon, cnt: fish, tech: null, prof: 'boat', cond: { e, rt: null } });
  for (let k = 0; k < fish; k++) rows.push({ id: id++, user_id: u, kind: 'catch', sp: ['pagrus pagrus', 'dentex dentex', 'sparus aurata'][k % 3], day, ms: st + Math.floor(rnd() * dur), ms2: null, lat, lon, cnt: 1, tech: 'jig', prof: 'boat', cond: { wind: good ? 6 : 16, wave: good ? 0.3 : 1.1, pres: good ? 1012 : 1021, pt: good ? -1.5 : 0.5, cloud: 30, temp: 24, sst: 23 } }); }
const posts = {}, res = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)), headers: new Map() });
const F = async (url, opt = {}) => { url = String(url); const m = (opt.method || 'GET').toUpperCase();
  if (url.includes('/rest/v1/catch_obs') && m === 'GET') { const off = +(/offset=(\d+)/.exec(url) || [0, 0])[1]; return res(rows.slice(off, off + 1000)); }
  if (m !== 'GET') { const t = /\/rest\/v1\/(\w+)/.exec(url); if (t && opt.body) { try { (posts[t[1]] = posts[t[1]] || []).push(JSON.parse(opt.body)); } catch (e) { } } return res(m === 'POST' && /rpc\//.test(url) ? true : null); }
  if (url.includes('open-meteo')) return res({ error: true }, 500);
  return res([]); };
const logs = []; await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: F, PF: g.PF, webpush: null, sendMail: null, log: x => logs.push(String(x)) });
globalThis.Date = RealDate;
const all = (posts.bite_stats || []).flat().find(x => x.key === 'all'), pers = (posts.user_bite_stats || []).flat();

test('server stats: the kinds of trips are counted and stored (ses)', () => {
  assert.ok(all, 'stats were written: ' + logs.slice(-3).join(' | ')); assert.deepEqual(all.data.ses, { live: 20, unknown: 40 }); assert.equal(all.data.trips, 60);
});
test('server stats: the readiness meter counts valid trips, their users and those with fish (information only)', () => {
  const r = all.data.ready; assert.ok(r, 'ready is stored with the daily statistics'); assert.equal(r.trips, 20); assert.equal(r.users, 2); assert.ok(r.pos >= 1 && r.pos < 20, 'valid trips with fish: ' + r.pos);
  assert.deepEqual(r.need, { trips: 150, users: 10, pos: 30 }); assert.equal(r.open, false); assert.equal(r.missing.trips, 130);
});
test('server stats: "how right was the forecast" (acc) and the new check (btv) use the 20 valid trips only', () => {
  assert.equal(all.data.acc.trips, 20); assert.equal(all.data.btv.n, 20); assert.ok(all.data.btv.base >= 0 && all.data.btv.base <= 1 && all.data.btv.adj >= 0 && all.data.btv.adj <= 1);
  const hit = all.data.acc.hit.filter(x => x != null); assert.ok(hit.length && hit.every(x => x < 100), 'trips without fish are in the check: ' + JSON.stringify(all.data.acc.hit));
});
test('server stats: the legacy check that switches learning on/off still runs on all 60 trips (so no score changes)', () => {
  assert.equal(all.data.bt.n, 60); assert.equal(typeof all.data.bt.on, 'boolean');
  /* τιμές που έβγαζε ο server της 1.14.85 στα ίδια δεδομένα (σύγκριση παλιού/νέου κώδικα, 19/11/2026) */
  assert.deepEqual({ n: all.data.bt.n, base: all.data.bt.base, adj: all.data.bt.adj, on: all.data.bt.on }, { n: 60, base: 0.53, adj: 0.49, on: false });
});
test('server stats: a user with only unverifiable old trips gets no personal accuracy card instead of a flattering one', () => {
  assert.ok(pers.length >= 4);
  assert.equal(pers.filter(p => ['u1', 'u2', 'u4', 'u5'].includes(p.user_id)).every(p => !(p.data.by && p.data.by.sea && p.data.by.sea.data.acc)), true);
});
