// 27/11/2026: η function «watch» στις ΗΠΑ (us-west-2): η κλήση καιρού στο Open-Meteo κάποιες φορές κολλούσε ως τα 12″ → 502.
// Τώρα: όριο 5″ ανά προσπάθεια + μία ξαναδοκιμή, και αν αποτύχουν και οι δύο, η τελευταία καλή πρόγνωση της θέσης (έως 6 ώρες).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';
import { loadNew, fakeMeteo } from './score-load.mjs';

const NOW = '2026-11-09T04:00:00Z';
process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
let seq = 0;
async function load() {
  const tmp = path.join(ROOT, 'tests', 'unit', '.tmp-om-' + process.pid + '-' + (seq++) + '.mjs');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(ROOT, 'watch-index.ts'), 'utf8'));
  try { return await import(pathToFileURL(tmp).href); } finally { fs.unlinkSync(tmp); }
}
/* κλήση που «κολλάει»: δεν απαντά ποτέ, παρά μόνο όταν ακυρωθεί */
const hang = (opt) => new Promise((_, rej) => { const s = opt && opt.signal; if (s) s.addEventListener('abort', () => rej(new Error('The signal has been aborted')), { once: true }); });
const res = (o, st = 200) => ({ ok: st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o) });

test('omFetch: first try hangs → aborted after its own limit, second try answers; total well under the 12 s outer limit', async () => {
  const W = await load(); W.OM_TRY_MS[0] = 60; W.OM_TRY_MS[1] = 60;
  let n = 0; const log = [];
  const F = async (url, opt) => { n++; if (n === 1) return hang(opt); return res({ ok: 1 }); };
  const t0 = Date.now(), r = await W.omFetch(F, (i, ms) => log.push(i))('https://api.open-meteo.com/v1/forecast?x', {});
  assert.equal(n, 2); assert.deepEqual(await r.json(), { ok: 1 }); assert.deepEqual(log, [1], 'the failed try is logged');
  assert.ok(Date.now() - t0 < 1000);
});

test('omFetch: both tries hang → throws (no endless retry); the outer abort stops it at once', async () => {
  const W = await load(); W.OM_TRY_MS[0] = 40; W.OM_TRY_MS[1] = 40;
  let n = 0; const F = async (url, opt) => { n++; return hang(opt); };
  await assert.rejects(W.omFetch(F)('https://marine-api.open-meteo.com/v1/marine?x', {})); assert.equal(n, 2);
  W.OM_TRY_MS[0] = 5000; W.OM_TRY_MS[1] = 5000; n = 0;
  const ac = new AbortController(), t0 = Date.now(), p = W.omFetch(F)('https://api.open-meteo.com/v1/forecast?x', { signal: ac.signal });
  setTimeout(() => ac.abort(), 30);
  await assert.rejects(p); assert.equal(n, 1, 'no second try after the outer limit'); assert.ok(Date.now() - t0 < 1000);
});

test('omFetch: every other call (database, EMODnet) passes through unchanged', async () => {
  const W = await load(); const seen = [];
  const F = async (url, opt) => { seen.push([url, opt]); return res([]); };
  const opt = { method: 'POST', headers: { a: 1 } };
  await W.omFetch(F)('https://x.supabase.co/rest/v1/watch_links?x', opt);
  await W.omFetch(F)('https://ows.emodnet-bathymetry.eu/wcs?x', opt);
  assert.equal(seen.length, 2); assert.strictEqual(seen[0][1], opt); assert.strictEqual(seen[1][1], opt);
});

test('watch GET: when the weather call fails, the last good forecast of the place is served (bg, 200); without one → 502 as before', async () => {
  const W = await load(); W.OM_TRY_MS[0] = 30; W.OM_TRY_MS[1] = 30;
  globalThis.__ALKYON_PF = loadNew({ now: NOW, storage: null }).PF;
  const M = fakeMeteo(51); let down = false;
  const F = async (url, opt = {}) => { url = String(url); if (url.includes('open-meteo')) return down ? hang(opt) : M(url); return res([]); };
  const get = (lat, t) => W.handle(new Request('https://x/functions/v1/watch?bg=1&lat=' + lat + '&lon=-123.16'), F, t);
  const t0 = Date.parse(NOW);
  const a = await get(44.09, t0); assert.equal(a.status, 200); const good = await a.json(); assert.equal(good.ok, 1);
  down = true;
  /* 31′ μετά: η κανονική μνήμη (30′) έληξε, ο καιρός κολλάει → η τελευταία καλή, χωρίς σφάλμα */
  const b = await get(44.09, t0 + 31 * 60e3); assert.equal(b.status, 200); assert.deepEqual(await b.json(), good);
  /* μετά από 6 ώρες δεν σερβίρεται πια παλιά πρόγνωση */
  const c = await get(44.09, t0 + 6 * 3600e3 + 60e3); assert.equal(c.status, 502);
  /* άλλη θέση χωρίς προηγούμενη καλή πρόγνωση → 502, όπως πριν */
  const d = await get(33.36, t0 + 31 * 60e3); assert.equal(d.status, 502); assert.equal((await d.json()).err, 'weather');
  delete globalThis.__ALKYON_PF;
});

test('watch bundle carries the retry and the stale fallback', () => {
  const src = fs.readFileSync(path.join(ROOT, 'watch-edge-index.ts'), 'utf8');
  assert.ok(src.includes('export function omFetch(F, log = null)') && src.includes("mem.fc.get('s:' + key)"));
});
