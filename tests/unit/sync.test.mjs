// P0.1 σταδιακός συγχρονισμός και P0.2 επαναφορά αντιγράφου: το πραγματικό v4/store.js απέναντι σε ψεύτικο server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeServer, device } from './harness.mjs';

const seed = (srv, uid, n, kind = 'bites') => { for (let i = 0; i < n; i++) srv.upsert(uid, { kind, id: 'r' + String(i).padStart(5, '0'), data: { species: 'S' + i, _u: 1000 + i }, deleted: false }); };

test('2500 records with page size 1000 all arrive (server max_rows 1000)', async () => {
  const srv = new FakeServer({ maxRows: 1000 }); seed(srv, 'u1', 2500);
  const sizes = [], orig = srv.handle.bind(srv);
  srv.handle = (m, url, body) => { const r = orig(m, url, body); if (m === 'GET' && /\/records\?/.test(url)) sizes.push(r.json.length); return r; };
  const d = device(srv); await d.sync();
  assert.equal(d.state().err, false, d.state().msg);
  assert.equal(d.recs('bites').length, 2500);
  assert.deepEqual(sizes, [1000, 1000, 500, 0], 'pages of 1000, 1000, 500, then an empty page ends the pull');
  assert.equal(new Set(d.recs('bites').map(r => r.id)).size, 2500, 'no duplicates');
  assert.equal(srv.posts, 0, 'nothing to send back');
});

test('even if max_rows is smaller than the page, nothing is lost', async () => {
  const srv = new FakeServer({ maxRows: 300 }); seed(srv, 'u1', 2500);
  const d = device(srv); await d.sync();
  assert.equal(d.recs('bites').length, 2500);
});

test('records with identical updated_at across a page boundary are not skipped', async () => {
  const srv = new FakeServer({ maxRows: 1000 }); seed(srv, 'u1', 2500);
  const fixed = srv.list('u1')[0].updated_at; for (const r of srv.list('u1')) r.updated_at = fixed;   // όλα την ίδια στιγμή
  const d = device(srv); await d.sync();
  assert.equal(d.recs('bites').length, 2500);
});

test('incremental: second sync only fetches what changed', async () => {
  const srv = new FakeServer(); seed(srv, 'u1', 2500);
  const d = device(srv); await d.sync();
  srv.clock += 10 * 60e6; await d.sync();   // 10 λεπτά αργότερα: ο δείκτης «κάθεται» (μία επικάλυψη το πολύ)
  let before = srv.sentRows; await d.sync(); await d.sync();
  assert.equal(srv.sentRows - before, 0, 'idle syncs transfer no rows');
  before = srv.sentRows;
  srv.upsert('u1', { kind: 'bites', id: 'r00007', data: { species: 'changed', _u: 99999 }, deleted: false });
  await d.sync();
  assert.equal(d.rec('bites', 'r00007').species, 'changed');
  assert.ok(srv.sentRows - before <= 5, 'only the changed row (and the 2-minute overlap) was sent, got ' + (srv.sentRows - before));
});

test('deleted on the server → removed locally, with a tombstone', async () => {
  const srv = new FakeServer(); seed(srv, 'u1', 10);
  const d = device(srv); await d.sync();
  srv.upsert('u1', { kind: 'bites', id: 'r00003', data: { _u: 99999 }, deleted: true });
  await d.sync();
  assert.equal(d.rec('bites', 'r00003'), null);
  assert.ok(d.tombs().some(t => t.k === 'bites' && t.id === 'r00003'));
  assert.equal(d.recs('bites').length, 9);
});

test('newer server update beats an older local edit; newer local edit beats older server', async () => {
  const srv = new FakeServer(); seed(srv, 'u1', 3);
  const d = device(srv); await d.sync();
  // τοπική αλλαγή (βρώμικη) και νεότερη αλλαγή στον server από άλλη συσκευή
  const r1 = d.rec('bites', 'r00001'); d.store.save('bites', { ...r1, species: 'local' });
  const localU = d.rec('bites', 'r00001')._u;
  srv.upsert('u1', { kind: 'bites', id: 'r00001', data: { species: 'server-newer', _u: localU + 1000 }, deleted: false });
  // παλιότερη αλλαγή στον server για άλλη εγγραφή που έχουμε αλλάξει πιο πρόσφατα
  const r2 = d.rec('bites', 'r00002'); d.store.save('bites', { ...r2, species: 'local-newer' });
  await d.sync();
  assert.equal(d.rec('bites', 'r00001').species, 'server-newer');
  assert.equal(d.rec('bites', 'r00002').species, 'local-newer');
  assert.equal(srv.get('u1', 'bites', 'r00002').data.species, 'local-newer');
  assert.equal(srv.get('u1', 'bites', 'r00001').data.species, 'server-newer');
});

