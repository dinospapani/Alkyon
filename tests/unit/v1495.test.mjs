/* 1.14.95 · το 404 του παλμού δεν σταματά πια την καταγραφή εξόδου που ο server δεν γνωρίζει.
   Το σφάλμα (αποδείχθηκε σε Galaxy A56, 20/11/2026): με την «Ειδοποίηση της επαφής μου» κλειστή δεν δημιουργείται γραμμή safety_trips,
   ο πρώτος παλμός παίρνει 404 «no active trip», η υπηρεσία σταματούσε σε 0,12″ και η έξοδος έμενε χωρίς διαδρομή.
   Ο κανόνας εκτελείται πραγματικά στο JUnit (android/app/src/test/.../AlkHbRuleTest.java). Εδώ ελέγχεται:
   το συμβόλαιο με τον server, ότι Java και Swift γράφουν τον ΙΔΙΟ κανόνα, ότι το σταμάτημα περνά μόνο από αυτόν, και η πλευρά της εφαρμογής. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
import { heartbeat } from '../../safety-job.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const AND = 'android/app/src/main/java/com/alkyonfishing/app/';
const RULE = rd(AND + 'AlkHbRule.java'), SVC = rd(AND + 'AlkTripService.java'), PLG = rd(AND + 'AlkTripPlugin.java');
const SW = rd('ios/App/App/AlkTripPlugin.swift'), TRIP = rd('v4/trip.js'), JOB = rd('safety-job.mjs');

/* ---------- server: τι σημαίνει κάθε απάντηση ---------- */
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'svc' }, KEY = 'a'.repeat(48), T0 = Date.parse('2026-11-20T18:00:00Z');
function db(rows, readOk = true) {
  return async (url, opt = {}) => { const m = opt.method || 'GET', u = new URL(url);
    const id = decodeURIComponent((u.searchParams.get('id') || '').replace(/^eq\./, '')), key = (u.searchParams.get('hb_key') || '').replace(/^eq\./, '');
    const row = rows.find(r => r.id === id && r.hb_key === key && (m !== 'GET' || ['active', 'alerted'].includes(r.status)));
    if (m === 'GET') return readOk ? { ok: true, status: 200, json: async () => row ? [{ id: row.id, hb_at: row.hb_at || null }] : [] } : { ok: false, status: 503, json: async () => ({}) };
    if (row) Object.assign(row, JSON.parse(opt.body)); return { ok: true, status: 204, json: async () => ({}) }; };
}
const hb = (rows, id = 'trip-1', readOk = true) => heartbeat({ env, fetch: db(rows, readOk), now: T0 }, { id, key: KEY, lat: 34.7, lon: 32.4 });

test('server: a trip that was never registered answers 404 «no active trip» — the answer that used to stop the recording', async () => {
  const r = await hb([]);                                   // ειδοποίηση επαφής κλειστή / χωρίς λογαριασμό: καμία γραμμή
  assert.equal(r.status, 404); assert.equal(r.body.error, 'no active trip');
  const r2 = await hb([{ id: 'trip-1', hb_key: null, status: 'active' }]);   // γραμμή χωρίς κλειδί παλμού (η επανάληψη του pushTrip χωρίς hb_key)
  assert.equal(r2.status, 404); assert.equal(r2.body.error, 'no active trip');
});
test('server: the same trip answers 200 as soon as its row exists with the key — the phone must still be sending heartbeats to find out', async () => {
  const rows = []; assert.equal((await hb(rows)).status, 404);
  rows.push({ id: 'trip-1', hb_key: KEY, status: 'active' });
  const r = await hb(rows); assert.equal(r.status, 200); assert.equal(rows[0].hb_src, 'native');
});
test('server: an overdue trip (alerted) still accepts heartbeats; a closed one (done) answers 404', async () => {
  assert.equal((await hb([{ id: 'trip-1', hb_key: KEY, status: 'alerted' }])).status, 200);
  assert.equal((await hb([{ id: 'trip-1', hb_key: KEY, status: 'done' }])).status, 404);
});
/* 21/11/2026: ΑΛΛΑΓΗ TEST (δηλωμένη). Ήταν «known issue: σφάλμα ανάγνωσης της βάσης → 404». Ο server διορθώθηκε (branch server-hb-5xx):
   σφάλμα ανάγνωσης → 503. Το ίδιο το test έγραφε: «if this changes to a 5xx the server was fixed: update this test and the report, the phones need no change». */
