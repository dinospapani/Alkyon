// 1.14.88 · Apple Watch σε arm64_32 (Series 4–8, SE: Int 32-bit) και αποθήκευση της εξόδου.
// Το crash του 🐟 ήταν Int(ms()) που ξεχείλιζε· ο προσομοιωτής (64-bit) δεν το έπιανε. Ο κανόνας: στο ρολόι καμία μετατροπή Int(...) από Double απευθείας, πάντα si(...).
// Αυτό το test τρέχει σε κάθε ανέβασμα (όχι μόνο στο workflow των ρολογιών) και σταματά όποια νέα επικίνδυνη μετατροπή.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DIRS = ['ios/App/AlkyonWatch', 'ios/App/AlkyonShared', 'ios/App/AlkyonWatchWidgets'];
const files = DIRS.flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.swift')).map(f => d + '/' + f));
const code = f => rd(f).split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

test('watch: no direct Int(...) conversion anywhere in the watch code (they trap on 32-bit watches)', () => {
  const ALLOW = [/let n = Int\(s\), \(0\.\.<6\)/, /x\.isFinite \? Int\(max\(-2147483648\.0, min\(2147483647\.0, x\)\)\) : 0/];   // ανάγνωση κειμένου · το ίδιο το si()
  const bad = [];
  for (const f of files) code(f).split('\n').forEach((l, i) => { if (f.endsWith('Strings.swift')) return; let s = l; for (const a of ALLOW) s = s.replace(a, ''); if (/(?<![A-Za-z0-9_.])U?Int(8|16|32|64)?\(/.test(s)) bad.push(f + ':' + (i + 1) + ' ' + l.trim().slice(0, 90)); });
  assert.deepEqual(bad, [], 'use si(...) instead');
  assert.ok(files.length >= 8, 'watch sources found: ' + files.length);
});

test('watch: the two crashing lines and the Spot ETA are fixed', () => {
  const e = rd('ios/App/AlkyonWatch/Engine.swift'), v = rd('ios/App/AlkyonWatch/Views.swift'), s = rd('ios/App/AlkyonShared/Shared.swift');
  assert.equal((e.match(/si\(ms\(\)\.truncatingRemainder\(dividingBy: 1000\)\)/g) || []).length, 2, 'catch id and gear id');
  assert.ok(!/Int\(ms\(\)\)|si\(ms\(\)\) %/.test(e)); assert.ok(v.includes('si(min(99999, (dm / 1852) / max(sp, 0.5) * 60))'));
  assert.ok(s.includes('func si(_ x: Double) -> Int { x.isFinite ? Int(max(-2147483648.0, min(2147483647.0, x))) : 0 }') && s.includes('func nowS() -> Int { si(Date().timeIntervalSince1970) }'));
});

test('watch: no integer literal or millisecond arithmetic that cannot fit in 32 bits', () => {
  const bad = [];
  for (const f of files) code(f).split('\n').forEach((l, i) => { if (f.endsWith('Strings.swift')) return;
    for (const m of l.matchAll(/(?<![\w.#x])(\d{10,})(?![\d.eE])/g)) if (+m[1] > 2147483647) bad.push(f + ':' + (i + 1) + ' literal ' + m[1]);
    if (/nowS\(\)\s*\*\s*1000|\bstart\s*\*\s*1000|\bts\s*\*\s*1000/.test(l)) bad.push(f + ':' + (i + 1) + ' seconds × 1000 as Int'); });
  assert.deepEqual(bad, []);
});

test('watch: the trip is saved while it runs, resumed at launch and cleared when it ends', () => {
  const e = rd('ios/App/AlkyonWatch/Engine.swift'), c = rd('ios/App/AlkyonWatch/Core.swift'), h = rd('ios/App/AlkyonWatch/Services.swift'), a = rd('ios/App/AlkyonWatch/AlkyonWatchApp.swift');
  for (const k of ['active', 'tid', 'start', 'n', 'pts', 'km', 'p0']) assert.ok(new RegExp('"' + k + '"').test(c.slice(c.indexOf('func snapshot()'), c.indexOf('func restore('))), 'saved: ' + k);
  for (const k of ['catchTs', 'troll', 'trLeads']) assert.ok(e.slice(e.indexOf('func tripPersist'), e.indexOf('private func tripRestore')).includes('o["' + k + '"]'), 'saved: ' + k);
  assert.ok(/t - tripSavedAt < 15/.test(e), 'writes are rate-limited');
  assert.ok(e.includes('trip.onPos(lat, lon, speed, heading, acc); tripPersist()'), 'on new points'); assert.ok(e.includes('catchTs.append(ts) }; tripPersist(true) }'), 'on every catch');
  assert.ok(/let it = trip\.finish\(save\)\n\s+P\.put\("tripSt", nil\)/.test(e), 'the end of the trip clears the saved state');
  assert.ok(/tripRestore\(\)\n\s+Timer\.scheduledTimer/.test(e) && e.includes('page = 1; pageSel = 1'), 'restored at launch, on the trip page');
  assert.ok(e.includes('gpsUpdate(); Health.shared.recover()'), 'GPS and the workout session restart'); assert.ok(h.includes('store.recoverActiveWorkoutSession'), 'HealthKit session recovery');
  assert.ok(a.includes('Engine.shared.tripResume()') && a.includes('func handleActiveWorkoutRecovery()'), 'called at launch and from the watchOS workout recovery');
  assert.ok(c.includes('nowS() - st < 36 * 3600'), 'a trip older than 36 h is not resumed');
});

test('watch CI: logic tests with 32-bit limits and a real arm64_32 build', () => {
  const y = rd('.github/workflows/watch.yml');
  assert.ok(y.includes('watch/tests/main.swift -o /tmp/wt') && y.includes('/tmp/wt\n'), 'logic tests run'); assert.ok(y.includes('-sdk watchos ARCHS=arm64_32') && y.includes('grep -q arm64_32'), 'device build for arm64_32');
  const t = rd('watch/tests/main.swift'); assert.ok(t.includes('Int32(exactly:') && t.includes('u.restore(back)'));
});
