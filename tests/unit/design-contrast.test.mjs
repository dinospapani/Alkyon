/* 26/11/2026 (Γ+) · Κλείδωμα σχεδίου: η αντίθεση των χρωμάτων κειμένου πάνω στις επιφάνειες δεν πέφτει κάτω από WCAG AA.
   Διαβάζει τις μεταβλητές από το v4/app.css (βάση) και το v4/refine.css (Γ+, υπερισχύει), για φωτεινό και σκοτεινό θέμα. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const app = fs.readFileSync(path.join(ROOT, 'v4/app.css'), 'utf8');
const ref = fs.readFileSync(path.join(ROOT, 'v4/refine.css'), 'utf8');

const vars = block => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
const first = (src, re) => { const m = src.match(re); assert.ok(m, 'δεν βρέθηκε μπλοκ ' + re); return m[1]; };
const lightBase = vars(first(app, /:root\{([\s\S]*?)\n\}/));
const darkBase = vars(first(app, /:root\[data-theme=dark\]\{([\s\S]*?)\n\}/));
const lightRef = vars(first(ref, /:root\{([\s\S]*?)\n\}/));
const darkRef = vars(first(ref, /:root\[data-theme=dark\]\{([\s\S]*?)\n\}/));
const THEMES = { light: { ...lightBase, ...lightRef }, dark: { ...darkBase, ...darkRef } };

const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

for (const [name, t] of Object.entries(THEMES)) {
  test(`${name}: κείμενο (ink, ink-2, ink-3) ≥ 4,5:1 πάνω σε σελίδα, κάρτα και ανυψωμένη επιφάνεια`, () => {
    for (const fg of ['ink', 'ink-2', 'ink-3']) for (const bg of ['bg', 'surface', 'surface-2']) {
      const r = ratio(t[fg], t[bg]);
      assert.ok(r >= 4.5, `${name} ${fg} ${t[fg]} πάνω σε ${bg} ${t[bg]} = ${r.toFixed(2)}`);
    }
  });
  test(`${name}: ενεργή καρτέλα (ink πάνω σε surface-3) ≥ 4,5:1 και κείμενο πάνω στο πορτοκαλί ≥ 4,5:1`, () => {
    assert.ok(t['surface-3'], 'λείπει η --surface-3');
    assert.ok(ratio(t.ink, t['surface-3']) >= 4.5, `${name} ink/surface-3 ${ratio(t.ink, t['surface-3']).toFixed(2)}`);
    assert.ok(ratio(t['accent-ink'], t.accent) >= 4.5, `${name} accent-ink/accent ${ratio(t['accent-ink'], t.accent).toFixed(2)}`);
  });
}

for (const [name, t] of Object.entries(THEMES)) {
  test(`${name} (Γ+ βήμα 2): όριο στοιχείων που πατιούνται (line-strong) ≥ 3:1 και κόκκινο κείμενο (poor-ink) ≥ 4,5:1 πάνω σε σελίδα και κάρτα`, () => {
    for (const bg of ['bg', 'surface']) {
      assert.ok(ratio(t['line-strong'], t[bg]) >= 3, `${name} line-strong/${bg} ${ratio(t['line-strong'], t[bg]).toFixed(2)}`);
      assert.ok(ratio(t['poor-ink'], t[bg]) >= 4.5, `${name} poor-ink/${bg} ${ratio(t['poor-ink'], t[bg]).toFixed(2)}`);
    }
  });
}

test('Γ+: κανένα μέγεθος γραμμάτων κάτω από 12 px στο refine.css', () => {
  const small = [...ref.matchAll(/font(?:-size)?:[^;}]*?\b(\d+(?:\.\d+)?)px/g)].map(m => +m[1]).filter(n => n < 12);
  assert.deepEqual(small, []);
});

test('Γ+: χωρίς θόλωμα (backdrop-filter) στο refine.css, για να μην επιβαρύνει τα κινητά', () => {
  assert.ok(!/backdrop-filter/.test(ref));
});
