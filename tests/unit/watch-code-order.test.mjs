/* 21/11/2026 · Apple Watch: μετά από διαδοχικά «Νέος κωδικός», το ρολόι κρατά τον ΝΕΟΤΕΡΟ.
   Πραγματικό περιστατικό (21/11 21:08–21:09): 3 κωδικοί σε 37″· το ρολόι ρώτησε τον server με έναν ήδη σβησμένο. Αιτία στον κώδικα:
   το iPhone στέλνει από applicationContext + transferUserInfo (ΟΥΡΑ, παραδίδει και παλιούς, αργότερα) + sendMessage, και το ρολόι
   έγραφε κάθε διαφορετικό κωδικό. Το Swift δεν τρέχει εδώ: ελέγχεται ο κώδικας (και μεταγλωττίζεται στο GitHub, «Alkyon native build check»).
   ΔΕΝ έχει επαληθευτεί σε πραγματικό ρολόι. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SV = rd('ios/App/AlkyonWatch/Services.swift'), MN = rd('ios/App/AlkyonWatch/Menus.swift'), PL = rd('ios/App/App/AlkWatchPlugin.swift'), GAR = rd('v4/garmin.js');

test('the iPhone stamps every code it sends with the time ("at")', () => {
  assert.match(PL, /let ctx: \[String: Any\] = \["code": code, "lang": [^\]]+, "at": Date\(\)\.timeIntervalSince1970\]/);
  assert.match(PL, /updateApplicationContext\(ctx\)/); assert.match(PL, /transferUserInfo\(ctx\)/);
});

test('the watch writes a code only if it is newer than the one it has; the check runs on the main queue (no race between the three channels)', () => {
  const ap = SV.slice(SV.indexOf('func apply(_ d: [String: Any])'), SV.indexOf('func session(_ s: WCSession, activationDidCompleteWith'));
  assert.match(ap, /let at = \(d\["at"\] as\? NSNumber\)\?\.doubleValue \?\? 0/);
  assert.match(ap, /DispatchQueue\.main\.async \{\s*guard clean != P\.code, Link\.isNewer\(at, than: P\.dn\("codeAt"\)\) else \{ return \}/);
  assert.match(ap, /if at > 0 \{ P\.setD\("codeAt", at\) \}/);
  assert.match(SV, /static func isNewer\(_ at: Double, than last: Double\?\) -> Bool \{ at <= 0 \|\| last == nil \|\| at > last! \}/);
});

test('isNewer semantics (the same expression, evaluated): older / same → ignored; newer, first ever, or a message without "at" → written', () => {
  const expr = SV.match(/static func isNewer\(_ at: Double, than last: Double\?\) -> Bool \{ (.+?) \}/)[1].replace('last!', 'last');
  const isNewer = new Function('at', 'last', 'return ' + expr.replace(/\bnil\b/g, 'null') + ';');
  const t1 = 1795295300.1, t2 = t1 + 10, t3 = t1 + 37;
  assert.equal(isNewer(t3, null), true, 'first code');
  assert.equal(isNewer(t2, t3), false, 'the queued older code arriving last is ignored (the 21/11 case)');
  assert.equal(isNewer(t3, t3), false); assert.equal(isNewer(t3, t2), true);
  assert.equal(isNewer(0, t3), true, 'a message without "at" (not sent by any current iPhone version): same behaviour as before');
});

test('a code typed on the watch, or «Unlink», is not undone by an older code still queued from the iPhone', () => {
  assert.match(MN, /P\.code = codeIn; codeIn = ""; P\.setB\("wel", true\); P\.setD\("codeAt", Date\(\)\.timeIntervalSince1970\)/);
  assert.match(MN, /\{ P\.code = ""; P\.setD\("codeAt", Date\(\)\.timeIntervalSince1970\); e\.bump\(\) \}/);
});

test('iPhone «New code»: cannot be pressed again while the previous one is being made; re-enabled on every outcome', () => {
  const on = GAR.slice(GAR.indexOf("text:T('Νέος κωδικός','New code'),onclick:"), GAR.indexOf("text:T('Νέος κωδικός','New code'),onclick:") + 700);
  assert.match(on, /if\(newBusy\) return; newBusy=true; if\(btn\) btn\.disabled=true;/);
  assert.match(on, /if\(!y\)\{ done\(\); return; \}/, 'cancel');
  assert.match(on, /then\(function\(\)\{ done\(\); paint\(\); \},function\(e\)\{ done\(\); paint\(String\(e\.message\)\); \}\); \},done\);/, 'success, error, dialog failure');
  assert.match(GAR, /var newBusy=false;/);
});
