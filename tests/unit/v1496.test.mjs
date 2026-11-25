/* 1.14.96 · σύνδεση iPhone → Apple Watch: ο κωδικός πηγαίνει μόνος του στο ρολόι.
   Σφάλμα 1: το AlkWatchPlugin ήταν καταχωρημένο μόνο στο MainViewController, που δεν εμφανίζεται (ίδιο με το AlkTrip πριν την 1.14.94).
   Σφάλμα 2: το link() απαντούσε ok ακόμη κι όταν δεν έστελνε (χωρίς ζευγαρωμένο ρολόι ή χωρίς την εφαρμογή στο ρολόι) → «Στάλθηκε στο ρολόι».
   Η διαδρομή εκκίνησης (Info.plist → SceneDelegate → οθόνη που εμφανίζεται → πρόσθετα) ελέγχεται στο v1494.test.mjs, πλέον χωρίς εξαίρεση. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SD = rd('ios/App/App/SceneDelegate.swift'), MV = rd('ios/App/App/MainViewController.swift'), WP = rd('ios/App/App/AlkWatchPlugin.swift'), GJ = rd('v4/garmin.js');
const body = (src, re) => { const m = re.exec(src); assert.ok(m, String(re)); let d = 0, j = src.indexOf('{', m.index); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(m.index, k + 1); } };

test('the watch plugin lives in the screen the app shows, and the never-shown screen registers nothing', () => {
  const shown = body(SD, /class AlkBridgeViewController: CAPBridgeViewController \{/);
  assert.match(shown, /bridge\?\.registerPluginInstance\(AlkWatchPlugin\(\)\)/);
  assert.ok(!/registerPluginInstance/.test(body(MV, /class MainViewController: CAPBridgeViewController \{/)), 'MainViewController registers no plugin');
});

test('link() answers ok only when the code was actually handed to WatchConnectivity; otherwise it says why', () => {
  const send = body(WP, /private func send\(_ ctx: \[String: Any\]\) -> String\? \{/);
  assert.match(send, /guard s\.isPaired else \{ return "nowatch" \}/);
  assert.match(send, /guard s\.isWatchAppInstalled else \{ return "noapp" \}/);
  assert.match(send, /s\.transferUserInfo\(ctx\)\s*\n[^\n]*\n\s*return nil/, 'nil (= sent) only after the code was queued for the watch');
  const link = body(WP, /@objc func link\(_ call: CAPPluginCall\) \{/);
  assert.ok(!/call\.resolve\(\["ok": true\]\)/.test(link), 'no unconditional ok any more');
  assert.match(link, /self\.answer\(call, self\.send\(ctx\)\)/);
  assert.match(body(WP, /private func answer\(_ call: CAPPluginCall, _ err: String\?\) \{/), /if let e = err \{ call\.resolve\(\["ok": false, "err": e\]\) \} else \{ call\.resolve\(\["ok": true\]\) \}/);
  /* χωρίς ενεργή σύνδεση ακόμη: η απάντηση περιμένει την ενεργοποίηση (ή 5″), δεν λέει «ok» από πριν */
  assert.match(link, /self\.pending = ctx; self\.pendingCall = call; call\.keepAlive = true; s\.activate\(\)/);
  assert.match(link, /asyncAfter\(deadline: \.now\(\) \+ 5\) \{ if self\.pendingCall === call \{ self\.finishPending\(err: "inactive"\) \} \}/);
  const act = body(WP, /activationDidCompleteWith activationState: WCSessionActivationState, error: Error\?\) \{/);
  assert.match(act, /if activationState == \.activated \{ self\.finishPending\(err: self\.send\(p\)\) \} else \{ self\.finishPending\(err: "inactive"\) \}/);
  assert.match(body(WP, /private func finishPending\(err: String\?\) \{/), /answer\(c, err\); bridge\?\.releaseCall\(c\)/);
});

/* 21/11/2026 (1.14.97): ΑΛΛΑΓΗ TEST (δηλωμένη). Το κουμπί «Στείλε στο ρολόι» δεν δείχνει πια το μήνυμα με ένα τριαδικό πάνω στο ok,
   αλλά ελέγχει πρώτα ποιο ρολόι υπάρχει (sendNow/sendMsg, εύρημα C: στο Android το link() απαντά ok και χωρίς ρολόι). Το test έλεγχε
   κατά λέξη την παλιά γραμμή· τώρα ελέγχει ότι τα ίδια δύο μηνύματα υπάρχουν και ότι το «Στάλθηκε» απαιτεί ok. Η συμπεριφορά ελέγχεται στο merge-watch-msg.test.mjs. */
test('the watch screen shows the right message for each answer (push() result + which watch is there)', () => {
  assert.match(GJ, /function push\(code\)\{[^\n]*return r&&r\.ok; \},function\(\)\{ return null; \}\); \}/);
  assert.ok(GJ.includes("T('Στάλθηκε στο ρολόι.','Sent to the watch.')"));
  assert.ok(GJ.includes("T('Δεν βρέθηκε ρολόι με το Alkyon."));
  assert.match(GJ, /return ok\?T\('Στάλθηκε στο ρολόι\.','Sent to the watch\.'\):T\('Δεν μπόρεσα να ελέγξω για ρολόι/, 'without status, «Sent» only when the send succeeded');
});

test('the watch screen never stays on «Looking for a watch…» when the status check fails', () => {
  assert.ok(!/if\(!el\|\|!r\) return;/.test(GJ), 'the old silent return is gone');
  assert.ok(GJ.includes("if(!r){ el.textContent=T('Δεν μπόρεσα να ελέγξω για ρολόι."));
});
