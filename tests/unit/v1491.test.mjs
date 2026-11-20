/* 1.14.91: περιορισμοί (ProtectedSeas Navigator) · ειδικές ζώνες κατηγορίας 9 και διεύθυνση επικοινωνίας εκτός κώδικα */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wanted, makeClient } from '../../navigator-sync.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('category 9: national waters stay out, special no-fishing zones come in', () => {
  /* πραγματικές εγγραφές του καταλόγου (20/11/2026) */
  assert.equal(wanted({ country: 'Cyprus', category_id: 9, lfp: 1 }), false, 'Cyprus Territorial Seas (AICYP2)');
  assert.equal(wanted({ country: 'Greece', category_id: 9, lfp: 1 }), false, 'Greece Territorial Waters (AIGRC2)');
  assert.equal(wanted({ country: 'Lebanon', category_id: 9, lfp: 3 }), false, 'Lebanon Territorial Sea (AILBN2)');
  assert.equal(wanted({ country: 'Israel', category_id: 9, lfp: 2 }), false, 'Israel EEZ (AIISR1)');
  assert.equal(wanted({ country: 'Turkey', category_id: 9, lfp: 5 }), true, 'Foça naval restricted zone (AITUR62)');
  assert.equal(wanted({ country: 'Turkey', category_id: 9, lfp: 4 }), true, 'Aksaz Harbor (AITUR44)');
});
test('the rest of the filter is unchanged', () => {
  assert.equal(wanted({ country: 'Cyprus', category_id: 1, lfp: 3 }), true);
  assert.equal(wanted({ country: 'Cyprus', category_id: 1, lfp: 0 }), false);
  assert.equal(wanted({ country: 'Cyprus', category_id: 1, lfp: null }), false);
  assert.equal(wanted({ country: 'Turkey', category_id: 9, lfp: 0 }), false);
  assert.equal(wanted({ country: 'Italy', category_id: 1, lfp: 5 }), false);
  assert.equal(wanted(null), false);
});
test('the contact address comes from the environment, never from the code', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'navigator-sync.mjs'), 'utf8');
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(src), 'no e-mail address in navigator-sync.mjs');
  assert.match(src, /process\.env\.NAV_CONTACT/);
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'navigator-sync.yml'), 'utf8');
  assert.match(yml, /NAV_CONTACT: \$\{\{ secrets\.NAV_CONTACT \}\}/);
  let ua = null; const get = makeClient(async (u, o) => { ua = o.headers['User-Agent']; return { ok: true, json: async () => ({}) }; }, async () => {});
  await get('/x'); assert.match(ua, /^Alkyon-sync\/1\.0 \(fishing app/); assert.ok(!/@/.test(ua) || !!process.env.NAV_CONTACT);
});
test('a 429 answer is retried after a pause, and gives up after five retries', async () => {
  let n = 0; const naps = [];
  const get = makeClient(async () => { n++; return n <= 2 ? { ok: false, status: 429 } : { ok: true, status: 200, json: async () => ({ a: 1 }) }; }, async ms => { naps.push(ms); });
  assert.deepEqual(await get('/x'), { a: 1 }); assert.equal(n, 3); assert.equal(naps.filter(x => x === 12000).length, 2);
  let m = 0; const bad = makeClient(async () => { m++; return { ok: false, status: 429 }; }, async () => {});
  await assert.rejects(() => bad('/y'), /HTTP 429/); assert.equal(m, 6);
});
test('a dropped connection is retried like a 429', async () => {
  let n = 0; const get = makeClient(async () => { n++; if (n === 1) throw new TypeError('fetch failed'); return { ok: true, status: 200, json: async () => ({ b: 2 }) }; }, async () => {});
  assert.deepEqual(await get('/x'), { b: 2 }); assert.equal(n, 2);
  const dead = makeClient(async () => { throw new TypeError('fetch failed'); }, async () => {});
  await assert.rejects(() => dead('/y'), /fetch failed/);
});
test('a truncated (non-JSON) answer is retried', async () => {
  let n = 0; const get = makeClient(async () => { n++; return { ok: true, status: 200, json: async () => { if (n === 1) throw new SyntaxError('x'); return { c: 3 }; } }; }, async () => {});
  assert.deepEqual(await get('/x'), { c: 3 }); assert.equal(n, 2);
  const gone = makeClient(async () => ({ ok: false, status: 404 }), async () => {});
  await assert.rejects(() => gone('/y'), /HTTP 404/, 'other errors are not retried');
});
test('ids mode: only the named areas are fetched, the catalogue date stays', async () => {
  const { sync } = await import('../../navigator-sync.mjs'); const os = await import('node:os');
  const tmp = path.join(os.tmpdir(), 'nav-' + process.pid + '.json'); fs.copyFileSync(path.join(ROOT, 'navigator-mpa.json'), tmp);
  const before = JSON.parse(fs.readFileSync(tmp, 'utf8')); const urls = [];
  const sq = [[[26.70, 38.60], [26.72, 38.60], [26.72, 38.62], [26.70, 38.62], [26.70, 38.60]]];
  const site = { TESTZ1: { ps_id: 'TESTZ1', site_name: 'Naval zone', country: 'Turkey', category_id: 9, lfp: 5, recreational_fishing: 1, hook_and_line: 1, percent_marine_area: 100, site_boundary: { type: 'Polygon', coordinates: sq } },
    TESTW1: { ps_id: 'TESTW1', site_name: 'Territorial sea', country: 'Turkey', category_id: 9, lfp: 1, recreational_fishing: 2, site_boundary: { type: 'Polygon', coordinates: sq } } };
  const fetchFn = async u => { urls.push(u); const id = /ps_id=([^&]+)/.exec(u)[1]; return { ok: true, status: 200, json: async () => site[id] }; };
  const r = await sync({ file: tmp, fetchFn, sleep: async () => {}, log: () => {}, ids: ['TESTZ1', 'TESTW1'] });
  const after = JSON.parse(fs.readFileSync(tmp, 'utf8')); fs.unlinkSync(tmp);
  assert.equal(urls.length, 2); assert.ok(urls.every(u => /\/api\/detail\//.test(u)), 'no catalogue paging');
  assert.equal(r.add, 1); assert.equal(after.f.length, before.f.length + 1); assert.equal(after.v, before.v);
  const z = after.f.find(f => f.i === 'TESTZ1'); assert.equal(z.k, 9); assert.equal(z.l, 5); assert.equal(z.rf, 1);
  assert.ok(!after.f.some(f => f.i === 'TESTW1'), 'national waters stay out');
});