test('server: a failed database read is answered 503, not 404 «no active trip» — a running trip is never told it does not exist', async () => {
  const r = await hb([{ id: 'trip-1', hb_key: KEY, status: 'active' }], 'trip-1', false);
  assert.equal(r.status, 503); assert.notEqual(r.body.error, 'no active trip');
});

/* ---------- ο κανόνας: ίδιος σε Java και Swift ---------- */
/* Ο κανόνας εκτελείται στο JUnit. Εδώ οι δύο υλοποιήσεις μεταφράζονται μηχανικά σε JS και συγκρίνονται σε ΟΛΕΣ τις καταστάσεις,
   ώστε μια αλλαγή μόνο στη μία πλατφόρμα να σπάει το test (η σουίτα δεν εκτελεί Swift). */
function javaRule() {
  const m = /static Step next\(boolean acked, int n404, int code, String body\) \{([\s\S]*?)\n    \}/.exec(RULE); assert.ok(m, 'Java next()');
  const o = /static boolean ours404\(int code, String body\) \{ return (.*?); \}/.exec(RULE); assert.ok(o, 'Java ours404()');
  const stop = +/static final int STOP_AFTER = (\d+);/.exec(RULE)[1], ours = /static final String OURS = "([^"]+)";/.exec(RULE)[1];
  const body = m[1].replace(/new Step\(([^)]*)\)/g, '[$1]').replace(/\bint n\b/g, 'const n');
  const ours404 = new Function('code', 'body', 'OURS', 'return ' + o[1].replace(/body\.contains\(/g, 'body.includes('));
  const next = new Function('acked', 'n404', 'code', 'body', 'ours404', 'STOP_AFTER', body);
  return { stop, ours, next: (a, n, c, b) => next(a, n, c, b, (c2, b2) => ours404(c2, b2, ours), stop), ours404: (c, b) => ours404(c, b, ours) };
}
function swiftRule() {
  const m = /static func next\(acked: Bool, n404: Int, code: Int, body: String\) -> \(acked: Bool, n404: Int, stop: Bool\) \{([\s\S]*?)\n    \}/.exec(SW); assert.ok(m, 'Swift next()');
  const o = /static func ours404\(_ code: Int, _ body: String\) -> Bool \{ return (.*?) \}/.exec(SW); assert.ok(o, 'Swift ours404()');
  const stop = +/static let stopAfter = (\d+)/.exec(SW)[1], ours = /static let ours = "([^"]+)"/.exec(SW)[1];
  const body = m[1].replace(/\bif (.+?) \{/g, 'if ($1) {').replace(/return \(([^)]*)\)/g, 'return [$1]').replace(/\blet n\b/g, 'const n');
  const ours404 = new Function('code', 'body', 'ours', 'return ' + o[1].replace(/body\.contains\(/g, 'body.includes('));
  const next = new Function('acked', 'n404', 'code', 'body', 'ours404', 'stopAfter', body);
  return { stop, ours, next: (a, n, c, b) => next(a, n, c, b, (c2, b2) => ours404(c2, b2, ours), stop), ours404: (c, b) => ours404(c, b, ours) };
}
const J = javaRule(), S = swiftRule();
const OURS = JSON.stringify({ ok: false, error: 'no active trip' }), BODIES = [OURS, '', '<html>404</html>', '{"code":"NOT_FOUND"}'], CODES = [0, -1, 200, 201, 204, 299, 300, 400, 401, 404, 429, 500, 502, 503];