test('interrupted page: the next sync resumes and everything arrives', async () => {
  const srv = new FakeServer(); seed(srv, 'u1', 2500);
  srv.failGet = n => n === 2;   // η 2η σελίδα αποτυγχάνει
  const d = device(srv); await d.sync();
  assert.equal(d.state().err, true);
  assert.equal(d.recs('bites').length, 1000, 'the first page is kept');
  assert.ok(d.timers.some(t => t.ms >= 30000), 'a retry is scheduled');
  srv.failGet = null; await d.sync();
  assert.equal(d.state().err, false);
  assert.equal(d.recs('bites').length, 2500);
});

test('duplicate responses (overlap window) are idempotent', async () => {
  const srv = new FakeServer(); seed(srv, 'u1', 50);
  const d = device(srv); await d.sync();
  const snap = JSON.stringify(d.recs('bites'));
  await d.sync(); await d.sync();
  assert.equal(JSON.stringify(d.recs('bites')), snap);
  assert.equal(srv.posts, 0, 'nothing re-sent');
});

test('two devices: create, edit, delete propagate both ways', async () => {
  const srv = new FakeServer();
  const a = device(srv), b = device(srv);
  a.store.save('spots', { id: 's1', name: 'Reef' }); await a.sync();
  await b.sync(); assert.equal(b.rec('spots', 's1').name, 'Reef');
  b.store.save('spots', { ...b.rec('spots', 's1'), name: 'Reef 2' }); await b.sync();
  await a.sync(); assert.equal(a.rec('spots', 's1').name, 'Reef 2');
  a.store.remove('spots', 's1'); await a.sync();
  await b.sync(); assert.equal(b.rec('spots', 's1'), null);
  // και δεν ξαναζωντανεύει μετά από επόμενους συγχρονισμούς
  await a.sync(); await b.sync(); assert.equal(a.rec('spots', 's1'), null); assert.equal(b.rec('spots', 's1'), null);
});

test('sequential edits from a device whose clock is 2 hours behind still win', async () => {
  const srv = new FakeServer();
  const a = device(srv); a.store.save('spots', { id: 's1', name: 'A' }); await a.sync();
  const b = device(srv); await b.sync();
  const realNow = Date.now; Date.now = () => realNow() - 2 * 3600e3;   // το ρολόι της b πάει πίσω
  try { b.store.save('spots', { ...b.rec('spots', 's1'), name: 'B later' }); } finally { Date.now = realNow; }
  await b.sync(); await a.sync();
  assert.equal(a.rec('spots', 's1').name, 'B later');
});

test('old device pushing stale data is rejected by the server and takes the server version', async () => {
  const srv = new FakeServer(); seed(srv, 'u1', 1, 'spots');
  const old = device(srv); await old.sync();
  srv.upsert('u1', { kind: 'spots', id: 'r00000', data: { species: 'newest', _u: 5_000_000_000_000 }, deleted: false });   // νεότερη στον server
  // η παλιά συσκευή «χάνει» τον δείκτη (π.χ. καθάρισμα) και έχει τοπική βρώμικη παλιότερη έκδοση
  old.ls.set('alkyon-spots', [{ id: 'r00000', species: 'stale', _u: 2000 }]); old.ls.set('alkyon-sync-cur', null);
  await old.sync();
  assert.equal(srv.get('u1', 'spots', 'r00000').data.species, 'newest');
  assert.equal(old.rec('spots', 'r00000').species, 'newest');
});

/* ---------- P0.2 επαναφορά αντιγράφου ---------- */
test('backup A: record deleted after the backup stays deleted', async () => {
  const srv = new FakeServer();
  const d = device(srv); d.store.save('bites', { id: 'b1', species: 'Bass' }); await d.sync();
  const backup = { bites: JSON.parse(JSON.stringify(d.recs('bites'))) };
  d.store.remove('bites', 'b1'); await d.sync();
  const r = d.store.restoreRec('bites', backup.bites[0]);
  assert.equal(r, 'skip-deleted');
  await d.sync();
  assert.equal(d.rec('bites', 'b1'), null);
  assert.equal(srv.get('u1', 'bites', 'b1').deleted, true);
});

