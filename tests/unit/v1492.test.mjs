/* 1.14.92: εθνικά ύδατα του Navigator (γενικοί κανόνες της χώρας) σε ξεχωριστό αρχείο, χωρίς σχεδίαση */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waters, isWaters, watersKind, outerRings, wanted, WATERS, KEEP } from '../../navigator-sync.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sq = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];
const site = (id, name, country, lfp, extra) => Object.assign({ ps_id: id, site_name: name, country, category_id: 9, lfp, recreational_fishing: 2, hook_and_line: 3, percent_marine_area: 100,
  restrictions: 'Fishing restrictions, such as bag limits, seasons, and size restrictions apply. ' + 'x'.repeat(900), allowed: 'Certain activities, including fishing, are allowed in accordance with local laws.',
  site_boundary: { type: 'Polygon', coordinates: [sq(32, 34, 2), sq(32.5, 34.5, 0.5)] } }, extra || {});

test('national waters are a separate kind: never in the areas file, always category 9 with LFP 1–3', () => {
  const ts = site('AICYP2', 'Cyprus Territorial Seas', 'Cyprus', 1), eez = site('AICYP1', 'Cyprus EEZ', 'Cyprus', 1);
  assert.equal(isWaters(ts), true); assert.equal(wanted(ts), false, 'not drawn as an area');
  assert.equal(watersKind(ts), 1); assert.equal(watersKind(eez), 2); assert.equal(watersKind(site('AIGRC2', 'Greece Territorial Waters', 'Greece', 1)), 1);
  assert.equal(isWaters(site('AITUR62', 'Naval zone', 'Turkey', 5)), false, 'special zones are areas, not waters');
  assert.equal(isWaters(site('X', 'Italy EEZ', 'Italy', 1)), false);
  assert.equal(isWaters(Object.assign(site('Y', 'MPA', 'Cyprus', 1), { category_id: 1 })), false);
  assert.equal(WATERS.length, 18); assert.equal(new Set(WATERS).size, 18);
  assert.ok(WATERS.includes('AICYP2') && WATERS.includes('AIGRC2'), 'Cyprus and Greece are included');
  assert.equal(KEEP.size, 9);
});
test('only the outer boundary is kept (holes are land) and it is stored as [lat, lon]', () => {
  const G = outerRings({ type: 'Polygon', coordinates: [sq(32, 34, 2), sq(32.5, 34.5, 0.5)] }, 0.005);
  assert.equal(G.length, 1); assert.equal(G[0].length, 1, 'no holes'); assert.deepEqual(G[0][0][0], [34, 32]);
  const M = outerRings({ type: 'MultiPolygon', coordinates: [[sq(20, 35, 1)], [sq(25, 36, 1), sq(25.2, 36.2, 0.1)]] }, 0.005);
  assert.equal(M.length, 2); assert.ok(M.every(p => p.length === 1));
  assert.equal(outerRings(null, 0.005), null); assert.equal(outerRings({ type: 'Point', coordinates: [1, 2] }, 0.005), null);
  /* πυκνό όριο απλοποιείται */
  const dense = []; for (let i = 0; i <= 400; i++) dense.push([30 + i * 0.005, 34]); dense.push([32, 36], [30, 36], [30, 34]);
  assert.ok(outerRings({ type: 'Polygon', coordinates: [dense] }, 0.005)[0][0].length < 10);
});
test('waters(): writes all countries or nothing, keeps the long rules text, one request per record', async () => {
  const tmp = path.join(os.tmpdir(), 'wat-' + process.pid + '.json'); try { fs.unlinkSync(tmp); } catch (e) {}
  const db = { A2: site('A2', 'Cyprus Territorial Seas', 'Cyprus', 1), A1: site('A1', 'Cyprus EEZ', 'Cyprus', 1), G2: site('G2', 'Greece Territorial Waters', 'Greece', 1), Z: site('Z', 'Naval zone', 'Turkey', 5) };
  const urls = []; const fetchFn = async u => { urls.push(u); return { ok: true, status: 200, json: async () => db[/ps_id=([^&]+)/.exec(u)[1]] }; };
  const r = await waters({ file: tmp, fetchFn, sleep: async () => {}, log: () => {}, ids: ['A2', 'A1', 'G2'], now: Date.UTC(2026, 10, 20) });
  assert.equal(r.total, 3); assert.equal(r.changed, true); assert.equal(urls.length, 3); assert.ok(urls.every(u => /export_boundaries=true/.test(u)));
  const j = JSON.parse(fs.readFileSync(tmp, 'utf8')); assert.equal(j.v, '2026-11-20');
  assert.deepEqual(j.f.map(f => f.i), ['A2', 'A1', 'G2'], 'by country, territorial sea first');
  const cy = j.f[0]; assert.equal(cy.w, 1); assert.equal(cy.k, 9); assert.equal(cy.l, 1); assert.ok(cy.re.length > 700, 'rules text is not cut to 420'); assert.match(cy.al, /allowed/); assert.equal(cy.g[0].length, 1); assert.equal(cy.b.length, 4);
  const again = await waters({ file: tmp, fetchFn, sleep: async () => {}, log: () => {}, ids: ['A2', 'A1', 'G2'], now: Date.UTC(2026, 11, 1) });
  assert.equal(again.changed, false); assert.equal(JSON.parse(fs.readFileSync(tmp, 'utf8')).v, '2026-11-20', 'same data → file untouched');
  const before = fs.readFileSync(tmp, 'utf8');
  await assert.rejects(() => waters({ file: tmp, fetchFn, sleep: async () => {}, log: () => {}, ids: ['A2', 'Z', 'Z', 'Z', 'Z'] }), /Σταματώ χωρίς αλλαγή/);
  assert.equal(fs.readFileSync(tmp, 'utf8'), before); fs.unlinkSync(tmp);
});
test('the app reads the waters file but never draws it', () => {
  const src = fs.readFileSync(path.join(ROOT, 'navigator.js'), 'utf8');
  assert.match(src, /WFILE='navigator-waters\.json'/);
  assert.match(src, /function watersAt\(lat,lon\)/);
  assert.ok(!/draw\(WAT|L\.polygon\(wf|WAT\.forEach\(function\(f\)\{[^}]*L\.polygon/.test(src), 'no polygon is drawn for waters');
  assert.match(src, /if\(!hs\.length&&!wf\) return null;/, 'a point with neither a zone nor waters still shows nothing');
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'navigator-sync.yml'), 'utf8');
  assert.match(yml, /node navigator-sync\.mjs waters/); assert.match(yml, /git add navigator-waters\.json/);
});
