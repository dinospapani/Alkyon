/* 28/11/2026: οι βασικές κεφαλίδες ασφαλείας του alkyonfishing.com (cloudflare/_headers, S4 του A1 audit) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const H = fs.readFileSync(new URL('../../cloudflare/_headers', import.meta.url), 'utf8');
function block(path) {
  const lines = H.split('\n'); const i = lines.findIndex(l => l.trim() === path); if (i < 0) return null;
  const out = []; for (let k = i + 1; k < lines.length && /^\s+\S/.test(lines[k]); k++) out.push(lines[k].trim()); return out;
}
test('κεφαλίδες ασφαλείας σε όλες τις σελίδες (/*)', () => {
  const b = block('/*'); assert.ok(b, 'λείπει το /*');
  assert.ok(b.some(l => /^Strict-Transport-Security:\s*max-age=\d{7,}/.test(l)), 'HSTS');
  assert.ok(!b.some(l => /includeSubDomains|preload/.test(l)), 'HSTS χωρίς includeSubDomains/preload');
  assert.ok(b.includes('X-Content-Type-Options: nosniff'));
  assert.ok(b.includes("Content-Security-Policy: frame-ancestors 'self'"));
  assert.ok(b.includes('X-Frame-Options: SAMEORIGIN'));
  assert.ok(b.some(l => /^Referrer-Policy:/.test(l)));
});
test('οι παλιοί κανόνες μένουν (CORS για .json και nav, no-cache για τα service workers)', () => {
  assert.deepEqual(block('/*.json'), ['Access-Control-Allow-Origin: *']);
  assert.deepEqual(block('/nav/*'), ['Access-Control-Allow-Origin: *']);
  assert.deepEqual(block('/sw.js'), ['Cache-Control: no-cache']);
  assert.deepEqual(block('/v4/sw.js'), ['Cache-Control: no-cache']);
});