test('backup A2: deleted on another device, restored on a phone that has not synced the deletion yet', async () => {
  const srv = new FakeServer();
  const a = device(srv); a.store.save('bites', { id: 'b1', species: 'Bass' }); await a.sync();
  const backup = JSON.parse(JSON.stringify(a.recs('bites')));
  const b = device(srv); await b.sync(); b.store.remove('bites', 'b1'); await b.sync();
  const fresh = device(srv);   // νέο κινητό, χωρίς τίποτα: επαναφορά πριν τον πρώτο συγχρονισμό
  fresh.store.restoreRec('bites', backup[0]);
  await fresh.sync();
  assert.equal(fresh.rec('bites', 'b1'), null, 'server deletion wins');
  assert.equal(srv.get('u1', 'bites', 'b1').deleted, true);
});

test('backup B: older backup version does not beat a newer server version', async () => {
  const srv = new FakeServer();
  const a = device(srv); a.store.save('bites', { id: 'b1', species: 'v1' }); await a.sync();
  const backup = JSON.parse(JSON.stringify(a.recs('bites')));
  const other = device(srv); await other.sync(); other.store.save('bites', { ...other.rec('bites', 'b1'), species: 'v2' }); await other.sync();
  const fresh = device(srv); fresh.store.restoreRec('bites', backup[0]); await fresh.sync();
  assert.equal(srv.get('u1', 'bites', 'b1').data.species, 'v2');
  assert.equal(fresh.rec('bites', 'b1').species, 'v2');
});

test('backup C: older backup for a record updated later locally keeps the newer update', async () => {
  const srv = new FakeServer();
  const d = device(srv); d.store.save('bites', { id: 'b1', species: 'v1' }); await d.sync();
  const backup = JSON.parse(JSON.stringify(d.recs('bites')));
  d.store.save('bites', { ...d.rec('bites', 'b1'), species: 'v2' });
  assert.equal(d.store.restoreRec('bites', backup[0]), 'skip-newer');
  await d.sync();
  assert.equal(d.rec('bites', 'b1').species, 'v2');
  assert.equal(srv.get('u1', 'bites', 'b1').data.species, 'v2');
});

test('backup: a record missing everywhere is restored and uploaded with its original _u', async () => {
  const srv = new FakeServer();
  const d = device(srv);
  assert.equal(d.store.restoreRec('bites', { id: 'old1', species: 'Old', _u: 12345 }), 'restored');
  assert.equal(d.rec('bites', 'old1')._u, 12345);
  await d.sync();
  assert.equal(srv.get('u1', 'bites', 'old1').data.species, 'Old');
  assert.equal(d.store.restoreRec('bites', { species: 'no id' }), 'new');
});

test('switching account with "keep together" re-uploads everything to the new account', async () => {
  const srv = new FakeServer();
  const d = device(srv, { uid: 'u1' }); d.store.save('spots', { id: 's1', name: 'X' }); await d.sync();
  d.ls.set('alkyon-sess', { access_token: 't', refresh_token: 'r', exp: Date.now() + 3600e3, uid: 'u2', email: 'u2@x' });
  await d.cloud.ownerChoice('together');
  assert.equal(srv.list('u2').length, 1, 'the spot was uploaded to the new account');
  assert.equal(srv.get('u2', 'spots', 's1').data.name, 'X');
});

/* ---------- ευρήματα ανεξάρτητου ελέγχου (1.14.83) ---------- */
test('before the SQL migration (no trigger): full paged pull every time, nothing skipped even with skewed clocks', async () => {
  const srv = new FakeServer({ trigger: false }); seed(srv, 'u1', 1500);
  const a = device(srv); await a.sync(); assert.equal(a.recs('bites').length, 1500);
  // άλλη συσκευή με ρολόι 3 μέρες πίσω γράφει αλλαγή (updated_at του client «στο παρελθόν»)
  const b = device(srv); await b.sync();
  const realNow = Date.now; Date.now = () => realNow() - 3 * 864e5;
  try { b.store.save('bites', { ...b.rec('bites', 'r00010'), species: 'from-slow-clock' }); } finally { Date.now = realNow; }
  await b.sync();
  await a.sync();
  assert.equal(a.rec('bites', 'r00010').species, 'from-slow-clock', 'old-clock change still arrives (no cursor without the trigger)');
  assert.equal(a.ls.get('alkyon-sync-cur', null), null, 'no incremental cursor is stored without the trigger');
});

