/* 28/11/2026 · λίστα «Ειδοποίησέ με»: email καλωσορίσματος + email στον διαχειριστή (Resend), μία φορά ανά εγγραφή. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';
const { waitlistStep, waitlistMails, WL_ADMIN, WL_FROM } = await import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href);

function world(rows, failFor = new Set()) {
  const db = rows.map(r => ({ welcomed_at: null, mail_tries: 0, ...r })), sent = [];
  const sb = async (p, opt = {}) => {
    if (!opt.method) return db.filter(r => r.welcomed_at == null && r.mail_tries < 3).map(r => ({ ...r }));
    const id = +(/id=eq\.(\d+)/.exec(p) || [])[1], r = db.find(x => x.id === id), b = JSON.parse(opt.body);
    if (/welcomed_at=is\.null/.test(p)) { if (r.welcomed_at != null) return []; Object.assign(r, b); return [r]; }
    Object.assign(r, b); return null;
  };
  const F = async (url, o) => { const m = JSON.parse(o.body); sent.push(m);
    const bad = m.to.some(t => failFor.has(t)); return { ok: !bad, status: bad ? 422 : 200, text: async () => 'bad', json: async () => ({ id: 'x' }) }; };
  return { db, sent, sb, F };
}

test('νέα εγγραφή → καλωσόρισμα (στη γλώσσα της) + email στον διαχειριστή, και μετά τίποτα', async () => {
  const w = world([{ id: 1, email: 'a@b.co', lang: 'el', created_at: '2026-11-27T22:42:00Z' }]);
  const r = await waitlistStep({ sb: w.sb, F: w.F, key: 'k' });
  assert.deepEqual(r, { sent: 1, failed: 0, admin: 1 });
  assert.equal(w.sent[0].to[0], 'a@b.co'); assert.match(w.sent[0].subject, /Είσαι στη λίστα/); assert.equal(w.sent[0].from, WL_FROM);
  assert.equal(w.sent[0].reply_to, WL_ADMIN); assert.ok(w.sent[0].headers['List-Unsubscribe']);
  assert.equal(w.sent[1].to[0], WL_ADMIN); assert.match(w.sent[1].text, /a@b\.co/);
  assert.ok(w.db[0].welcomed_at);
  const again = await waitlistStep({ sb: w.sb, F: w.F, key: 'k' });
  assert.deepEqual(again, { sent: 0, failed: 0, admin: 0 }); assert.equal(w.sent.length, 2);
});

test('αγγλικά για lang en', () => { const m = waitlistMails({ email: 'x@y.co', lang: 'en' }); assert.match(m.welcome.subject, /You’re on the Alkyon list/); assert.match(m.welcome.html, /alkyonfishing\.com/); });

test('το email του επισκέπτη μπαίνει escaped στο HTML (κανένα markup από τη φόρμα)', () => {
  const m = waitlistMails({ email: '<b>x</b>@y.co', lang: 'en' }); assert.ok(!m.welcome.html.includes('<b>x</b>')); });

test('γραμμή που την «κλείδωσε» άλλη εκτέλεση δεν στέλνεται δεύτερη φορά', async () => {
  const w = world([{ id: 1, email: 'a@b.co', lang: 'en' }]);
  const sb0 = w.sb; let first = true;
  const sb = async (p, o) => { const res = await sb0(p, o); if (!o || !o.method) { if (first) { first = false; w.db[0].welcomed_at = 'other'; } } return res; };
  const r = await waitlistStep({ sb, F: w.F, key: 'k' });
  assert.deepEqual(r, { sent: 0, failed: 0, admin: 0 }); assert.equal(w.sent.length, 0);
});

test('αποτυχία → ξανά στην επόμενη εκτέλεση· μετά από 3 σταματά και ενημερώνει τον διαχειριστή μία φορά', async () => {
  const w = world([{ id: 1, email: 'bad@b.co', lang: 'en' }], new Set(['bad@b.co']));
  for (let i = 1; i <= 3; i++) await waitlistStep({ sb: w.sb, F: w.F, key: 'k' });
  assert.equal(w.db[0].mail_tries, 3);
  const adm = w.sent.filter(m => m.to[0] === WL_ADMIN);
  assert.equal(adm.length, 1); assert.match(adm[0].subject, /χωρίς καλωσόρισμα/);
  const n = w.sent.length; await waitlistStep({ sb: w.sb, F: w.F, key: 'k' }); assert.equal(w.sent.length, n);
});
