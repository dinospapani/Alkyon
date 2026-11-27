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

/* 27/11/2026: η function τρέχει πάντα δίπλα στη βάση (eu-west-1)· από άλλη περιοχή το αίτημα προωθείται εκεί */
const reqOf = (method = 'GET', body, hdr = {}) => new Request('https://edge.internal/watch?bg=1&lat=44.09&lon=-123.16&apikey=pk', { method, body, headers: { 'cf-connecting-ip': '75.1.2.3', ...(body ? { 'content-type': 'application/json' } : {}), ...hdr } });

test('regionProxy: in eu-west-1 (or with no region) the request runs locally, nothing is forwarded', async () => {
  const W = await load(); let n = 0; const F = async () => { n++; return res({}); };
  assert.equal(await W.regionProxy(reqOf(), F, 'eu-west-1'), null); assert.equal(await W.regionProxy(reqOf(), F, ''), null); assert.equal(n, 0);
  assert.equal(W.HOME_REGION, 'eu-west-1');
});

test('regionProxy: from us-west-2 a GET is forwarded to eu-west-1 with the watch IP signed, and the answer is passed back as is', async () => {
  const W = await load(); const seen = [];
  const F = async (url, opt) => { seen.push([url, opt]); return new Response('{"ok":1,"x":2}', { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=120' } }); };
  const r = await W.regionProxy(reqOf(), F, 'us-west-2');
  assert.equal(seen.length, 1); const [url, opt] = seen[0], u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://x.supabase.co/functions/v1/watch'); assert.equal(u.searchParams.get('forceFunctionRegion'), 'eu-west-1');
  assert.equal(u.searchParams.get('lat'), '44.09'); assert.equal(u.searchParams.get('bg'), '1'); assert.equal(u.searchParams.get('apikey'), 'pk');
  assert.equal(opt.headers['x-region'], 'eu-west-1'); assert.equal(opt.headers['x-alk-ip'], '75.1.2.3'); assert.match(opt.headers['x-alk-fwd'], /^[0-9a-f]{32}$/);
  assert.equal(r.status, 200); assert.equal(await r.text(), '{"ok":1,"x":2}'); assert.equal(r.headers.get('cache-control'), 'private, max-age=120'); assert.equal(r.headers.get('x-alk-via'), 'us-west-2');
  /* στην eu-west-1 το προωθημένο αίτημα δεν ξαναπροωθείται και η διεύθυνση είναι του ρολογιού */
  const fw = new Request(url, { headers: opt.headers });
  assert.equal(await W.regionProxy(fw, F, 'us-west-2'), null, 'never forwarded twice'); assert.equal(await W.ipOfReq(fw), '75.1.2.3');
});

test('ipOfReq: a forged forward header does not let a client choose its IP (wrong-code limit stays per watch)', async () => {
  const W = await load();
  assert.equal(await W.ipOfReq(reqOf('GET', undefined, { 'x-alk-fwd': 'f'.repeat(32), 'x-alk-ip': '9.9.9.9' })), '75.1.2.3');
  assert.equal(await W.ipOfReq(reqOf()), '75.1.2.3');
});

test('regionProxy: if eu-west-1 fails, a GET is served locally as before; a POST only if the forward failed fast (else 504, never written twice)', async () => {
  const W = await load(); let t = 0; const now = () => t;
  assert.equal(await W.regionProxy(reqOf(), async () => new Response('x', { status: 503 }), 'us-west-1', now), null, 'GET + 5xx → local');
  assert.equal(await W.regionProxy(reqOf(), async () => { throw new Error('net'); }, 'us-west-1', now), null, 'GET + error → local');
  const body = JSON.stringify({ code: 'ABC123', cid: 'c1' });
  assert.equal(await W.regionProxy(reqOf('POST', body), async () => { t += 100; throw new Error('net'); }, 'us-west-1', now), null, 'POST failed fast → local');
  const slow = await W.regionProxy(reqOf('POST', body), async () => { t += 11000; throw new Error('timeout'); }, 'us-west-1', now);
  assert.equal(slow.status, 504); assert.equal((await slow.json()).err, 'fwd');
  /* POST: το σώμα φτάνει ακέραιο, και μια απάντηση 5xx από την eu-west-1 περνά ως έχει (όχι δεύτερη εγγραφή τοπικά) */
  let got = null; const p5 = await W.regionProxy(reqOf('POST', body), async (url, opt) => { got = opt.body; return new Response('{"ok":0}', { status: 502 }); }, 'us-west-1', now);
  assert.equal(got, body); assert.equal(p5.status, 502);
});

test('handle(): outside eu-west-1 the watch request is forwarded (keys in headers too); in eu-west-1 it runs locally', async () => {
  const W = await load(); const seen = [];
  const F = async (url, opt) => { seen.push([String(url), opt]); return new Response('{"ok":1,"via":"eu"}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  const rq = () => new Request('https://edge.internal/watch?lat=44.09&lon=-123.16', { headers: { apikey: 'pk', authorization: 'Bearer pk', 'cf-connecting-ip': '75.1.2.3' } });
  process.env.SB_REGION = 'us-west-2';
  try { const r = await W.handle(rq(), F, Date.parse(NOW)); assert.deepEqual(await r.json(), { ok: 1, via: 'eu' }); }
  finally { delete process.env.SB_REGION; }
  assert.equal(seen.length, 1); assert.equal(seen[0][1].headers.apikey, 'pk'); assert.equal(seen[0][1].headers.authorization, 'Bearer pk');
  process.env.SB_REGION = 'eu-west-1';
  try { globalThis.__ALKYON_PF = loadNew({ now: NOW, storage: null }).PF; const M = fakeMeteo(51); seen.length = 0;
    const r = await W.handle(rq(), async (url, opt) => { seen.push(String(url)); return String(url).includes('open-meteo') ? M(String(url)) : res([]); }, Date.parse(NOW));
    assert.equal(r.status, 200); assert.ok(seen.every(u => !u.includes('/functions/v1/watch')), 'no forward from the home region');
  } finally { delete process.env.SB_REGION; delete globalThis.__ALKYON_PF; }
});