test('watch "undo" (same _u, deleted on the server) wins after upgrade instead of being resurrected', async () => {
  const srv = new FakeServer(); srv.upsert('u1', { kind: 'bites', id: 'w1', data: { species: 'x', _u: 5000 }, deleted: false });
  const d = device(srv);
  d.ls.set('alkyon-bites', [{ id: 'w1', species: 'x', _u: 5000 }]);   // κινητό από την παλιά έκδοση (χωρίς _su)
  srv.rows.get('u1|bites|w1').deleted = true;                        // το ρολόι έκανε «αναίρεση» χωρίς να αλλάξει το _u (παλιός server)
  srv.rows.get('u1|bites|w1').updated_at = srv.now();
  await d.sync();
  assert.equal(d.rec('bites', 'w1'), null);
  assert.equal(srv.get('u1', 'bites', 'w1').deleted, true, 'not resurrected on the server');
});

test('a user edit made while a rejected row is being re-fetched is not overwritten', async () => {
  const srv = new FakeServer(); const d = device(srv);
  d.store.save('spots', { id: 's1', name: 'mine' });
  const orig = srv.handle.bind(srv); let raced = false, edited = false;
  srv.handle = (m, url, body) => {
    if (m === 'POST' && /\/records/.test(url) && !raced) { raced = true; srv.upsert('u1', { kind: 'spots', id: 's1', data: { name: 'other device', _u: 9e12 }, deleted: false }); }   // άλλη συσκευή γράφει ταυτόχρονα
    const r = orig(m, url, body);
    if (m === 'GET' && /id=in\./.test(url) && !edited) { edited = true; const st = JSON.parse(d.mem.get('alkyon-spots')); st[0] = { ...st[0], name: 'user edit', _u: st[0]._u + 1 }; d.mem.set('alkyon-spots', JSON.stringify(st)); }
    return r; };
  await d.sync();
  assert.ok(raced && edited, 'the race was exercised');
  assert.equal(d.rec('spots', 's1').name, 'user edit', 'the edit made during the re-fetch is kept');
});

test('deleted gear (kind "gear" tombstone) is uploaded', async () => {
  const srv = new FakeServer(); srv.upsert('u1', { kind: 'gear', id: 'g1', data: { id: 'g1', _u: 1000 }, deleted: false });
  const d = device(srv); await d.sync();
  d.ls.set('alkyon-tomb', [...d.tombs(), { k: 'gear', id: 'g1', u: 2000 }]);
  await d.sync();
  assert.equal(srv.get('u1', 'gear', 'g1').deleted, true);
});

test('if writing to storage fails (quota), the cursor does not advance and the page is fetched again', async () => {
  const srv = new FakeServer(); seed(srv, 'u1', 300);
  const d = device(srv); d.quota.limit = 2000;    // πολύ μικρός χώρος: η πρώτη σελίδα δεν χωρά
  await d.sync();
  assert.equal(d.state().err, true);
  assert.equal(d.ls.get('alkyon-sync-cur', null), null, 'cursor not saved');
  d.quota.limit = Infinity; await d.sync();
  assert.equal(d.recs('bites').length, 300);
});

test('weekly full pull re-uploads records that disappeared from the server', async () => {
  const srv = new FakeServer(); const d = device(srv);
  d.store.save('spots', { id: 's1', name: 'Mine' }); await d.sync(); srv.clock += 10 * 60e6; await d.sync();   // ανέβηκε και υπάρχει δείκτης
  srv.rows.delete('u1|spots|s1');                                   // χάθηκε από τη βάση (π.χ. αποτυχημένη διαγραφή λογαριασμού)
  await d.sync(); assert.equal(srv.get('u1', 'spots', 's1'), undefined, 'incremental sync alone cannot see it');
  d.ls.set('alkyon-sync-full', { uid: 'u1', t: Date.now() - 8 * 864e5 });   // πέρασε μια εβδομάδα
  await d.sync(); await d.sync();
  assert.equal(srv.get('u1', 'spots', 's1').data.name, 'Mine');
});

test('settings changed on the phone are uploaded even when nothing new comes from the server', async () => {
  const srv = new FakeServer(); const d = device(srv); await d.sync();
  d.ls.set('alkyon-limits', { wind: 12 }); await d.sync();
  assert.deepEqual(srv.get('u1', 'settings', 'main').data['alkyon-limits'], { wind: 12 });
});
