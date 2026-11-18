// P0.5: κωδικοί ρολογιού (λήξη, ανάκληση, όριο προσπαθειών) και bundle χωρίς λήψη κώδικα από το GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ROOT } from './harness.mjs';

let seq = 0;
async function load(file) {
  const tmp = path.join(ROOT, 'tests', 'unit', '.tmp-' + path.basename(file) + '-' + process.pid + '-' + (seq++) + '.mjs');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  try { return await import(pathToFileURL(tmp).href); } finally { fs.unlinkSync(tmp); }
}
process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';

/* ψεύτικος server για watch_links / watch_auth_fail με τους ίδιους κανόνες με το SQL */
function db(now) {
  const links = new Map(), fails = [], calls = [];
  const res = (o, st = 200) => ({ ok: st < 300, status: st, json: async () => o, text: async () => JSON.stringify(o) });
  const F = async (url, opt = {}) => { url = String(url); const m = opt.method || 'GET'; calls.push(m + ' ' + url); const u = new URL(url), q = u.searchParams;
    if (u.pathname.endsWith('/watch_auth_fail')) {
      if (m === 'POST') { for (const r of JSON.parse(opt.body)) fails.push(r); return res({}, 201); }
      const ip = q.get('ip').replace(/^eq\./, ''), since = Date.parse(q.get('at').replace(/^gt\./, ''));
      return res(fails.filter(f => f.ip === ip && Date.parse(f.at) > since).slice(0, +q.get('limit')));
    }
    if (u.pathname.endsWith('/watch_links')) {
      const code = q.get('code').replace(/^eq\./, ''), l = links.get(code);
      if (m === 'PATCH') { if (l) Object.assign(l, JSON.parse(opt.body)); return res({}, 204); }
      assert.equal(q.get('revoked_at'), 'is.null'); assert.ok(/expires_at\.gt\./.test(q.get('or')));
      const ok = l && !l.revoked_at && (!l.expires_at || Date.parse(l.expires_at) > now());
      return res(ok ? [{ user_id: l.user_id, lang: 'el', last_used_at: l.last_used_at || null }] : []);
    }
    return res([]); };
  return { links, fails, calls, F };
}

test('valid code → user; revoked or expired code → null', async () => {
  const W = await load('watch-index.ts'); let t = Date.parse('2026-11-18T10:00:00Z'); const d = db(() => t);
  d.links.set('ABCD2345', { user_id: 'u1', expires_at: new Date(t + 864e5).toISOString() });
  d.links.set('REVOKED1', { user_id: 'u1', revoked_at: new Date(t).toISOString(), expires_at: new Date(t + 864e5).toISOString() });
  d.links.set('EXPIRED1', { user_id: 'u1', expires_at: new Date(t - 1000).toISOString() });
  assert.deepEqual(await W.userOf(d.F, 'abcd 2345', t, '1.2.3.4'), { user_id: 'u1', lang: 'el' });
  assert.equal(await W.userOf(d.F, 'REVOKED1', t, '1.2.3.4'), null);
  assert.equal(await W.userOf(d.F, 'EXPIRED1', t, '1.2.3.4'), null);
});

test('each use extends the expiry (at most once an hour)', async () => {
  const W = await load('watch-index.ts'); let t = Date.parse('2026-11-18T10:00:00Z'); const d = db(() => t);
  d.links.set('ABCD2345', { user_id: 'u1', expires_at: new Date(t + 864e5).toISOString() });
  await W.userOf(d.F, 'ABCD2345', t, 'ip');
  await new Promise(r => setTimeout(r, 0));
  assert.ok(Date.parse(d.links.get('ABCD2345').expires_at) > t + 179 * 864e5, 'extended to ~180 days');
  const patches = () => d.calls.filter(c => c.startsWith('PATCH')).length;
  t += 120e3; await W.userOf(d.F, 'ABCD2345', t, 'ip'); await new Promise(r => setTimeout(r, 0));
  assert.equal(patches(), 1, 'no second PATCH within an hour');
});

test('disconnect (revoked) takes effect within the 60 s cache', async () => {
  const W = await load('watch-index.ts'); let t = Date.parse('2026-11-18T10:00:00Z'); const d = db(() => t);
  d.links.set('ABCD2345', { user_id: 'u1', expires_at: new Date(t + 864e5).toISOString() });
  assert.ok(await W.userOf(d.F, 'ABCD2345', t, 'ip'));
  d.links.delete('ABCD2345');
  t += 61e3; assert.equal(await W.userOf(d.F, 'ABCD2345', t, 'ip'), null);
});

test('rate limit: 20 wrong codes from one IP in 15 minutes → limited; other IPs unaffected', async () => {
  const W = await load('watch-index.ts'); let t = Date.parse('2026-11-18T10:00:00Z'); const d = db(() => t);
  d.links.set('GOODCODE', { user_id: 'u1', expires_at: new Date(t + 864e5).toISOString() });
  for (let i = 0; i < 20; i++) { assert.equal(await W.userOf(d.F, 'WRONG' + String(i).padStart(3, '0'), t, '6.6.6.6'), null); await new Promise(r => setTimeout(r, 0)); }
  assert.deepEqual(await W.userOf(d.F, 'GOODCODE', t, '6.6.6.6'), { limited: true }, 'even a correct code is refused while limited');
  assert.deepEqual(await W.userOf(d.F, 'GOODCODE', t, '7.7.7.7'), { user_id: 'u1', lang: 'el' });
  t += 16 * 60e3; assert.deepEqual(await W.userOf(d.F, 'GOODCODE', t, '6.6.6.6'), { user_id: 'u1', lang: 'el' }, 'limit lifts after 15 minutes');
});

test('POST with a wrong code from a limited IP returns 429', async () => {
  const W = await load('watch-index.ts'); const t = Date.parse('2026-11-18T10:00:00Z'); const d = db(() => t);
  for (let i = 0; i < 20; i++) d.fails.push({ ip: '6.6.6.6', at: new Date(t - 1000).toISOString() });
  const r = await W.handle(new Request('https://x/functions/v1/watch', { method: 'POST', headers: { 'x-forwarded-for': '6.6.6.6' }, body: JSON.stringify({ code: 'ANYCODE1', kind: 'fish' }) }), d.F, t);
  assert.equal(r.status, 429);
});

test('watch bundle: no runtime download of code, forecast.js inside', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'watch-index.ts'), 'utf8');
  assert.ok(!/raw\.githubusercontent\.com/.test(src), 'watch-index.ts must not fetch from GitHub');
  assert.ok(!/new Function\(/.test(src), 'no new Function()');
  const B = await load('watch-edge-index.ts');
  const PF = await B.loadPF(async () => { throw new Error('network not allowed'); });
  assert.equal(typeof PF.getForecast, 'function');
  assert.equal((await B.elNames())['dusky grouper'], 'Ροφός');
});

test('edge function files are in sync with their sources (build_edge.py --check)', () => {
  const out = execFileSync('python3', ['build_edge.py', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /^OK/);
});