test('one contract, three codebases: the server text, the Android rule and the iPhone rule name the same 404', () => {
  assert.ok(JOB.includes("error: 'no active trip'"), 'the server answers with this text');
  assert.equal(J.ours, 'no active trip'); assert.equal(S.ours, 'no active trip');
  assert.equal(J.stop, 3); assert.equal(S.stop, 3);
  assert.match(RULE, /MAX_UNACKED_MS = 24L \* 3600L \* 1000L;/); assert.match(SW, /static let maxUnacked: TimeInterval = 24 \* 3600\b/);
});
test('Android and iPhone decide identically in every state (acked × count × answer × body)', () => {
  let n = 0;
  for (const acked of [false, true]) for (const cnt of [0, 1, 2, 3, 7]) for (const code of CODES) for (const body of BODIES) {
    const a = Array.from(J.next(acked, cnt, code, body)), b = Array.from(S.next(acked, cnt, code, body));
    assert.deepEqual(b, a, `acked=${acked} n404=${cnt} code=${code} body=${body.slice(0, 20)}`); n++;
    assert.equal(S.ours404(code, body), J.ours404(code, body));
  }
  assert.equal(n, 2 * 5 * CODES.length * BODIES.length);
});
test('the rule itself, on the translated code: never-registered trips are never stopped; a registered one stops on the third consecutive own 404', () => {
  for (const R of [J, S]) {
    let st = [false, 0, false]; for (let i = 0; i < 200; i++) { st = R.next(st[0], st[1], 404, OURS); assert.equal(st[2], false); }
    assert.deepEqual(Array.from(st), [false, 0, false]);
    const seq = codes => { let s = [false, 0, false]; for (const c of codes) { s = R.next(s[0], s[1], c, c === 404 ? OURS : ''); if (s[2]) break; } return Array.from(s); };
    assert.deepEqual(seq([404, 404, 404, 200]), [true, 0, false], 'registered late: the first 200 acknowledges it');
    assert.equal(seq([200, 404, 404])[2], false); assert.equal(seq([200, 404, 404, 404])[2], true);
    assert.equal(seq([200, 404, 404, 200, 404, 404])[2], false, 'a 200 in between forgives stray 404s (momentary database error)');
    assert.equal(R.next(true, 2, 404, '<html>404</html>')[2], false, 'a 404 that is not ours never counts');
    for (const c of [0, 500, 502, 503]) assert.deepEqual(Array.from(R.next(true, 2, c, '')), [true, 2, false]);
  }
});

