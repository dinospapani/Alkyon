/* 1.14.94 · iPhone: τα πρόσθετα Capacitor πρέπει να καταχωρούνται στην οθόνη που ΠΡΑΓΜΑΤΙΚΑ δείχνει η εφαρμογή.
   Το AlkTrip (GPS εξόδου στο παρασκήνιο) ήταν από την 1.14.83 καταχωρημένο σε οθόνη που δεν εμφανίζεται ποτέ· ο κώδικας μεταγλωττιζόταν κανονικά και κανένα test δεν το έπιανε. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), IOS = 'ios/App/App';
const swift = fs.readdirSync(path.join(ROOT, IOS)).filter(f => f.endsWith('.swift')).map(f => [f, rd(IOS + '/' + f)]);
/* ποια κλάση οθόνης φτιάχνει ο SceneDelegate, και τι καταχωρεί αυτή */
const scene = rd(IOS + '/SceneDelegate.swift'), shown = (/window\?\.rootViewController\s*=\s*(\w+)\(\)/.exec(scene) || [])[1];
const bodyOf = cls => { for (const [, src] of swift) { const m = new RegExp('class ' + cls + '\\s*:\\s*CAPBridgeViewController\\s*\\{([\\s\\S]*?)\\n\\}').exec(src); if (m) return m[1]; } return null; };
const registered = cls => ((bodyOf(cls) || '').match(/registerPluginInstance\((\w+)\(\)\)/g) || []).map(x => /\((\w+)\(/.exec(x)[1]);
/* όλα τα δικά μας πρόσθετα: κλάση → όνομα στη JS */
const plugins = {}; for (const [, src] of swift) for (const m of src.matchAll(/public class (\w+)\s*:\s*CAPPlugin[\s\S]*?public let jsName = "(\w+)"/g)) plugins[m[1]] = m[2];
/* ΓΝΩΣΤΗ ΕΚΚΡΕΜΟΤΗΤΑ: το AlkWatch (αυτόματη αποστολή κωδικού στο Apple Watch) είναι ανενεργό στο iPhone για τον ίδιο λόγο. Η ενεργοποίησή του θέλει ξεχωριστή απόφαση και δοκιμή σε συσκευή.
   Όταν αποφασιστεί, φεύγει από εδώ και καταχωρείται στην οθόνη που εμφανίζεται. */
const PENDING = ['AlkWatchPlugin'];

test('iPhone: the screen the app really shows is known, and it registers the trip GPS plugin', () => {
  assert.equal(shown, 'AlkBridgeViewController', 'SceneDelegate builds the window with this controller');
  assert.ok(bodyOf(shown), 'the controller exists'); const reg = registered(shown);
  assert.ok(reg.includes('AlkTripPlugin'), 'AlkTrip is registered where the page can reach it: ' + reg.join(', '));
  assert.ok(reg.includes('AlkBaroPlugin'), 'the barometer stays registered');
  assert.equal(new Set(reg).size, reg.length, 'nothing is registered twice');
});

test('iPhone: every plugin the web code asks for is registered in the shown screen (or is a declared, known gap)', () => {
  assert.deepEqual(Object.keys(plugins).sort(), ['AlkBaroPlugin', 'AlkTripPlugin', 'AlkWatchPlugin'], 'a new plugin must be added to this test on purpose');
  const nat = rd('native.js'), asked = Object.entries(plugins).filter(([, js]) => nat.includes("reg('" + js + "')")).map(([c]) => c), reg = registered(shown);
  assert.deepEqual(asked.sort(), Object.keys(plugins).sort(), 'native.js uses all three');
  const missing = asked.filter(c => !reg.includes(c));
  assert.deepEqual(missing.sort(), PENDING.slice().sort(), 'only the declared gap is missing from the shown screen');
  /* κανένα πρόσθετο δεν είναι καταχωρημένο ΚΑΙ στις δύο οθόνες (δύο αντίγραφα του ίδιου πρόσθετου) */
  const other = registered('MainViewController'); assert.deepEqual(other.filter(c => reg.includes(c)), [], 'no plugin is registered in both controllers');
  assert.ok(!other.includes('AlkTripPlugin'), 'the trip GPS plugin no longer lives in the controller that is never shown');
});

test('iPhone: background location is declared, and the plugin only records during a trip the user started', () => {
  const plist = rd(IOS + '/Info.plist'), tp = rd(IOS + '/AlkTripPlugin.swift');
  assert.match(plist, /<key>UIBackgroundModes<\/key>\s*<array>\s*<string>location<\/string>/, 'without this, allowsBackgroundLocationUpdates crashes the app');
  assert.match(plist, /<key>NSLocationWhenInUseUsageDescription<\/key>/);
  assert.ok(!/requestAlwaysAuthorization|NSLocationAlways/.test(tp + plist), 'still “While Using” only');
  assert.match(tp, /guard self\.authorized\(\) else \{ call\.resolve\(\["ok": false, "err": "perm"\]\); return \}/, 'no permission → a clear answer, not a crash');
  assert.match(tp, /@objc func stop[\s\S]*?stopUpdatingLocation\(\)[\s\S]*?allowsBackgroundLocationUpdates = false/, 'stops at the end of the trip');
  assert.equal((tp.match(/startUpdatingLocation\(\)/g) || []).length, 1, 'location starts in one place only (begin)');
});

test('diagnostic: the result of starting the background recorder is kept, so a silent failure shows next time', () => {
  const t = rd('v4/trip.js'), pv = rd('v4/profile-view.js');
  assert.match(t, /natSt\(r&&r\.ok\?'ok':'no:'\+/); assert.match(t, /natSt\('err:'\+/);
  assert.ok(!/n\.start\(\{[^;]*\}\)\.catch\(function\(\)\{\}\)/.test(t), 'start() failures are no longer swallowed');
  assert.match(t, /if\(ns\) o\.ns=ns; if\(MGE\) o\.me=MGE;/); assert.match(t, /dgm\('mgErr'\); MGE=/);
  assert.match(pv, /g\.ns\|\|g\.me/);
});
