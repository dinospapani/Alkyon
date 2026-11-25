/* 25/11/2026 · Το νυχτερινό job σβήνει τα ευρήματα που δεν ξαναϋπολόγισε (bite_stats, user_bite_stats).
   Πριν: ένα κλειδί που έπαυε να πληροί τα όρια έμενε για πάντα με τα παλιά νούμερα (λούτσος 21–24/11: «αυγή ×3,05» από ανασύρσεις).
   Τρέχει το πραγματικό safety-job.mjs (run) με ψεύτικη βάση, όπως το gear-findings.test.mjs. Ασφάλειες: ≥ 20 παρατηρήσεις,
   μόνο μετά από επιτυχή εγγραφή, ποτέ πάνω από τα μισά κλειδιά σε ένα βράδυ. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const RealDate = Date, NOW = RealDate.parse('2026-11-19T10:00:00Z'), HR = 3600000;

function build(nTrips = 60) { let s = 4242, id = 1; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; const rows = [], D0 = RealDate.parse('2026-10-20T00:00:00Z');
  for (let i = 0; i < nTrips; i++) { const u = 'u' + (i % 5), st = D0 + i * 11 * HR + 4 * HR, dur = 5 * HR, e = [];
    for (let t = st; t < st + dur; t += HR) e.push({ t, wind: 6 + (i % 3) * 4, gust: 10, wave: 0.3 + (i % 4) * 0.2, press: 1012 + (i % 5), pt: (i % 3) - 1, rain: 0, cloud: 30, temp: 22, sst: 23, tide: 0 });
    const day = new RealDate(st).toISOString().slice(0, 10), fish = rnd() < 0.6 ? 1 + Math.floor(rnd() * 2) : 0;
    rows.push({ id: id++, user_id: u, kind: 'trip', sp: null, day, ms: st, ms2: st + dur, lat: 34.7, lon: 32.4, cnt: fish, tech: null, prof: 'boat', cond: { e, k: 'l' } });
    for (let k = 0; k < fish; k++) { const ms = st + Math.floor(rnd() * dur);
      rows.push({ id: id++, user_id: u, kind: 'catch', sp: 'dentex dentex', day, ms, ms2: null, lat: 34.7, lon: 32.4, cnt: 1, tech: 'βυθού', prof: 'boat', cond: { e: e[Math.floor((ms - st) / HR)] || e[0], k: 'l' } }); } }
  return rows; }

async function job(rows, { haveKeys = [], haveUsers = [], persFail = false } = {}) {
  class FD extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } globalThis.Date = FD;
  try {
    const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', rd(f))(g);
    const { run } = await import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href + '?prune');
    const posts = {}, dels = [], logs = [], res = (o, stc = 200) => ({ ok: stc < 400, status: stc, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)), headers: new Map() });
    const F = async (url, opt = {}) => { url = String(url); const m = (opt.method || 'GET').toUpperCase();
      if (url.includes('/rest/v1/catch_obs') && m === 'GET') { const off = +(/offset=(\d+)/.exec(url) || [0, 0])[1]; return res(rows.slice(off, off + 1000)); }
      if (m === 'GET' && /\/rest\/v1\/bite_stats\?select=key$/.test(url)) return res(haveKeys.map(key => ({ key })));
      if (m === 'GET' && /\/rest\/v1\/user_bite_stats\?select=user_id$/.test(url)) return res(haveUsers.map(user_id => ({ user_id })));
      if (m === 'DELETE') { dels.push(decodeURIComponent(url)); return res(null, 204); }
      if (m === 'POST' && persFail && url.includes('/rest/v1/user_bite_stats')) return res({ message: 'boom' }, 500);
      if (m !== 'GET') { const t = /\/rest\/v1\/(\w+)/.exec(url); if (t && opt.body) { try { (posts[t[1]] = posts[t[1]] || []).push(JSON.parse(opt.body)); } catch (e) { } } return res(m === 'POST' && /rpc\//.test(url) ? [] : null, m === 'POST' ? 201 : 204); }
      if (url.includes('open-meteo')) return res({ error: true }, 500); return res([]); };
    await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: F, PF: g.PF, webpush: null, sendMail: null, log: x => logs.push(String(x)) });
    const written = (posts.bite_stats || []).flat().map(x => x.key), pers = (posts.user_bite_stats || []).flat().map(x => x.user_id);
    return { written, pers, dels, logs };
  } finally { globalThis.Date = RealDate; }
}
const inList = d => (/=in\.\((.*)\)$/.exec(d) || [, ''])[1];

test('keys that were not written tonight are deleted — only those (the stale barracuda case)', async () => {
  const first = await job(build());
  assert.ok(first.written.includes('all') && first.written.includes('sp:dentex dentex'));
  const stale = ['sp:sphyraena sphyraena', 'g:ceph|sp:sepia officinalis', 'trend:99_99'];
  const r = await job(build(), { haveKeys: [...first.written, ...stale] });
  const d = r.dels.filter(x => x.includes('/bite_stats?'));
  assert.equal(d.length, 1);
  for (const k of stale) assert.ok(inList(d[0]).includes('"' + k + '"'), k + ' deleted');
  for (const k of r.written) assert.ok(!inList(d[0]).includes('"' + k + '"'), k + ' kept');
});

test('personal findings of users who no longer qualify are deleted; not if the personal write failed', async () => {
  const first = await job(build());
  assert.ok(first.pers.length > 0);
  const r = await job(build(), { haveUsers: [...first.pers, 'gone-user'] });
  const d = r.dels.filter(x => x.includes('/user_bite_stats?'));
  assert.equal(d.length, 1); assert.equal(inList(d[0]), '"gone-user"');
  const f = await job(build(), { haveUsers: [...first.pers, 'gone-user'], persFail: true });
  assert.equal(f.dels.filter(x => x.includes('/user_bite_stats?')).length, 0, 'no prune after a failed write');
});

test('safety: an empty or tiny read of the database deletes nothing', async () => {
  const r = await job(build(2), { haveKeys: ['all', 'big', 'sp:dentex dentex', 'r:34_32'], haveUsers: ['u0', 'u1'] });
  assert.equal(r.dels.length, 0);
});

test('safety: never more than half of the keys in one night (logged instead)', async () => {
  const first = await job(build());
  const many = Array.from({ length: first.written.length + 5 }, (_, i) => 'sp:ghost ' + i);
  const r = await job(build(), { haveKeys: [...first.written, ...many] });
  assert.equal(r.dels.filter(x => x.includes('/bite_stats?')).length, 0);
  assert.ok(r.logs.some(l => /bite_stats prune skipped/.test(l)));
});

test('nothing stale → no DELETE at all', async () => {
  const first = await job(build());
  const r = await job(build(), { haveKeys: first.written, haveUsers: first.pers });
  assert.equal(r.dels.length, 0);
});