/* ---------- το σταμάτημα περνά μόνο από τον κανόνα ---------- */
test('Android: the service no longer stops on a bare 404; stopSelf after a heartbeat only when the rule says stop', () => {
  assert.ok(!/if \(code == 404\)[^\n]*stopSelf/.test(SVC), 'the old line is gone');
  const onHb = /private void onHb\(String sent, int code, String body\) \{([\s\S]*?)\n    \}/.exec(SVC); assert.ok(onHb, 'onHb');
  assert.match(onHb[1], /AlkHbRule\.Step s = AlkHbRule\.next\(acked, n404, code, body\);/);
  assert.match(onHb[1], /if \(s\.stop\) stopSelf\(\);/);
  assert.equal((onHb[1].match(/stopSelf\(\)/g) || []).length, 1);
  assert.match(onHb[1], /if \(!sent\.equals\(tripId\)\) return;/, 'an answer for a previous trip is ignored');
  /* όλα τα stopSelf του αρχείου: 3 στην εκκίνηση (χωρίς id / χωρίς άδεια / χωρίς GPS), 1 στο όριο των 24 ωρών, 1 στον κανόνα */
  const all = SVC.split('\n').filter(l => l.includes('stopSelf()')).map(l => l.trim());
  assert.equal(all.length, 5, all.join('\n'));
  assert.equal(all.filter(l => l.includes('START_NOT_STICKY')).length, 3);
  assert.ok(all.some(l => l.startsWith('if (AlkHbRule.expired(acked, born, System.currentTimeMillis())) { stopSelf(); return; }')));
  /* η απάντηση διαβάζεται και στο 404 (σώμα σφάλματος), και κάθε απάντηση φτάνει στον κανόνα — και το 200, που «αναγνωρίζει» την έξοδο */
  assert.match(SVC, /final String body = code == 404 \? readSmall\(c\.getErrorStream\(\)\) : "";/);
  assert.match(SVC, /hd\.post\(new Runnable\(\) \{ @Override public void run\(\) \{ onHb\(sent, code, body\); \} \}\);/);
});
test('Android: the rule state is kept per trip and survives a restart of the service; a new trip starts clean', () => {
  assert.match(SVC, /acked = p\.getBoolean\("ack:" \+ tripId, false\); n404 = p\.getInt\("n404:" \+ tripId, 0\); born = p\.getLong\("born:" \+ tripId, 0\);/);
  assert.match(SVC, /putBoolean\("ack:" \+ tripId, acked\)\.putInt\("n404:" \+ tripId, n404\)/);
  assert.match(SVC, /return START_REDELIVER_INTENT;/, 'the system may restart it — which is why the state is stored');
  assert.match(PLG, /\.remove\("ack:" \+ prev\)\.remove\("n404:" \+ prev\)\.remove\("born:" \+ prev\)/);
});
test('iPhone: the recording no longer stops on a bare 404; halt() only from the rule or the 24-hour net', () => {
  assert.ok(!/statusCode == 404 \{/.test(SW), 'the old branch is gone');
  const onHb = /private func onHb\(sent: String, code: Int, body: String\) \{([\s\S]*?)\n    \}/.exec(SW); assert.ok(onHb, 'onHb');
  assert.match(onHb[1], /let s = AlkHbRule\.next\(acked: acked, n404: n404, code: code, body: body\)/);
  assert.match(onHb[1], /if s\.stop \{ halt\(\) \}/);
  assert.match(onHb[1], /guard sent == tripId else \{ return \}/);
  const calls = SW.split('\n').filter(l => /\bhalt\(\)/.test(l) && !/private func halt/.test(l)).map(l => l.trim());
  assert.equal(calls.length, 2, calls.join('\n'));
  assert.ok(calls.some(l => l.startsWith('if AlkHbRule.expired(acked: acked, born: born, now: Date().timeIntervalSince1970) { halt(); return }')));
  /* το halt() κάνει ό,τι έκανε το παλιό 404: τίποτα παραπάνω, τίποτα λιγότερο */
  const halt = /private func halt\(\) \{([\s\S]*?)\n    \}/.exec(SW)[1];
  for (const k of ['lm.stopUpdatingLocation()', 'lm.allowsBackgroundLocationUpdates = false', 'running = false', 'ud.removeObject(forKey: "alkTrip.id")', 'ud.removeObject(forKey: "alkTrip.key")']) assert.ok(halt.includes(k), k);
  assert.match(SW, /self\.acked = ud\.bool\(forKey: "alkTrip\.ack\." \+ id\); self\.n404 = ud\.integer\(forKey: "alkTrip\.n404\." \+ id\)/);
  assert.match(SW, /removeObject\(forKey: "alkTrip\.ack\." \+ prev\)/);
});
test('both: the heartbeat itself is untouched — same payload, same rhythm — so a trip with an alert behaves exactly as before', () => {
  assert.match(SVC, /b\.put\("action", "hb"\); b\.put\("id", tripId\); b\.put\("key", key\);/);
  assert.match(SVC, /if \(System\.currentTimeMillis\(\) - lastHb >= intervalMs\) sendHb\(false\);/);
  assert.match(SVC, /if \(url\.isEmpty\(\) \|\| key\.isEmpty\(\)\) return;/);
  assert.match(SW, /var b: \[String: Any\] = \["action": "hb", "id": tripId, "key": key\]/);
  assert.match(SW, /if Date\(\)\.timeIntervalSince1970 - lastHb >= interval \{ sendHb\(\) \}/);
  /* τίποτα στον κανόνα δεν αγγίζει το lastHb ή το url: ο παλμός συνεχίζει και μετά από 404 */
  for (const src of [/private void onHb[\s\S]*?\n    \}/.exec(SVC)[0], /private func onHb[\s\S]*?\n    \}/.exec(SW)[0], RULE]) assert.ok(!/lastHb|\burl\b|intervalMs/.test(src));
});

