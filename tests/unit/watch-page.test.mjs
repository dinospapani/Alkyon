/* 26/11/2026: οθόνη Ρολόι: καρτέλες ανά πλατφόρμα, επιβεβαιώσεις πάνω από την οθόνη (δεν την κλείνουν). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const GAR = rd('v4/garmin.js'), UI = rd('v4/ui.js');

test('ask(): optional stack opens the confirmation on top of the current sheet; default unchanged', () => {
  assert.match(UI, /function ask\(q,okText,danger,stack\)\{/);
  assert.match(UI, /var sh=sheet\(\{stack:!!stack,title:title,/);
});

test('watch screen: «New code» and «Disconnect» confirm on top (stack), so the screen stays open with the new code', () => {
  assert.match(GAR, /T\('Νέος κωδικός','New code'\),0,1\)\.then\(/);
  assert.match(GAR, /T\('Αποσύνδεση','Disconnect'\),1,1\)\.then\(/);
});

test('watch screen: tabs per platform (iPhone: Apple Watch|Garmin · Android: Wear OS|Garmin · web: all three)', () => {
  const tabs = new Function('window', GAR.match(/function plat\(\)\{[^\n]*\}/)[0] + '\n' + GAR.match(/function tabs\(\)\{[^\n]*\}/)[0] + '\nreturn tabs;');
  assert.deepEqual(tabs({ AKN: { platform: 'ios' } })(), ['apple', 'garmin']);
  assert.deepEqual(tabs({ AKN: { platform: 'android' } })(), ['wear', 'garmin']);
  assert.deepEqual(tabs({})(), ['apple', 'wear', 'garmin']);
});
