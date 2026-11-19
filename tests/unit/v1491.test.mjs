/* 1.14.91: περιορισμοί (ProtectedSeas Navigator) · ειδικές ζώνες κατηγορίας 9 και διεύθυνση επικοινωνίας εκτός κώδικα */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wanted, makeClient } from '../../navigator-sync.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('category 9: national waters stay out, special no-fishing zones come in', () => {
  /* πραγματικές εγγραφές του καταλόγου (20/11/2026) */
  assert.equal(wanted({ country: 'Cyprus', category_id: 9, lfp: 1 }), false, 'Cyprus Territorial Seas (AICYP2)');
  assert.equal(wanted({ country: 'Greece', category_id: 9, lfp: 1 }), false, 'Greece Territorial Waters (AIGRC2)');
  assert.equal(wanted({ country: 'Lebanon', category_id: 9, lfp: 3 }), false, 'Lebanon Territorial Sea (AILBN2)');
  assert.equal(wanted({ country: 'Israel', category_id: 9, lfp: 2 }), false, 'Israel EEZ (AIISR1)');
  assert.equal(wanted({ country: 'Turkey', category_id: 9, lfp: 5 }), true, 'Foça naval restricted zone (AITUR62)');
  assert.equal(wanted({ country: 'Turkey', category_id: 9, lfp: 4 }), true, 'Aksaz Harbor (AITUR44)');
});
test('the rest of the filter is unchanged', () => {
  assert.equal(wanted({ country: 'Cyprus', category_id: 1, lfp: 3 }), true);
  assert.equal(wanted({ country: 'Cyprus', category_id: 1, lfp: 0 }), false);
  assert.equal(wanted({ country: 'Cyprus', category_id: 1, lfp: null }), false);
  assert.equal(wanted({ country: 'Turkey', category_id: 9, lfp: 0 }), false);
  assert.equal(wanted({ country: 'Italy', category_id: 1, lfp: 5 }), false);
  assert.equal(wanted(null), false);
});
test('the contact address comes from the environment, never from the code', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'navigator-sync.mjs'), 'utf8');
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(src), 'no e-mail address in navigator-sync.mjs');
  assert.match(src, /process\.env\.NAV_CONTACT/);
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'navigator-sync.yml'), 'utf8');
  assert.match(yml, /NAV_CONTACT: \$\{\{ secrets\.NAV_CONTACT \}\}/);
  let ua = null; const get = makeClient(async (u, o) => { ua = o.headers['User-Agent']; return { ok: true, json: async () => ({}) }; }, async () => {});
  await get('/x'); assert.match(ua, /^Alkyon-sync\/1\.0 \(fishing app/); assert.ok(!/@/.test(ua) || !!process.env.NAV_CONTACT);
});