/* ---------- η εφαρμογή ---------- */
const fn = name => { const i = TRIP.indexOf('function ' + name + '('); assert.ok(i >= 0, name); let d = 0, j = TRIP.indexOf('{', i); for (let k = j; k < TRIP.length; k++) { if (TRIP[k] === '{') d++; else if (TRIP[k] === '}' && --d === 0) return TRIP.slice(i, k + 1); } };
test('app: which trips have no row on the server (the cases the phones must survive) did not change', () => {
  const p = fn('pushTrip');
  assert.match(p, /if\(!s\.id\|\|!cl\) return Promise\.resolve\(\);/, 'no account → nothing is sent');
  assert.match(p, /if\(s\.noAlert&&!s\.sosAt\)\{ srv=''; return Promise\.resolve\(\); \}/, 'contact alert off → nothing is sent (until SOS)');
  assert.match(TRIP, /pushContact\(\)\.then\(trackPos\)\.then\(pushTrip\)\.then\(function\(\)\{ nativeStart\(load\(\)\); \}\);/, 'the service starts whether or not the registration worked');
});
/* η απόφαση «δίνω στην υπηρεσία τη διεύθυνση του παλμού;» εκτελείται εδώ, με τον πραγματικό κώδικα της εφαρμογής */
const hbWant = (s, account) => new Function('Cl', 's', fn('hbWant') + '; return hbWant(s);')(() => account ? {} : null, s);
/* ο όρος του pushTrip, γραμμένος ξανά από τις δύο γραμμές του: στέλνει γραμμή όταν υπάρχει λογαριασμός και όχι (χωρίς ειδοποίηση και χωρίς SOS) */
const pushes = (s, account) => !!account && !(s.noAlert && !s.sosAt);
test('app: the service gets the heartbeat address exactly when the app registers the trip on the server — otherwise nothing leaves the phone', () => {
  for (const account of [false, true]) for (const noAlert of [false, true]) for (const sosAt of [0, 1795200000000]) {
    const s = { id: 'trip-1', noAlert, sosAt, hbu: 0 };
    assert.equal(hbWant(s, account), pushes(s, account), `account=${account} noAlert=${noAlert} sos=${!!sosAt}`);
  }
  assert.equal(hbWant({ noAlert: true, sosAt: 0 }, false), false, 'no account, alert off: no address');
  assert.equal(hbWant({ noAlert: false, sosAt: 0 }, false), false, 'no account: no address even with the alert on («your data stays only on your device»)');
  assert.equal(hbWant({ noAlert: true, sosAt: 0 }, true), false, 'account, alert off: no address');
  assert.equal(hbWant({ noAlert: true, sosAt: 5 }, true), true, 'account, alert off, SOS pressed: address — the server now follows the trip');
  assert.equal(hbWant({ noAlert: false, sosAt: 0 }, true), true, 'account, alert on: as before');
});
test('app: once given for a trip, the address is never taken back in that trip (an expired login must not silence a trip the server is watching)', () => {
  for (const noAlert of [false, true]) assert.equal(hbWant({ noAlert, sosAt: 0, hbu: 1 }, false), true);
  assert.equal(hbWant({ noAlert: false, sosAt: 0, synced: true }, false), true, 'a trip that already reached the server (started on an older app version) keeps its heartbeat');
  assert.equal(hbWant({ noAlert: false, sosAt: 0, synced: false }, false), false); assert.equal(hbWant({ noAlert: true, sosAt: 0, synced: undefined }, true), false);
  const s = fn('nativeStart');
  assert.match(s, /var w=hbWant\(s\); NATW=s\.id\+'\|'\+\(w\?1:0\); if\(w&&!s\.hbu\)\{ var z=load\(\); if\(z\.id===s\.id\)\{ z\.hbu=1; save\(z\); \} \}/);
  assert.match(s, /n\.start\(\{id:s\.id,key:s\.hbk,url:w\?QP:'',apikey:PUBK,interval:180,/, 'no address → the native code sends nothing at all');
  assert.match(fn('start'), /pgStart:0,pgEnd:0,hbu:0,/, 'a new trip starts without it');
  /* τα κινητά δεν στέλνουν τίποτα με κενή διεύθυνση — ήδη από την 1.14.83 */
  assert.match(SVC, /private void sendHb\(boolean timer\) \{\s*if \(url\.isEmpty\(\) \|\| key\.isEmpty\(\)\) return;/);
  assert.match(SW, /private func sendHb\(\) \{\s*guard !url\.isEmpty, !key\.isEmpty, let u = URL\(string: url\) else \{ return \}/);
});
test('app: when the trip gets registered later (SOS on a trip without an alert, or signing in during the trip) the running service is handed the address', () => {
  assert.match(fn('pushTrip'), /if\(s\.noAlert&&s\.sosAt\) base\.start_sent=true;/);
  assert.match(fn('pushTrip'), /else save\(q\);\s*nativeSync\(\);/, 'right after the row reached the server');
  assert.match(fn('nativeSync'), /var s=load\(\); if\(s\.active&&NATW===s\.id\+'\|0'&&hbWant\(s\)\) nativeStart\(s,true\);/, 'only an upgrade, only for the trip this page started the service for');
  assert.match(fn('sos'), /s\.sosAt=Date\.now\(\); save\(s\);/); assert.match(fn('sos'), /trackPos\(\)\.then\(/); assert.match(fn('trackPos'), /return pushTrip\(\);/);
  /* το αποτέλεσμα της παράδοσης δεν πατά τη διάγνωση της εκκίνησης */
  assert.match(fn('natSt'), /t\.d\[up\?'nu':'ns'\]=v;/); assert.match(fn('gpsDiag'), /if\(d\.nu\) o\.nu=d\.nu;/);
});
test('app: opened without a running trip, it stops a recording service that may have been left behind — and re-checks first', () => {
  assert.match(TRIP, /\nelse setTimeout\(function\(\)\{ if\(!load\(\)\.active\) nativeStop\(\); \},2000\);/);
  assert.match(fn('nativeStop'), /var n=NT\(\); if\(n\) n\.stop\(\)\.catch\(function\(\)\{\}\);/, 'on the web (no service) it does nothing');
  assert.match(fn('back'), /nativeStop\(\);/, '«End trip» still stops it directly');
});
test('diagnostic: the service reports whether the server knew the trip and how many own 404s it received', () => {
  assert.match(SVC, /d\.put\("ack", acked \? 1 : 0\); d\.put\("hb4", dHb4\);/); assert.match(SVC, /dHb4 = d\.optLong\("hb4"\);/);
  assert.ok(SW.includes('d["ack"] = acked ? 1 : 0') && SW.includes('d["hb4"] = (d["hb4"] ?? 0) + 1'));
  assert.match(fn('mergeFixes'), /q\.d\.n=r\.diag;/, 'they travel with the trip, inside gps.n');
});
test('iPhone diagnostic (approved 21/11): permission kind, precise location and location errors are written into the trip diagnostic — without touching the recording', () => {
  const perm = /private func perm\(_ d: inout \[String: Double\]\) \{([\s\S]*?)\n    \}/.exec(SW); assert.ok(perm, 'perm()');
  assert.match(perm[1], /d\["auth"\] = Double\(lm\.authorizationStatus\.rawValue\)/);
  assert.match(perm[1], /d\["prec"\] = lm\.accuracyAuthorization == \.fullAccuracy \? 1 : 0/);
  const upd = /public func locationManager\(_ manager: CLLocationManager, didUpdateLocations locations: \[CLLocation\]\) \{([\s\S]*?)\n    \}/.exec(SW)[1];
  assert.match(upd, /perm\(&d\)\s*\n\s*if !tripId\.isEmpty \{ ud\.set\(d, forKey: dk\) \}/, 'every saved fix records the permission state');
  const fail = /didFailWithError error: Error\) \{([\s\S]*?)\n    \}/.exec(SW)[1];
  assert.match(fail, /noteDiag \{ d in d\["lmErr"\] = \(d\["lmErr"\] \?\? 0\) \+ 1 \}/);
  assert.match(SW, /public func locationManagerDidChangeAuthorization\(_ manager: CLLocationManager\) \{\s*if running \{ noteDiag \{ _ in \} \}/);
  const note = /private func noteDiag\([\s\S]*?\n    \}/.exec(SW)[0];
  assert.match(note, /guard !tripId\.isEmpty else \{ return \}/);
  /* καμία από τις τρεις προσθήκες δεν σταματά, ξεκινά ή αλλάζει την καταγραφή ή τον παλμό */
  for (const src of [perm[0], note, fail, /locationManagerDidChangeAuthorization[\s\S]*?\n    \}/.exec(SW)[0]]) assert.ok(!/halt\(|stopUpdating|startUpdating|sendHb|allowsBackground|lastHb/.test(src), src.slice(0, 60));
  /* ταξιδεύουν με την έξοδο όπως όλο το λεξικό (gps.n) */
  assert.match(fn('mergeFixes'), /q\.d\.n=r\.diag;/);
  assert.match(SW, /call\.resolve\(\["fixes": a\.filter \{ \$0\.count >= 3 && \$0\[2\] > since \}, "diag": d\]\)/);
});

