/* 25/11/2026 (A1 · S1) · Όρια χρόνου στο 5λεπτο job του server (quick-processor).
   Αιτία: 25/11 04:00 UTC μία εκτέλεση κόλλησε 150″ (HTTP 546, καμία γραμμή log) και χάθηκε ο κύκλος ελέγχου ασφαλείας.
   Ελέγχει: (1) κάθε αίτημα δικτύου κόβεται, (2) κάθε αποστολή push/email κόβεται, (3) ένα αίτημα που δεν απαντά ποτέ
   δεν κρατά το job, (4) όταν τελειώσει ο χρόνος παραλείπονται ΜΟΝΟ τα βήματα που δεν είναι ασφάλεια, (5) stats.ms στο log. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';

const mod = () => import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href + '?timeouts');
const res = (o, stc = 200) => ({ ok: stc < 400, status: stc, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)), headers: new Map() });
/* αίτημα που δεν απαντά ποτέ, εκτός αν κοπεί από το signal (όπως ένα κολλημένο TCP) */
const hang = opt => new Promise((_, rej) => { const s = opt && opt.signal; if (s) s.addEventListener('abort', () => rej(s.reason || new Error('aborted')), { once: true }); });
/* Το AbortSignal.timeout έχει timer που δεν κρατά ζωντανό το event loop (unref, σε Node και Deno). Στην παραγωγή το κρατά ανοιχτό
   το ίδιο το αίτημα δικτύου· εδώ το «κολλημένο» αίτημα είναι ψεύτικο, άρα το test κρατά το loop ζωντανό όσο τρέχει. */
const alive = async fn => { const k = setInterval(() => {}, 1000); try { return await fn(); } finally { clearInterval(k); } };
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k', TELEGRAM_BOT_TOKEN: 't' };

test('timedFetch: a request that never answers is aborted after the limit', async () => {
  const { timedFetch } = await mod();
  const t0 = Date.now();
  await alive(() => assert.rejects(timedFetch((u, o) => hang(o), 60)('https://api.telegram.org/x', {})));
  const el = Date.now() - t0; assert.ok(el >= 50 && el < 2000, 'aborted after ~60 ms, took ' + el);
});

test('timedFetch: a caller-supplied signal is kept, and normal answers pass through unchanged', async () => {
  const { timedFetch } = await mod();
  const ac = new AbortController(); let seen = null;
  await timedFetch(async (u, o) => { seen = o.signal; return res({ a: 1 }); }, 60)('u', { signal: ac.signal });
  assert.equal(seen, ac.signal);
  const r = await timedFetch(async (u, o) => { assert.ok(o.signal, 'timeout signal added'); assert.equal(o.method, 'POST'); return res({ ok: 1 }); }, 60)('u', { method: 'POST' });
  assert.deepEqual(await r.json(), { ok: 1 });
});

test('timedSend: a push/email that never returns is cut; a normal one returns its value; errors keep their statusCode', async () => {
  const { timedSend } = await mod();
  await assert.rejects(timedSend(() => new Promise(() => {}), 50, 'push')(), /push timeout 50ms/);
  assert.deepEqual(await timedSend(async (a, b) => ({ statusCode: 201, a, b }), 50)('x', 'y'), { statusCode: 201, a: 'x', b: 'y' });
  await assert.rejects(timedSend(async () => { const e = new Error('gone'); e.statusCode = 410; throw e; }, 50)(), e => e.statusCode === 410);

  /* push που απαντά με σφάλμα ΜΕΤΑ το όριο: καμία unhandled rejection (στο Deno θα έριχνε τη function) */
  const un = []; const h = e => un.push(e); process.on('unhandledRejection', h);
  try { await assert.rejects(timedSend(() => new Promise((_, rej) => setTimeout(() => rej(new Error('late')), 80)), 20)(), /timeout/);
    await new Promise(r => setTimeout(r, 150)); assert.deepEqual(un, []); } finally { process.off('unhandledRejection', h); }
});

test('run(): Telegram that never answers no longer holds the job; it finishes and logs stats.ms', async () => {
  const { run } = await mod(); const logs = [], urls = [];
  const F = async (url, opt = {}) => { url = String(url); urls.push(url);
    if (url.includes('api.telegram.org')) return hang(opt);
    return res((opt.method || 'GET').toUpperCase() === 'GET' ? [] : null, 200); };
  const t0 = Date.now();
  const r = await alive(() => run({ env: ENV, fetch: F, PF: null, webpush: null, sendMail: null, log: x => logs.push(String(x)), netMs: 80 }));
  const el = Date.now() - t0;
  assert.equal(r.ok, true); assert.ok(el < 10000, 'finished in ' + el + ' ms');
  assert.ok(urls.some(u => u.includes('api.telegram.org')), 'Telegram was called (and cut)');
  const line = logs.find(l => l.startsWith('Safety job: ')); assert.ok(line, 'final log line written');
  const st = JSON.parse(line.slice('Safety job: '.length));
  for (const k of ['safety', 'fc', 'press', 'comm', 'squid', 'tripwx', 'bstats', 'total']) assert.equal(typeof st.ms[k], 'number', 'ms.' + k);
});

test('run(): over budget → forecast, community, squid and bite stats are skipped; safety steps still run', async () => {
  const { run } = await mod(); const logs = [], urls = [];
  const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', fs.readFileSync(path.join(ROOT, f), 'utf8'))(g);
  const pushed = []; const webpush = { sendNotification: async (...a) => { pushed.push(a); return { statusCode: 201 }; } };
  const F = async (url, opt = {}) => { url = String(url); urls.push(url); return res((opt.method || 'GET').toUpperCase() === 'GET' ? [] : null, 200); };
  const r = await run({ env: ENV, fetch: F, PF: g.PF, webpush, sendMail: null, log: x => logs.push(String(x)), budgetMs: -1 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.stats.skip, ['fc', 'comm', 'squid', 'bstats']);
  assert.ok(logs.some(l => /^budget: fc παραλείφθηκε/.test(l)));
  assert.ok(urls.some(u => /\/rest\/v1\/safety_trips\?/.test(u)), 'safety steps queried safety_trips');
  assert.ok(!urls.some(u => /catch_obs/.test(u)), 'bite stats did not run');
  assert.ok(!urls.some(u => /push_subs\?.*checked_at/.test(u)), 'forecast push step did not run');
});

test('run(): within budget nothing is skipped (same behaviour as before)', async () => {
  const { run } = await mod(); const logs = [];
  const F = async (url, opt = {}) => res((opt.method || 'GET').toUpperCase() === 'GET' ? [] : null, 200);
  const r = await run({ env: ENV, fetch: F, PF: null, webpush: null, sendMail: null, log: x => logs.push(String(x)) });
  assert.equal(r.ok, true); assert.equal(r.stats.skip, undefined);
});
